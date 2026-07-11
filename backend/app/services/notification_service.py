from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification_log import NotificationLog, NotificationChannel
from app.models.order import Order
from app.workers.tasks.send_email import send_email_task
from app.workers.tasks.send_sms import send_sms_task


async def enqueue_notification(db: AsyncSession, order: Order) -> None:
    """
    Writes a NotificationLog row for each channel, then hands off to Celery.
    This is the decoupling point: the API request that changed the order's
    status commits and returns immediately — sending the actual email/SMS
    (and any retries on failure) happens on a worker process, not here.
    """
    email_log = NotificationLog(order_id=order.id, channel=NotificationChannel.EMAIL)
    sms_log = NotificationLog(order_id=order.id, channel=NotificationChannel.SMS)
    db.add(email_log)
    db.add(sms_log)
    await db.flush()  # get their ids before dispatching

    send_email_task.delay(str(email_log.id))
    send_sms_task.delay(str(sms_log.id))