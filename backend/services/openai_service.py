"""OpenAI service — brief generation, chat, summarisation."""
import os
from typing import AsyncGenerator, Optional
from database import db


async def get_openai_key(org_id: str) -> Optional[str]:
    """Resolve OpenAI API key: integrations collection first, then env var fallback."""
    integration = await db.integrations.find_one(
        {"org_id": org_id, "provider": "openai", "status": "connected"}
    )
    if integration and integration.get("config", {}).get("api_key"):
        return integration["config"]["api_key"]
    return os.environ.get("OPENAI_API_KEY")


def _get_client(api_key: str):
    import openai
    return openai.OpenAI(api_key=api_key)


async def generate_brief(order_context: dict, org_id: str) -> str:
    """Generate a creative brief from order context."""
    api_key = await get_openai_key(org_id)
    if not api_key:
        raise ValueError("OpenAI not configured. Connect it in Settings → Integrations.")

    title = order_context.get("title", "Untitled")
    category = order_context.get("category_l2_name") or order_context.get("service_name") or "General"
    desc = order_context.get("description", "")
    script = order_context.get("video_script", "")
    refs = order_context.get("reference_links", "")
    instructions = order_context.get("special_instructions", "")

    prompt = f"""Generate a professional creative brief for this project:

Title: {title}
Category: {category}
Description: {desc}
{"Script/Copy: " + script if script else ""}
{"Reference Links: " + refs if refs else ""}
{"Special Instructions: " + instructions if instructions else ""}

Create a structured brief with:
1. Project Overview (2-3 sentences)
2. Target Audience
3. Key Messages / Talking Points
4. Deliverables & Specs
5. Success Metrics
Keep it concise and actionable."""

    client = _get_client(api_key)
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a creative strategist at a digital marketing agency. Write clear, actionable briefs."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.7,
        max_tokens=1000,
    )
    return response.choices[0].message.content


async def chat_completion_stream(messages: list, org_id: str) -> AsyncGenerator[str, None]:
    """Stream chat tokens from OpenAI."""
    api_key = await get_openai_key(org_id)
    if not api_key:
        yield "Error: OpenAI not configured. Connect it in Settings → Integrations."
        return

    client = _get_client(api_key)
    stream = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        temperature=0.7,
        stream=True,
    )
    for chunk in stream:
        delta = chunk.choices[0].delta
        if delta.content:
            yield delta.content


async def summarize_activity(activity_text: str, org_id: str) -> str:
    """Summarize order activity into bullet points."""
    api_key = await get_openai_key(org_id)
    if not api_key:
        raise ValueError("OpenAI not configured.")

    client = _get_client(api_key)
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "Summarize project activity into 3-5 concise bullet points."},
            {"role": "user", "content": f"Summarize:\n{activity_text}"},
        ],
        temperature=0.5,
        max_tokens=300,
    )
    return response.choices[0].message.content
