-- CreateEnum
CREATE TYPE "AnchorStatus" AS ENUM ('PENDING', 'SUBMITTED', 'CONFIRMED', 'FAILED');

-- CreateTable
CREATE TABLE "AnchorBatch" (
    "id" TEXT NOT NULL,
    "fromPosition" INTEGER NOT NULL,
    "toPosition" INTEGER NOT NULL,
    "leafCount" INTEGER NOT NULL,
    "merkleRoot" TEXT NOT NULL,
    "txHash" TEXT,
    "ledger" BIGINT,
    "status" "AnchorStatus" NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "network" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnchorBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnchorLeaf" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "eventLogId" TEXT NOT NULL,
    "leafIndex" INTEGER NOT NULL,
    "leafHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnchorLeaf_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "EventLog" ADD COLUMN "anchorBatchId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "AnchorBatch_fromPosition_toPosition_network_key" ON "AnchorBatch"("fromPosition", "toPosition", "network");

-- CreateIndex
CREATE UNIQUE INDEX "AnchorLeaf_batchId_leafIndex_key" ON "AnchorLeaf"("batchId", "leafIndex");

-- AddForeignKey
ALTER TABLE "EventLog" ADD CONSTRAINT "EventLog_anchorBatchId_fkey" FOREIGN KEY ("anchorBatchId") REFERENCES "AnchorBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnchorLeaf" ADD CONSTRAINT "AnchorLeaf_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "AnchorBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Immutability trigger for confirmed AnchorBatches
CREATE OR REPLACE FUNCTION check_anchor_batch_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'CONFIRMED' THEN
    RAISE EXCEPTION 'Cannot update or delete a confirmed AnchorBatch' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_anchor_batch_immutability
BEFORE UPDATE OR DELETE ON "AnchorBatch"
FOR EACH ROW
EXECUTE FUNCTION check_anchor_batch_immutability();
