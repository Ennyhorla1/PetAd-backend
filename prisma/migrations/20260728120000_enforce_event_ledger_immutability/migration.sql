-- EventLedger is an append-only event store. Existing rows must never be
-- changed or removed, regardless of the database role performing the query.
--
-- The repository currently has no earlier migration creating EventLedger, so
-- create the documented ledger table before installing the immutability
-- trigger. IF NOT EXISTS keeps this safe when the table was created by an
-- earlier deployment.
CREATE TABLE IF NOT EXISTS "EventLedger" (
  "id" TEXT PRIMARY KEY,
  "aggregateType" TEXT,
  "aggregateId" TEXT,
  "sequence" INTEGER,
  "eventType" TEXT,
  "eventVersion" INTEGER,
  "occurredAt" TIMESTAMPTZ,
  "recordedAt" TIMESTAMPTZ,
  "actorId" TEXT,
  "correlationId" TEXT,
  "causationId" TEXT,
  "payload" JSONB,
  "metadata" JSONB,
  "previousEventHash" TEXT,
  "eventHash" TEXT,
  "anchorBatchId" TEXT
);

CREATE OR REPLACE FUNCTION "EventLedger_reject_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'EventLedger is immutable: % operations are not permitted', TG_OP
    USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS "EventLedger_immutable_update_delete" ON "EventLedger";

CREATE TRIGGER "EventLedger_immutable_update_delete"
BEFORE UPDATE OR DELETE ON "EventLedger"
FOR EACH ROW
EXECUTE FUNCTION "EventLedger_reject_mutation"();
