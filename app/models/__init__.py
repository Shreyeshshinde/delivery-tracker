# Import every model here so SQLAlchemy's mapper registry knows about all
# tables the moment `app.models` is imported anywhere — this is what lets
# foreign keys across model files (e.g. orders.agent_id -> agents.id)
# resolve correctly at runtime, not just during Alembic migrations.
from app.models.base import Base
from app.models.user import User
from app.models.zone import Zone, ZonePincode
from app.models.rate_card import RateCard, CODSurchargeConfig
from app.models.agent import Agent
from app.models.order import Order
from app.models.status_history import StatusHistory
from app.models.reschedule import RescheduleRequest
from app.models.notification_log import NotificationLog