-- Safe migration for existing inbound_asn_items rows:
-- 1) create supplier tables
-- 2) add nullable supplier_id
-- 3) backfill legacy supplier per customer
-- 4) enforce NOT NULL + new constraints

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_suppliers" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "suppliers_customer_id_is_active_idx" ON "suppliers"("customer_id", "is_active");
CREATE UNIQUE INDEX "suppliers_customer_id_code_key" ON "suppliers"("customer_id", "code");
CREATE INDEX "product_suppliers_product_id_is_active_idx" ON "product_suppliers"("product_id", "is_active");
CREATE INDEX "product_suppliers_supplier_id_is_active_idx" ON "product_suppliers"("supplier_id", "is_active");
CREATE UNIQUE INDEX "product_suppliers_product_id_supplier_id_key" ON "product_suppliers"("product_id", "supplier_id");

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_suppliers" ADD CONSTRAINT "product_suppliers_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_suppliers" ADD CONSTRAINT "product_suppliers_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add nullable first, then backfill, then set NOT NULL
ALTER TABLE "inbound_asn_items" ADD COLUMN "supplier_id" TEXT;

-- Create one fallback supplier per customer that already has ASN items
INSERT INTO "suppliers" ("id", "customer_id", "code", "name", "is_active", "created_at", "updated_at")
SELECT
  'sup-' || substr(md5(ia.customer_id || '-legacy-supplier'), 1, 28) AS id,
  ia.customer_id,
  'LEGACY',
  'Legacy Supplier',
  true,
  NOW(),
  NOW()
FROM (
  SELECT DISTINCT a.customer_id
  FROM "inbound_asn_items" i
  JOIN "inbound_asns" a ON a.id = i.inbound_asn_id
) ia
ON CONFLICT ("customer_id", "code")
DO NOTHING;

-- Backfill supplier_id in old ASN items using customer's fallback supplier
UPDATE "inbound_asn_items" i
SET "supplier_id" = s.id
FROM "inbound_asns" a
JOIN "suppliers" s
  ON s.customer_id = a.customer_id
 AND s.code = 'LEGACY'
WHERE a.id = i.inbound_asn_id
  AND i.supplier_id IS NULL;

-- Ensure product-supplier mapping exists for historical ASN pairs
INSERT INTO "product_suppliers" ("id", "product_id", "supplier_id", "is_active", "created_at", "updated_at")
SELECT
  'ps-' || substr(md5(x.product_id || ':' || x.supplier_id), 1, 29) AS id,
  x.product_id,
  x.supplier_id,
  true,
  NOW(),
  NOW()
FROM (
  SELECT DISTINCT i.product_id, i.supplier_id
  FROM "inbound_asn_items" i
  WHERE i.supplier_id IS NOT NULL
) x
ON CONFLICT ("product_id", "supplier_id")
DO UPDATE SET
  "is_active" = true,
  "updated_at" = NOW();

-- Enforce required column after backfill
ALTER TABLE "inbound_asn_items"
ALTER COLUMN "supplier_id" SET NOT NULL;

-- Replace old unique with new unique and add FK/index
DROP INDEX IF EXISTS "inbound_asn_items_inbound_asn_id_product_id_key";
CREATE INDEX "inbound_asn_items_supplier_id_idx" ON "inbound_asn_items"("supplier_id");
CREATE UNIQUE INDEX "inbound_asn_items_inbound_asn_id_product_id_supplier_id_key"
  ON "inbound_asn_items"("inbound_asn_id", "product_id", "supplier_id");
ALTER TABLE "inbound_asn_items"
ADD CONSTRAINT "inbound_asn_items_supplier_id_fkey"
FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
