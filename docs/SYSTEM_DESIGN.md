# System Design Write-Up

## Rate Calculation Engine

The rate engine treats pricing as data, not code. Every rate — base fee and per-kilogram rate — lives in a `rate_cards` table keyed by zone pair and order type (B2B/B2C), with `effective_from`/`effective_to` dates. This means an admin can schedule a future price change by inserting a new row with a future start date, without a deploy, and historical orders remain correctly priced against whatever rate card was active when they were placed. The alternative — hardcoding rates in `if/else` branches — was rejected specifically because the spec calls for "no hardcoding," and because real logistics pricing changes far more often than application code should.

Given a package's dimensions and weight, the engine computes volumetric weight as `(L × B × H) / 5000`, then bills on `max(actual_weight, volumetric_weight)` — standard courier practice, since a large light package still occupies truck space proportional to its volume, not its mass. The billable weight is multiplied by the rate card's per-kg rate and added to the base fee. If the order is COD, a surcharge is applied — either a flat amount or a percentage of the base charge, per an admin-configurable `cod_surcharge_config` table.

Critically, the same calculation function backs both the pre-confirmation quote endpoint and the actual order-creation endpoint. The client never supplies a charge value; the server recomputes it from scratch at creation time. This closes an obvious tampering vector and guarantees the confirmed charge always matches what the customer was shown.

## Zone Detection

Zones are resolved via a `zone_pincodes` lookup table mapping individual pincodes to a zone ID, populated entirely through admin-facing endpoints. This was a deliberate scoping decision over a polygon/geo-boundary approach: pincode-to-zone mapping is fast to build, trivial for an admin to configure without GIS tooling, and matches how most real-world courier rate cards are actually structured. The zone model retains room to grow — a future version could store zone boundaries as GeoJSON polygons and resolve zones via point-in-polygon checks — but that complexity wasn't justified for this build's scope.

## Auto-Assignment Logic

Assignment answers two questions: which agents are eligible, and how do we pick one without a race condition.

Eligibility filters to agents in the order's pickup zone with `is_available = true`. Among eligible candidates, a load-balancing score favors agents with fewer active orders — a simple form of fairness that prevents one agent from being repeatedly assigned while others sit idle. The `Agent` model also carries `current_lat`/`current_lng` fields, deliberately included but not yet used in scoring; a true haversine-distance term is a natural next addition, scoped out here in favor of getting zone-based assignment correct and tested first.

The concurrency question is the more interesting engineering problem. Two orders auto-assigning simultaneously could otherwise both `SELECT` the same "available" agent before either `UPDATE` commits — a classic read-then-write race. The fix is a single atomic conditional update: `UPDATE agents SET is_available = false WHERE id = ? AND is_available = true`, checking the affected row count. If two requests race for the same agent, only one UPDATE actually matches a row; the loser's row count is zero, and the code falls through to try the next candidate rather than silently double-booking an agent. This is the detail most similar systems get wrong, since it only surfaces under concurrent load that's easy to miss in casual testing.

## Order Status Lifecycle and Failed Delivery Handling

Order status is governed by an explicit state machine (`created → assigned → picked_up → in_transit → out_for_delivery → delivered`, with `failed` and `rescheduled` as branches), rather than a free-text field any handler can overwrite. Illegal transitions — like moving a `delivered` order back to `picked_up` — are rejected with a 400 error before ever touching the database.

Every transition is also recorded as a new, immutable row in a `status_history` table: `orders.current_status` is just a cached pointer to the latest entry, never the source of truth. This gives a complete, tamper-evident audit trail (timestamp, actor, actor role, optional note) essentially for free, and both the customer-facing tracking timeline and the admin's order view simply read this table in order.

On a `failed` delivery, three things happen atomically: the status transition is recorded, the assigned agent's `is_available` flag is reset to `true` (freeing them for reassignment rather than leaving them permanently marked busy), and a notification is enqueued to the customer. The customer can then submit a reschedule request with a new date, which transitions the order to `rescheduled` and makes it eligible for auto-assignment again — closing the loop back into the same assignment engine used for new orders, rather than requiring separate reassignment logic.

Notifications throughout this lifecycle are deliberately decoupled from the request path: each status change writes a row to a `notifications_log` table and hands off to a Celery worker via Redis, rather than calling an email/SMS provider synchronously inside the API handler. This means a slow or failing third-party provider never blocks or fails an order-status update — the worker retries independently, up to three times with backoff, and its outcome is tracked per-notification rather than tied to the request's success.
