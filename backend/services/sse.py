"""In-memory Server-Sent Events pub/sub for real-time notifications."""
import asyncio
from collections import defaultdict

# user_id -> list of asyncio.Queue
_subscribers: dict[str, list[asyncio.Queue]] = defaultdict(list)


async def subscribe(user_id: str) -> asyncio.Queue:
    """Subscribe to notifications for a user. Returns an asyncio.Queue."""
    queue: asyncio.Queue = asyncio.Queue(maxsize=50)
    _subscribers[user_id].append(queue)
    return queue


def unsubscribe(user_id: str, queue: asyncio.Queue):
    """Remove a subscriber queue."""
    if user_id in _subscribers:
        try:
            _subscribers[user_id].remove(queue)
        except ValueError:
            pass
        if not _subscribers[user_id]:
            del _subscribers[user_id]


async def publish(user_id: str, event_data: dict):
    """Push a notification event to all subscribers for a user."""
    for queue in _subscribers.get(user_id, []):
        try:
            queue.put_nowait(event_data)
        except asyncio.QueueFull:
            pass  # Drop if consumer is too slow
