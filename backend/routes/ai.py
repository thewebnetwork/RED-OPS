"""AI-powered features — brief generation, chat, summarisation."""
import json
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional

from database import db
from utils.auth import get_current_user
from utils.tenancy import resolve_org_id
from services.openai_service import generate_brief, chat_completion_stream, summarize_activity

router = APIRouter(prefix="/ai", tags=["AI"])


# ============== MODELS ==============

class BriefRequest(BaseModel):
    order_id: str

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    context: Optional[str] = None

class SummarizeRequest(BaseModel):
    order_id: str


# ============== ROUTES ==============

@router.post("/generate-brief")
async def generate_brief_endpoint(
    data: BriefRequest,
    current_user: dict = Depends(get_current_user),
):
    """Generate an AI creative brief from an order."""
    org_id = resolve_org_id(current_user)

    order = await db.orders.find_one({"id": data.order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # RBAC: requester, assigned editor, or admin
    allowed_ids = [order.get("requester_id"), order.get("editor_id")]
    if current_user["id"] not in allowed_ids and current_user.get("role") not in ["Administrator", "Operator"]:
        raise HTTPException(status_code=403, detail="Access denied")

    try:
        brief = await generate_brief(order, org_id)
        return {"brief": brief, "order_id": data.order_id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")


@router.post("/chat")
async def chat_endpoint(
    data: ChatRequest,
    current_user: dict = Depends(get_current_user),
):
    """Streaming AI chat."""
    org_id = resolve_org_id(current_user)

    messages = [
        {"role": "system", "content": (
            "You are an AI assistant for Red Ops, a digital marketing operations platform. "
            "Help users with tasks, projects, creative briefs, and workflow questions. "
            "Be concise, professional, and helpful."
        )},
    ]
    if data.context:
        messages.append({"role": "system", "content": f"Context: {data.context}"})

    for msg in data.messages:
        messages.append({"role": msg.role, "content": msg.content})

    async def event_stream():
        try:
            async for chunk in chat_completion_stream(messages, org_id):
                yield f"data: {json.dumps({'content': chunk})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


@router.post("/summarize")
async def summarize_endpoint(
    data: SummarizeRequest,
    current_user: dict = Depends(get_current_user),
):
    """Summarize order activity timeline."""
    org_id = resolve_org_id(current_user)

    order = await db.orders.find_one({"id": data.order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    allowed_ids = [order.get("requester_id"), order.get("editor_id")]
    if current_user["id"] not in allowed_ids and current_user.get("role") not in ["Administrator", "Operator"]:
        raise HTTPException(status_code=403, detail="Access denied")

    # Gather activity
    messages = await db.order_messages.find(
        {"order_id": data.order_id}, {"_id": 0}
    ).sort("created_at", -1).limit(20).to_list(20)

    if not messages:
        return {"summary": "No activity recorded for this order yet.", "order_id": data.order_id}

    activity_text = "\n".join(
        f"- {m.get('created_at', '?')}: {m.get('sender_name', 'Unknown')} — {m.get('message', '')[:150]}"
        for m in messages
    )

    try:
        summary = await summarize_activity(activity_text, org_id)
        return {"summary": summary, "order_id": data.order_id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Summarization failed: {str(e)}")
