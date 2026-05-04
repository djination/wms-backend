-- CreateEnum
CREATE TYPE "InboundReceiptCustomsClearanceStatus" AS ENUM ('NONE', 'HELD', 'CLEARED');

-- AlterTable
ALTER TABLE "inbound_receipts" ADD COLUMN "customs_clearance_status" "InboundReceiptCustomsClearanceStatus" NOT NULL DEFAULT 'NONE';
ALTER TABLE "inbound_receipts" ADD COLUMN "customs_hold_started_at" TIMESTAMP(3);
ALTER TABLE "inbound_receipts" ADD COLUMN "customs_released_at" TIMESTAMP(3);
ALTER TABLE "inbound_receipts" ADD COLUMN "customs_release_ref" VARCHAR(255);

-- CreateIndex
CREATE INDEX "inbound_receipts_customs_clearance_status_idx" ON "inbound_receipts"("customs_clearance_status");
