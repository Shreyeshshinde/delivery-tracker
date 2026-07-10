import uuid
import asyncio

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.core.config import settings
from app.models.notification_log import NotificationLog, NotificationStatus
from app.models.order import Order
from app.models.user import User
from app.workers.celery_app import celery_app


async def _send_sms_async(notification_log_id: str) -> None:
    engine = create_async_engine(settings.DATABASE_URL)
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False)

    try:
        async with SessionLocal() as db:
            log = await db.get(NotificationLog, uuid.UUID(notification_log_id))
            if log is None:
                return

            order = await db.get(Order, log.order_id)
            customer = await db.get(User, order.customer_id)

            message = f"Order update: {order.current_status.value}. Charge: {order.charge}"

            try:
                if settings.TWILIO_ACCOUNT_SID:
                    from twilio.rest import Client
                    client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
                    client.messages.create(
                        body=message, from_=settings.TWILIO_FROM_NUMBER, to=customer.phone
                    )
                else:
                    print(f"[SIMULATED SMS] to={customer.phone} body={message!r}")

                log.status = NotificationStatus.SENT
                log.attempts += 1
            except Exception:
                log.status = NotificationStatus.FAILED
                log.attempts += 1
                await db.commit()
                raise

            await db.commit()
    finally:
        await engine.dispose()


@celery_app.task(bind=True, max_retries=3, default_retry_delay=30)
def send_sms_task(self, notification_log_id: str):
    try:
        asyncio.run(_send_sms_async(notification_log_id))
    except Exception as exc:
        raise self.retry(exc=exc)