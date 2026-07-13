import uuid
import asyncio

import requests
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.core.config import settings
from app.models.notification_log import NotificationLog, NotificationStatus
from app.models.order import Order
from app.models.user import User
from app.workers.celery_app import celery_app


async def _send_email_async(notification_log_id: str) -> None:
    engine = create_async_engine(settings.DATABASE_URL)
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False)

    try:
        async with SessionLocal() as db:
            log = await db.get(NotificationLog, uuid.UUID(notification_log_id))
            if log is None:
                print(f"[EMAIL TASK] No NotificationLog found for id={notification_log_id}")
                return

            order = await db.get(Order, log.order_id)
            customer = await db.get(User, order.customer_id)

            subject = f"Order {order.id} — status: {order.current_status.value}"
            body = (
                f"Hi {customer.name},\n\n"
                f"Your order from {order.pickup_address} to {order.drop_address} "
                f"is now: {order.current_status.value}.\n\n"
                f"Charge: {order.charge}\n"
            )

            try:
                if settings.SMTP_PASSWORD:
                    # Using Resend's HTTP API (port 443) instead of SMTP (port 587)
                    # — Render's free tier blocks outbound SMTP ports, but HTTPS
                    # is unrestricted, so this is the reliable path for free hosting.
                    print(f"[REAL SEND ATTEMPT] via Resend API to={customer.email}")

                    response = requests.post(
                        "https://api.resend.com/emails",
                        headers={"Authorization": f"Bearer {settings.SMTP_PASSWORD}"},
                        json={
                            "from": settings.SMTP_FROM,
                            "to": [customer.email],
                            "subject": subject,
                            "text": body,
                        },
                        timeout=10,
                    )
                    response.raise_for_status()
                    print(f"[REAL SEND SUCCESS] to={customer.email} response={response.json()}")
                else:
                    print(f"[SIMULATED EMAIL] to={customer.email} subject={subject!r}")

                log.status = NotificationStatus.SENT
                log.attempts += 1
            except Exception as e:
                print(f"[EMAIL SEND FAILED] to={customer.email} error={type(e).__name__}: {e}")
                log.status = NotificationStatus.FAILED
                log.attempts += 1
                await db.commit()
                raise

            await db.commit()
    finally:
        await engine.dispose()


@celery_app.task(bind=True, max_retries=3, default_retry_delay=30)
def send_email_task(self, notification_log_id: str):
    try:
        asyncio.run(_send_email_async(notification_log_id))
    except Exception as exc:
        raise self.retry(exc=exc)