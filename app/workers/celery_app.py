from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "delivery_tracker",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_track_started=True,
    task_acks_late=True,  # if a worker crashes mid-send, the task isn't lost
)

# Explicit imports (not autodiscover_tasks — that's Django-style and looks
# for a single tasks.py per package, which doesn't match our layout).
# Importing these here is what actually registers the @celery_app.task
# decorated functions with this Celery instance. Safe from circular import
# because celery_app is already fully defined above by the time these
# modules import it back.
from app.workers.tasks import send_email, send_sms  # noqa: E402, F401