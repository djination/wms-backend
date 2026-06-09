CREATE TYPE "ImportConsignmentDocType" AS ENUM ('AWB', 'COMMERCIAL_INVOICE', 'PACKING_LIST', 'BL', 'OTHER');

CREATE TABLE "import_consignment_documents" (
    "id" TEXT NOT NULL,
    "import_consignment_id" TEXT NOT NULL,
    "doc_type" "ImportConsignmentDocType" NOT NULL,
    "original_file_name" VARCHAR(500) NOT NULL,
    "storage_key" VARCHAR(500) NOT NULL,
    "content_type" VARCHAR(120),
    "uploaded_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_consignment_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "import_consignment_documents_import_consignment_id_idx" ON "import_consignment_documents"("import_consignment_id");

ALTER TABLE "import_consignment_documents" ADD CONSTRAINT "import_consignment_documents_import_consignment_id_fkey" FOREIGN KEY ("import_consignment_id") REFERENCES "import_consignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "import_consignment_documents" ADD CONSTRAINT "import_consignment_documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
