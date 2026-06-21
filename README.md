# Bulk Action Platform

A production-grade system for running large-scale async data operations (bulk updates, bulk deletes, etc.) on CRM entities — backed by PostgreSQL, MongoDB, Redis, and BullMQ.

---

## Table of Contents

- [High Level Design (HLD)](#high-level-design)
- [Low Level Design (LLD)](#low-level-design)
- [API Reference](#api-reference)
- [Mode A vs Mode B](#mode-a-vs-mode-b)
- [Optimistic Locking](#optimistic-locking)
- [Key Trade-offs](#key-trade-offs)
- [Running Locally](#running-locally)

---

## High Level Design

```
                         ┌──────────────────┐
                         │   REST API        │
                         │  (Express)        │
                         └────────┬─────────┘
                                  │ POST /bulk-actions
                                  ▼
                         ┌──────────────────┐
                         │  Coordinator     │
                         │  Queue (BullMQ)  │
                         └────────┬─────────┘
                                  │ 1 job per bulk action
                                  ▼
                    ┌─────────────────────────────┐
                    │       Coordinator Worker     │
                    │  - cursor-paginate Postgres  │
                    │    OR split entityIds        │
                    │  - enqueue batch jobs        │
                    └─────────────┬───────────────┘
                                  │ N batch jobs (500 entities each)
                                  ▼
                    ┌─────────────────────────────┐
                    │       Batch Queue (BullMQ)   │
                    └─────────────┬───────────────┘
                                  │
               ┌──────────────────┼──────────────────┐
               ▼                  ▼                   ▼
        Batch Worker        Batch Worker        Batch Worker
        (concurrency=10)    (concurrency=10)    (concurrency=10)
               │
               ├─ Rate limit check (Redis Lua — atomic)
               ├─ Validate + update entities (PostgreSQL)
               ├─ Write logs (MongoDB)
               └─ Update progress counters (Redis)
                                  │
                    ┌─────────────┴───────────────┐
                    │       Flush Worker           │
                    │  (setInterval 10s)           │
                    │  Redis counters → PostgreSQL  │
                    └─────────────────────────────┘
```

### Data Stores

| Store | What it holds |
|-------|--------------|
| **PostgreSQL** | Bulk action records, contact/entity data, cursor checkpoints |
| **Redis** | Live progress counters, rate limit counters, BullMQ job queues |
| **MongoDB** | Per-entity audit logs (success/failure/skipped per row) |

---

## Low Level Design

### Database Schema

**`bulk_actions` (PostgreSQL)**
```sql
id             UUID  PRIMARY KEY
account_id     UUID  FK → accounts
entity_type    VARCHAR(50)           -- 'contact', 'deal', ...
action_type    VARCHAR(50)           -- 'bulk_update'
status         VARCHAR(50)           -- queued | scheduled | processing | completed | failed
filters        JSONB                 -- Mode A: filter criteria
payload        JSONB                 -- fields to write
priority       INTEGER  DEFAULT 5
total_count    INTEGER  DEFAULT 0
success_count  INTEGER  DEFAULT 0
failure_count  INTEGER  DEFAULT 0
skipped_count  INTEGER  DEFAULT 0
last_cursor    UUID                  -- crash recovery: resume from here
batches_enqueued INTEGER DEFAULT 0
scheduled_at   TIMESTAMP
started_at     TIMESTAMP
completed_at   TIMESTAMP
error_message  TEXT                  -- populated on failure
created_at     TIMESTAMP
```

**`contacts` (PostgreSQL)**
```sql
id          UUID  PRIMARY KEY
account_id  UUID  FK → accounts
email       VARCHAR  UNIQUE
name        VARCHAR
status      VARCHAR
age         INTEGER
metadata    JSONB
updated_at  TIMESTAMP                -- used for optimistic locking
```

**`BulkActionLog` (MongoDB)**
```js
{
  bulkActionId: String,   // FK → bulk_actions.id
  entityId:     String,
  entityType:   String,
  status:       'success' | 'failure' | 'skipped',
  errorMessage: String,
  processedAt:  Date,
  metadata:     Mixed     // e.g. { email: 'x@y.com' } per entity type
}
// Indexes: { bulkActionId, status } and { bulkActionId, processedAt }
```

### Redis Key Space

```
coordinator:<bulkActionId>      BullMQ coordinator job
batch:<bulkActionId>_batch_N    BullMQ batch jobs

progress:<id>:total             total entity count
progress:<id>:processed         how many batches finished
progress:<id>:success           success count
progress:<id>:failure           failure count
progress:<id>:skipped           skipped count

rate:<accountId>                rolling counter (TTL=60s)
```

### Request → Completion Flow

```
1. POST /bulk-actions
   → validate (Joi)
   → insert bulk_actions row (status=queued)
   → enqueue coordinator job (with optional delay for scheduledAt)
   → return { id, status, scheduledAt }

2. Coordinator worker picks up job
   → updateStatus → 'processing'
   → Mode A: cursor-paginate Postgres, enqueue 1 batch per 500 rows
   → Mode B: SQL countByIds for totalCount, Set-dedupe for batch chunks
   → save last_cursor after each page (crash recovery)
   → progressService.init(total)
   → batchQueue.addBulk(all batch jobs)

3. Batch workers (concurrency=10 each) pick up batch jobs
   → fetchByIds from Postgres
   → rateLimitService.consume() — atomic Lua check+increment
   → validate each entity (contact validator)
   → handler.execute() — updateById with optimistic lock
   → saveLogs to MongoDB
   → progressService.increment(results)
   → if processed >= total: flush Redis → Postgres, mark completed

4. Flush worker (every 10s)
   → findStuck() — all status='processing' rows
   → sync Redis counters → Postgres (crash safety)

5. GET /bulk-actions/:id
   → reads live Redis counters if status=processing
   → skips Redis for completed/failed (keys cleaned up)
   → returns progressPercent, counts, errorMessage
```

### Crash Recovery

If the coordinator crashes mid-pagination, `last_cursor` and `batches_enqueued` are saved in Postgres after every page. On restart, the coordinator re-reads the checkpoint and resumes from `last_cursor` instead of restarting from the beginning.

If a batch worker crashes mid-batch, BullMQ retries the job up to 3 times with exponential backoff (60s, 120s). After all retries exhausted, the bulk action is marked `failed` with the error message stored.

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/bulk-actions` | Create a new bulk action |
| `GET` | `/bulk-actions?accountId=&status=&page=&limit=` | List actions (max limit=100) |
| `GET` | `/bulk-actions/:id` | Live progress + status |
| `GET` | `/bulk-actions/:id/stats` | Final counts + duration |
| `GET` | `/bulk-actions/:id/logs?status=&page=&limit=` | Per-entity audit logs (max limit=200) |

**Create payload**
```json
{
  "accountId":   "uuid",
  "entityType":  "contact",
  "actionType":  "bulk_update",
  "filters":     { "status": "inactive" },
  "payload":     { "fields": { "status": "active" } },
  "priority":    5,
  "scheduledAt": "2025-01-01T09:00:00Z"
}
```
Either `filters` (Mode A) or `entityIds` (Mode B) is required — not both.

---

## Mode A vs Mode B

### Mode A — Filter-based (unlimited scale)

Use when the caller wants to target a dynamic set defined by criteria.

```json
{ "filters": { "status": "inactive", "age": 25 } }
```

- Coordinator cursor-paginates Postgres: `WHERE id > cursor ORDER BY id LIMIT 500`
- No upper bound on record count — works for millions of rows
- Cursor checkpoint written after each page → safe to crash and resume
- `totalCount` is accumulated as pages are fetched

**Why cursor, not OFFSET?**  
`OFFSET N` re-scans N rows every page. At page 200 (row 100,000) it's reading 100,000 rows to discard them. `WHERE id > cursor` uses the primary key index and is O(1) regardless of depth.

### Mode B — Explicit IDs (capped at 1000)

Use when the UI lets a user cherry-pick specific records.

```json
{ "entityIds": ["uuid1", "uuid2", "uuid3"] }
```

- `totalCount` = `SQL COUNT(*) WHERE id IN (...)` — only counts rows that actually exist in the DB. Handles duplicates and non-existent IDs correctly.
- Batching uses `[...new Set(entityIds)]` to avoid duplicate SQL fetches
- **Hard cap: 1000 IDs**

**Why 1000?**

In real-world CRM UIs, users select records from a paginated table. Even with "select all on page" or shift-click, selecting more than 1000 records is physically impractical — most product pages show 20–100 rows. The 1000 cap:
- Keeps the JSON request body small (UUIDs are 36 chars each → ~36KB at 1000)
- Prevents the coordinator from loading a massive ID array into Node.js memory
- Forces callers with millions of targets to use Mode A (filters), which is the right tool for that scale

---

## Optimistic Locking

The system supports multiple concurrent bulk actions on the same entity set. Without any locking, two actions running simultaneously would both write the same entity — the last writer wins and one write is silently lost.

**How it works:**

Every batch job carries `bulkActionStartedAt` — the timestamp when the coordinator started processing. The `updateById` query adds a time guard:

```sql
UPDATE contacts
SET    status = 'active', updated_at = NOW()
WHERE  id = $1
AND    updated_at < $2   -- $2 = bulkActionStartedAt + 1ms
```

- If the row's `updated_at` is older than when this bulk action started → it hasn't been touched by another bulk action yet → we update it → `status: 'success'`
- If another bulk action already updated the row (its `updated_at` is newer) → our WHERE returns 0 rows → `status: 'skipped'`

This means the first bulk action to reach a given entity wins. Subsequent actions skip it cleanly with a `skipped` log entry rather than silently overwriting or erroring.

**Why optimistic and not pessimistic (row locks)?**

Pessimistic locking (`SELECT FOR UPDATE`) holds a lock for the full duration of the batch. At 500 entities per batch with network + validation overhead, this would serialize work and create long lock queues. Optimistic locking adds zero lock contention — it's just a compare-and-swap at write time.

---

## Key Trade-offs

### 1. Two-queue fan-out vs single queue

**Decision:** Coordinator queue → Batch queue (two separate queues)

**Trade-off:** Extra complexity (two worker types to operate) vs parallelism.  
A single queue would process one entity at a time. With fan-out, a 1M-row action splits into 2000 batch jobs that run across all available batch workers simultaneously. The coordinator is cheap (cursor pagination + enqueue) — the expensive work (DB writes, validation, MongoDB inserts) is fully parallelized.

### 2. Redis for live progress, not Postgres

**Decision:** `INCRBY` in Redis during processing; flush to Postgres every 10s and on completion.

**Trade-off:** Risk of losing last 10s of counts on crash vs avoiding 500 concurrent `UPDATE bulk_actions SET processed=processed+1` writes to Postgres.  
At batch concurrency=10 with 500 entities/batch, that's 5000 entities/sec × 1 row update each = 5000 UPDATEs/sec to one Postgres row. That's a hot-row bottleneck. Redis `INCRBY` is atomic and sub-millisecond. The flush worker syncs every 10s; at most 10s of count data is un-flushed at crash time, which is acceptable for a progress counter.

### 3. MongoDB for audit logs, not Postgres

**Decision:** Per-entity logs (success/failure/skipped + errorMessage) go to MongoDB.

**Trade-off:** Additional dependency vs keeping Postgres lean.  
A 1M-row bulk action produces 1M log rows. Inserting 1M rows into Postgres with proper indexing strains the same DB serving the live CRM entities. MongoDB's `insertMany` with `ordered:false` is optimized for high-throughput append-only writes, and the log schema doesn't need relational joins.

### 4. Atomic Lua rate limiter

**Decision:** Single Redis `EVAL` script that checks + increments in one round-trip.

**Trade-off:** Lua complexity vs correctness.  
A two-step check-then-increment has a TOCTOU race: two concurrent batches both read `current=9900`, both see `9900+100 <= 10000`, both increment — actual total becomes 10000+100. The Lua script executes atomically on the Redis server; no other command can interleave. Also fixes the sliding-window bug: TTL is set only when the key is first created (`TTL < 0`), so the 60s window is fixed, not extended on every call.

### 5. Optimistic locking over pessimistic

See [Optimistic Locking](#optimistic-locking) above.  
**Trade-off:** Occasional `skipped` outcomes vs zero lock contention.  
In practice, two bulk actions targeting the same entity simultaneously is an edge case (users rarely run overlapping campaigns on the same records). When it does happen, one action skips the entity and logs it — the operator can see exactly which records were skipped and re-run if needed.

### 6. Cursor pagination over OFFSET

**Trade-off:** Requires a monotonic sort key (`id`) vs simpler `OFFSET` queries.  
OFFSET deteriorates linearly — page 2000 of a 1M-row table scans and discards 1M rows. Cursor pagination uses the B-tree index on `id` for every page regardless of depth. The constraint is that the sort key must be stable and indexed; `uuid` primary keys satisfy this.

### 7. BullMQ retry with exponential backoff (3×, 60s base)

**Decision:** Rate-limit errors retry up to 3 times; 60s between retries.

**Trade-off:** Delayed completion vs silent failure.  
The rate limit window is 60s. Retrying immediately would hit the same full counter. Waiting 60s gives the window time to reset. After 3 retries (~4 minutes total), the action is marked failed with the error message — the operator is notified rather than the job silently disappearing.

---

## Running Locally

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env  # fill in Postgres, Redis, MongoDB URLs

# Run migrations
npx knex migrate:latest

# Seed sample data (2000 contacts)
node src/scripts/seed.js

# Start the server + workers
node src/index.js

# Run all tests
redis-cli flushall && REDIS_URL= NODE_ENV=test npx jest --runInBand --forceExit
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_HOST` | localhost | PostgreSQL host |
| `POSTGRES_DB` | crm_bulk | Database name |
| `POSTGRES_USER` | postgres | DB user |
| `POSTGRES_PASSWORD` | postgres | DB password |
| `POSTGRES_SSL` | false | Set `true` for cloud Postgres (Aiven etc.) |
| `REDIS_URL` | — | Full Redis URL (Upstash/cloud). If unset, uses HOST/PORT |
| `REDIS_HOST` | localhost | Redis host (local only) |
| `MONGODB_URI` | mongodb://localhost:27017/crm_bulk | MongoDB connection string |
| `PORT` | 3000 | HTTP port |
