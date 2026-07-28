# Event Sourcing Design

## Overview

PetAd uses `EventLedger` as the canonical store for new aggregate events. The existing `events`/`eventLog` table remains available for backward compatibility with existing consumers and historical records. New code must write ledger-compatible events and must not require existing rows to be rewritten before deployment.

## Canonical Event Types

Event types are grouped by aggregate and are defined in `src/events/types/event.types.ts`.

### Adoption

- `ADOPTION_REQUESTED`
- `ADOPTION_APPROVED`
- `ADOPTION_REJECTED`
- `ADOPTION_ESCROW_CREATED`
- `ADOPTION_ESCROW_FUNDED`
- `ADOPTION_COMPLETED`

### Custody

- `CUSTODY_CREATED`
- `CUSTODY_STARTED`
- `CUSTODY_COMPLETED`
- `CUSTODY_CANCELLED`
- `CUSTODY_EXTENDED`

### Pet

- `PET_LISTED`
- `PET_UPDATED`
- `PET_ADOPTED`
- `PET_CUSTODY_STARTED`
- `PET_RETURNED`
- `PET_REMOVED`

### User

- `USER_REGISTERED`
- `USER_VERIFIED`
- `USER_TRUST_UPDATED`
- `USER_BADGE_AWARDED`
- `USER_DISPUTE_OPENED`

The `EVENT_AGGREGATE_MAP` constant provides the authoritative aggregate association for every canonical event type.

## Legacy Event Mapping

The legacy table stores an entity type and event type separately. Existing values are retained as-is and are not renamed in place.

| Legacy event type | Legacy entity type | EventLedger event type | Aggregate |
|---|---|---|---|
| `USER_REGISTERED` | `USER` | `USER_REGISTERED` | `USER` |
| `PET_REGISTERED` | `PET` | `PET_LISTED` | `PET` |
| `PET_LISTED` | `PET` | `PET_LISTED` | `PET` |
| `ADOPTION_REQUESTED` | `ADOPTION` | `ADOPTION_REQUESTED` | `ADOPTION` |
| `ADOPTION_APPROVED` | `ADOPTION` | `ADOPTION_APPROVED` | `ADOPTION` |
| `ADOPTION_REJECTED` | `ADOPTION` | `ADOPTION_REJECTED` | `ADOPTION` |
| `ADOPTION_COMPLETED` | `ADOPTION` | `ADOPTION_COMPLETED` | `ADOPTION` |
| `CUSTODY_CREATED` | `CUSTODY` | `CUSTODY_CREATED` | `CUSTODY` |
| `CUSTODY_STARTED` | `CUSTODY` | `CUSTODY_STARTED` | `CUSTODY` |
| `CUSTODY_COMPLETED` | `CUSTODY` | `CUSTODY_COMPLETED` | `CUSTODY` |
| `CUSTODY_CANCELLED` | `CUSTODY` | `CUSTODY_CANCELLED` | `CUSTODY` |
| `CUSTODY_EXTENDED` | `CUSTODY` | `CUSTODY_EXTENDED` | `CUSTODY` |
| `ESCROW_CREATED` | `ESCROW` | `ADOPTION_ESCROW_CREATED` | `ADOPTION` |
| `ESCROW_FUNDED` | `ESCROW` | `ADOPTION_ESCROW_FUNDED` | `ADOPTION` |

`PET_REGISTERED` is treated as the historical name for listing a pet. Legacy escrow events require the owning workflow to identify whether the escrow belongs to an adoption or another aggregate before being projected into the ledger. The canonical event types intentionally scope escrow events to the adoption aggregate.

Legacy values not represented by the canonical event set remain readable from the old table and are not fabricated as new ledger events.

## Migration Path

Migration is incremental and does not require a destructive database migration:

1. **Deploy the canonical type definitions.** The aggregate-scoped values and their aggregate mapping are added in `src/events/types/event.types.ts`.
2. **Keep legacy reads intact.** Existing services may continue reading the old `events`/`eventLog` table. Existing Prisma enum values and rows must not be renamed or removed.
3. **Write new events to `EventLedger`.** New aggregate workflows should emit one canonical event with the aggregate type and aggregate identifier. The event payload should preserve the business data needed to rebuild the aggregate or produce projections.
4. **Backfill only when required.** Historical legacy rows may be copied to `EventLedger` with the mapping above. Backfill jobs must be idempotent and retain the original event identifier or an equivalent deduplication key.
5. **Validate projections.** Compare rebuilt aggregate state and read-model projections against the existing application state before switching reads to ledger-backed projections.
6. **Switch reads gradually.** Move individual consumers to `EventLedger` after validation. Retain the old table as a compatibility source until all consumers and operational reports have migrated.
7. **Retire legacy storage only in a later migration.** Removing the old table or its enum values is explicitly outside this change and requires a separate compatibility and data-retention decision.

## Compatibility Rules

- Do not rename or delete legacy enum values.
- Do not assume that a legacy `ESCROW` event is adoption-scoped without resolving its owning workflow.
- Use the aggregate identifier, not the legacy entity label alone, when creating ledger records.
- A legacy row should be copied at most once during backfill.
- New code should use the canonical event types and the aggregate mapping rather than introducing additional unscoped event names.
