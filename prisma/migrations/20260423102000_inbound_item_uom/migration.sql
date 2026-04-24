ALTER TABLE "inbound_asn_items"
ADD COLUMN "uom_id" TEXT;

ALTER TABLE "inbound_receipts"
ADD COLUMN "uom_id" TEXT;

UPDATE "inbound_asn_items" i
SET "uom_id" = u.id
FROM (
  SELECT "id"
  FROM "unit_of_measures"
  WHERE "is_active" = true
  ORDER BY "code" ASC
  LIMIT 1
) u
WHERE i."uom_id" IS NULL;

UPDATE "inbound_receipts" r
SET "uom_id" = i."uom_id"
FROM "inbound_asn_items" i
WHERE r."inbound_item_id" = i."id"
  AND r."uom_id" IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "inbound_asn_items" WHERE "uom_id" IS NULL) THEN
    RAISE EXCEPTION 'Cannot migrate inbound_asn_items.uom_id because no active UOM exists. Create at least one UOM first.';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "inbound_receipts" WHERE "uom_id" IS NULL) THEN
    RAISE EXCEPTION 'Cannot migrate inbound_receipts.uom_id because related ASN item UOM is missing.';
  END IF;
END $$;

ALTER TABLE "inbound_asn_items"
ALTER COLUMN "uom_id" SET NOT NULL;

ALTER TABLE "inbound_receipts"
ALTER COLUMN "uom_id" SET NOT NULL;

CREATE INDEX "inbound_asn_items_uom_id_idx" ON "inbound_asn_items"("uom_id");
CREATE INDEX "inbound_receipts_uom_id_idx" ON "inbound_receipts"("uom_id");

ALTER TABLE "inbound_asn_items"
ADD CONSTRAINT "inbound_asn_items_uom_id_fkey"
FOREIGN KEY ("uom_id") REFERENCES "unit_of_measures"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inbound_receipts"
ADD CONSTRAINT "inbound_receipts_uom_id_fkey"
FOREIGN KEY ("uom_id") REFERENCES "unit_of_measures"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
