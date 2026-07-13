from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification_log import NotificationLog, NotificationChannel
from app.models.order import Order
from app.workers.tasks.send_email import send_email_task
from app.workers.tasks.send_sms import send_sms_task


async def enqueue_notification(db: AsyncSession, order: Order) -> None:
    email_log = NotificationLog(order_id=order.id, channel=NotificationChannel.EMAIL)
    sms_log = NotificationLog(order_id=order.id, channel=NotificationChannel.SMS)
    db.add(email_log)
    db.add(sms_log)
    await db.commit()  # must actually commit — flush alone isn't visible to
    await db.refresh(email_log)  # other connections (the worker uses a
    await db.refresh(sms_log)  # completely separate DB connection)

    send_email_task.delay(str(email_log.id))
    send_sms_task.delay(str(sms_log.id))