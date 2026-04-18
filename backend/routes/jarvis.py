"""Jarvis — internal command center AI for RRG admin team."""
import uuid
import json
import time
import logging
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from database import db
from utils.auth import get_current_user
from utils.tenancy import resolve_org_id
from config import MATT_EMAIL, JARVIS_OPERATOR_EMAILS
from services.jarvis_system_prompt import SYSTEM_PROMPT
from services.jarvis_tools import TOOLS, execute_tool, get_tools_for_scope

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/jarvis", tags=["Jarvis"])
MAX_TOOL_ITERATIONS = 10


def get_jarvis_scope(user: dict) -> Optional[str]:
    role = user.get("role", "")
    email = (user.get("email") or "").lower()
    if role in ("Administrator", "Admin"):
        if MATT_EMAIL and email == MATT_EMAIL.lower():
            return "scoped_matt"
        return "full"
    if role == "Operator" and email in JARVIS_OPERATOR_EMAILS:
        return "full"
    return None


class ChatMessage(BaseModel):
    role: str
    content: str


class JarvisChatRequest(BaseModel):
    messages: List[ChatMessage]
    conversation_id: Optional[str] = None


def _sse(event_type: str, data: dict) -> str:
    return f"data: {json.dumps({'type': event_type, **data})}\n\n"


@router.get("/can-access")
async def can_access(current_user: dict = Depends(get_current_user)):
    scope = get_jarvis_scope(current_user)
    return {"allowed": scope is not None, "scope": scope}


@router.post("/chat")
async def jarvis_chat(
    body: JarvisChatRequest,
    current_user: dict = Depends(get_current_user)
):
    scope = get_jarvis_scope(current_user)
    if not scope:
        raise HTTPException(status_code=403, detail="Jarvis access denied")

    from config import ANTHROPIC_API_KEY
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="Jarvis not configured — ANTHROPIC_API_KEY missing")

    org_id = resolve_org_id(current_user)
    conversation_id = body.conversation_id or str(uuid.uuid4())
    question = body.messages[-1].content if body.messages else ""
    start_time = time.time()

    async def stream():
        import anthropic
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

        messages = [{"role": m.role, "content": m.content} for m in body.messages]
        tools = get_tools_for_scope(scope)
        tool_calls_log = []
        final_text = ""
        total_tokens = 0
        iterations = 0

        try:
            while iterations < MAX_TOOL_ITERATIONS:
                iterations += 1

                response = client.messages.create(
                    model="claude-sonnet-4-20250514",
                    max_tokens=4096,
                    temperature=0.3,
                    system=SYSTEM_PROMPT,
                    tools=tools,
                    messages=messages,
                )

                if response.usage:
                    total_tokens += response.usage.input_tokens + response.usage.output_tokens

                has_tool_use = False
                tool_use_blocks = []
                text_parts = []

                for block in response.content:
                    if block.type == "text":
                        text_parts.append(block.text)
                        yield _sse("text", {"content": block.text})
                    elif block.type == "tool_use":
                        has_tool_use = True
                        tool_use_blocks.append(block)
                        yield _sse("tool_use", {"tool": block.name, "input": block.input})

                if not has_tool_use:
                    final_text = "".join(text_parts)
                    break

                tool_results = []
                for block in tool_use_blocks:
                    result = await execute_tool(block.name, block.input, current_user, scope)
                    preview = result[:200] if len(result) > 200 else result
                    tool_calls_log.append({"name": block.name, "input": block.input, "output_preview": preview})
                    yield _sse("tool_result", {"tool": block.name, "output": preview})
                    tool_results.append({"type": "tool_result", "tool_use_id": block.id, "content": result})

                messages.append({"role": "assistant", "content": response.content})
                messages.append({"role": "user", "content": tool_results})

            duration_ms = int((time.time() - start_time) * 1000)
            yield _sse("done", {"total_tokens": total_tokens, "duration_ms": duration_ms})

            await db.jarvis_audit_log.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": current_user["id"],
                "user_email": current_user.get("email", ""),
                "user_scope": scope,
                "org_id": org_id,
                "conversation_id": conversation_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "question": question,
                "response": final_text[:2000],
                "tool_calls": tool_calls_log,
                "duration_ms": duration_ms,
                "total_tokens": total_tokens,
                "model": "claude-sonnet-4-20250514",
                "error": None,
                "channel": "web",
            })

        except Exception as e:
            logger.error("Jarvis error: %s", e)
            duration_ms = int((time.time() - start_time) * 1000)
            yield _sse("error", {"message": str(e)[:200]})
            try:
                await db.jarvis_audit_log.insert_one({
                    "id": str(uuid.uuid4()),
                    "user_id": current_user["id"],
                    "user_email": current_user.get("email", ""),
                    "user_scope": scope,
                    "org_id": org_id,
                    "conversation_id": conversation_id,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "question": question,
                    "response": "",
                    "tool_calls": tool_calls_log,
                    "duration_ms": duration_ms,
                    "total_tokens": total_tokens,
                    "model": "claude-sonnet-4-20250514",
                    "error": str(e)[:500],
                    "channel": "web",
                })
            except Exception:
                pass

    return StreamingResponse(stream(), media_type="text/event-stream")


@router.get("/audit-log")
async def get_audit_log(
    limit: int = Query(100, ge=1, le=500),
    current_user: dict = Depends(get_current_user)
):
    scope = get_jarvis_scope(current_user)
    if scope != "full":
        raise HTTPException(status_code=403, detail="Audit log access denied")
    entries = await db.jarvis_audit_log.find({}, {"_id": 0}).sort("timestamp", -1).to_list(limit)
    return entries
