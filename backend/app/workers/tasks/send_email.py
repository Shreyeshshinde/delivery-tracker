import smtplib
import uuid
from email.mime.text import MIMEText

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
import asyncio

from app.core.config import settings
from app.models.notification_log import NotificationLog, NotificationStatus
from app.models.order import Order
from app.models.user import User
from app.workers.celery_app import celery_app


async def _send_email_async(notification_log_id: str) -> None:
    # Fresh engine per task run — Celery gives every task call its own
    # event loop via asyncio.run(), and asyncpg connections are bound to
    # the loop that created them. Reusing the app-wide engine here caused
    # connections from a previous (now-closed) loop to be reused and fail.
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

            print(
                f"[EMAIL TASK] SMTP_HOST={settings.SMTP_HOST!r} "
                f"SMTP_USER={settings.SMTP_USER!r} "
                f"SMTP_FROM={settings.SMTP_FROM!r} "
                f"to={customer.email}"
            )

            try:
                if settings.SMTP_HOST:
                    print(f"[REAL SEND ATTEMPT] connecting to {settings.SMTP_HOST}:{settings.SMTP_PORT}")

                    msg = MIMEText(body)
                    msg["Subject"] = subject
                    msg["From"] = settings.SMTP_FROM
                    msg["To"] = customer.email

                    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
                        server.starttls()
                        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                        server.send_message(msg)

                    print(f"[REAL SEND SUCCESS] to={customer.email}")
                else:
                    print(f"[SIMULATED EMAIL] SMTP_HOST is empty, to={customer.email} subject={subject!r}")

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