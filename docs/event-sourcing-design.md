# Event-Sourcing Design: Append-Only Event Ledger

**Status:** Approved for implementation

## 1. Purpose

The event ledger is the authoritative, append-only history of domain facts. It records accepted state-changing actions in deterministic order so aggregate state can be rebuilt, audit history can be inspected, and event batches can be anchored to Stellar.

The existing operational `events`/`eventLog` table is not the authoritative ledger and must not be treated as one retroactively.

## 2. Immutability guarantee

Ledger events are immutable after insertion. No application service exposes an update or delete operation for ledger events, and ledger history is never rewritten to represent a later domain change. Corrections are represented by a new domain event.

Immutability is also enforced by PostgreSQL. The Prisma migration `20260728120000_enforce_event_ledger_immutability` installs a `BEFORE UPDATE OR DELETE` trigger on `"EventLedger"`. The trigger raises a PostgreSQL exception with SQLSTATE `55000` for either operation. This applies to every database role, including administrators, unless the trigger itself is deliberately removed as part of a controlled database migration.

The trigger is the final database-layer defense. Application code must continue to use inserts only when recording ledger events. A domain deletion, such as `PET_DELETED` or `USER_DELETED`, is an immutable fact in the ledger and does not delete the corresponding ledger row.

## 3. Ledger event envelope

Each event contains an immutable envelope with the following logical fields:

- `id`: globally unique event identifier.
- `aggregateType` and `aggregateId`: aggregate stream identity.
- `sequence`: one-based position within the aggregate stream.
- `eventType` and `eventVersion`: versioned event contract.
- `occurredAt` and `recordedAt`: domain and persistence timestamps.
- `actorId`, `correlationId`, and `causationId`: workflow references.
- `payload`: event-specific domain facts.
- `metadata`: non-domain context.
- `previousEventHash` and `eventHash`: hash-chain integrity fields.
- `anchorBatchId`: optional reference to an external anchoring batch.

Sensitive credentials, passwords, tokens, and payment secrets must never be written to event payloads or metadata.

## 4. Append-only write rules

1. Events are inserted only after payload validation.
2. Sequence allocation and insertion occur in one transaction.
3. Each aggregate stream starts at sequence `1` and uses a unique `(aggregateType, aggregateId, sequence)` constraint.
4. Concurrent writers serialize on the aggregate stream.
5. Existing rows are never updated or deleted.
6. A changed business state is represented by appending a new event.
7. Any attempt to update or delete a ledger row must fail with a database exception.

## 5. Replay and integrity

Aggregate state is rebuilt by reading events in sequence order and applying the relevant reducer. Replay must not depend on mutable external records. The previous-event hash and event hash provide tamper-evident linkage between events; anchoring may commit batch roots to Stellar without changing ledger rows.

## 6. Verification

The integration suite inserts or reuses an `EventLedger` record, then attempts both an `UPDATE` and a `DELETE`. Both operations are expected to reject with the immutability exception. The migration must be applied before running the integration suite:

```bash
npx prisma migrate deploy
npm run test:e2e
```
