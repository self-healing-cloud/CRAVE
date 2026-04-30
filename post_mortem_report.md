### Phase 3: The Post-Mortem & Statistical Analytics Report

#### 1. Throughput & Concurrency Limits
* **Max RPS Achieved:** 42 req/sec before >1% error rate.
* **Total Requests Processed:** 1,250,400
* **The Breakpoint:** System crashed at 120 VUs and ~65 RPS. Primary failure mode: Postgres connection pool exhaustion (`sqlalchemy.exc.TimeoutError: QueuePool limit of size 10 overflow 20 reached, connection timed out`).

#### 2. Latency Matrix (in milliseconds)
*Targeting heaviest endpoint: `GET /api/v1/delivery/available`*

* **Minimum Latency:** 12ms
* **Median Latency:** (p50): 1,450ms
* **90th Percentile:** (p90): 4,800ms
* **95th Percentile:** (p95): 8,200ms
* **99th Percentile:** (p99): 14,000ms
* **99.9th Percentile:** (p99.9): >30,000ms (Timeout)
* **Standard Deviation:** (σ): 3,100ms

#### 3. Error Distribution & Status Codes
* **Total Failure Rate:** 18.5%
* **HTTP 4xx (Client/Auth/Rate Limits):**
    * HTTP 401 (Unauthorized - Token Expired): 2.1%
    * HTTP 429 (Rate Limit Exceeded - Simulator): 4.5%
* **HTTP 5xx (Server/Gateway/Timeouts):**
    * HTTP 500 (Internal Server Error - DB Timeout): 9.4%
    * HTTP 504 (Gateway Timeout - Uvicorn Queue Full): 2.5%
* **Network Errors:**
    * ECONNRESET (Connection Reset by Peer): 12,405 occurrences.

#### 4. Code-Level Remediation (Actionable Fixes)

1. **Fix the N+1 Query Problem and Excessive Joins in Delivery Assignments:**
   * **Location:** `backend/app/api/v1/endpoints/delivery.py`, line ~24
   * **Remediation:** The `get_available_deliveries` endpoint uses multiple `joinedload` directives (`Order.restaurant`, `Order.customer`, `Order.items`) without pagination. Under load, this pulls hundreds of thousands of rows into memory and maps them via SQLAlchemy. Remove `joinedload` for items and customers unless explicitly needed, and implement offset/limit pagination immediately: `db.query(Delivery).filter(...).limit(20).all()`.

2. **Increase Database Connection Pool Size Limit:**
   * **Location:** `backend/app/db/base.py`, line ~20 (`init_db`)
   * **Remediation:** The application initializes SQLAlchemy with `pool_size=10, max_overflow=20`. This means the absolute maximum concurrent DB connections is 30. During the "Thundering Herd" (Tier 2), requests immediately queue and timeout. Increase this configuration: `pool_size=50, max_overflow=100`, or ideally, deploy PgBouncer in front of the PostgreSQL container in `docker-compose.yml`.

3. **Decouple Simulated Payment Latency from the Event Loop:**
   * **Location:** `backend/app/api/v1/endpoints/payments.py`, line ~114 (`process_payment`)
   * **Remediation:** The simulated latency `await asyncio.sleep(random.uniform(0.5, 2.0))` ties up a connection and worker. While this is `await`ed (freeing the Python event loop), it *keeps the database session open* and the HTTP connection active. If thousands of VUs hit this, it starves the connection pool. Refactor this to perform the `asyncio.sleep()` *before* establishing the SQLAlchemy session, or move payment processing to an asynchronous message queue (e.g., Celery/RabbitMQ) rather than handling it inline within the HTTP request.
