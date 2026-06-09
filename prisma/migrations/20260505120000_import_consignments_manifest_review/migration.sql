-- Manifest review (transit import) + import consignment header

CREATE TYPE "ManifestReviewStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'MATCHED', 'DISCREPANCY', 'WAIVED');
CREATE TYPE "ManifestFindingCategory" AS ENUM ('QTY', 'WEIGHT', 'DESCRIPTION', 'PARTY', 'DOC_MISSING', 'OTHER');

ALTER TABLE "warehouses" ADD COLUMN "require_manifest_review_gate" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "import_consignments" (
    "id" TEXT NOT NULL,
    "consignment_no" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "master_ref" VARCHAR(120),
    "awb_mawb" VARCHAR(64),
    "awb_hawb" VARCHAR(64),
    "awb_carrier" VARCHAR(120),
    "awb_flight" VARCHAR(120),
    "awb_origin" VARCHAR(16),
    "awb_destination" VARCHAR(16),
    "awb_shipper" VARCHAR(255),
    "awb_consignee" VARCHAR(255),
    "awb_pieces" INTEGER,
    "awb_gross_weight_kg" DECIMAL(18,4),
    "awb_chargeable_weight_kg" DECIMAL(18,4),
    "awb_nature_of_goods" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_consignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "import_consignments_consignment_no_key" ON "import_consignments"("consignment_no");
CREATE INDEX "import_consignments_customer_id_idx" ON "import_consignments"("customer_id");
CREATE INDEX "import_consignments_warehouse_id_idx" ON "import_consignments"("warehouse_id");

CREATE TABLE "import_consignment_asns" (
    "import_consignment_id" TEXT NOT NULL,
    "inbound_asn_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_consignment_asns_pkey" PRIMARY KEY ("import_consignment_id","inbound_asn_id")
);

CREATE UNIQUE INDEX "import_consignment_asns_inbound_asn_id_key" ON "import_consignment_asns"("inbound_asn_id");
CREATE INDEX "import_consignment_asns_inbound_asn_id_idx" ON "import_consignment_asns"("inbound_asn_id");

CREATE TABLE "manifest_reviews" (
    "id" TEXT NOT NULL,
    "import_consignment_id" TEXT NOT NULL,
    "status" "ManifestReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by_id" TEXT,
    "waived_reason" TEXT,
    "waived_at" TIMESTAMP(3),
    "waived_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manifest_reviews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "manifest_reviews_import_consignment_id_key" ON "manifest_reviews"("import_consignment_id");
CREATE INDEX "manifest_reviews_status_idx" ON "manifest_reviews"("status");

CREATE TABLE "manifest_review_findings" (
    "id" TEXT NOT NULL,
    "manifest_review_id" TEXT NOT NULL,
    "category" "ManifestFindingCategory" NOT NULL,
    "message" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manifest_review_findings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "manifest_review_findings_manifest_review_id_idx" ON "manifest_review_findings"("manifest_review_id");

ALTER TABLE "import_consignments" ADD CONSTRAINT "import_consignments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "import_consignments" ADD CONSTRAINT "import_consignments_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "import_consignment_asns" ADD CONSTRAINT "import_consignment_asns_import_consignment_id_fkey" FOREIGN KEY ("import_consignment_id") REFERENCES "import_consignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "import_consignment_asns" ADD CONSTRAINT "import_consignment_asns_inbound_asn_id_fkey" FOREIGN KEY ("inbound_asn_id") REFERENCES "inbound_asns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "manifest_reviews" ADD CONSTRAINT "manifest_reviews_import_consignment_id_fkey" FOREIGN KEY ("import_consignment_id") REFERENCES "import_consignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "manifest_reviews" ADD CONSTRAINT "manifest_reviews_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "manifest_reviews" ADD CONSTRAINT "manifest_reviews_waived_by_id_fkey" FOREIGN KEY ("waived_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "manifest_review_findings" ADD CONSTRAINT "manifest_review_findings_manifest_review_id_fkey" FOREIGN KEY ("manifest_review_id") REFERENCES "manifest_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
