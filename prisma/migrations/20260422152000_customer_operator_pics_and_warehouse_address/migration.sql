-- AlterTable
ALTER TABLE "warehouses"
ADD COLUMN "phone" TEXT,
ADD COLUMN "address" TEXT,
ADD COLUMN "province" TEXT,
ADD COLUMN "city" TEXT,
ADD COLUMN "district" TEXT,
ADD COLUMN "subdistrict" TEXT,
ADD COLUMN "postal_code" TEXT;

-- CreateTable
CREATE TABLE "customer_pics" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_pics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operator_company_pics" (
    "id" TEXT NOT NULL,
    "operator_company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operator_company_pics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_pics_customer_id_sort_order_idx" ON "customer_pics"("customer_id", "sort_order");
CREATE INDEX "operator_company_pics_operator_company_id_sort_order_idx" ON "operator_company_pics"("operator_company_id", "sort_order");

-- AddForeignKey
ALTER TABLE "customer_pics" ADD CONSTRAINT "customer_pics_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "operator_company_pics" ADD CONSTRAINT "operator_company_pics_operator_company_id_fkey" FOREIGN KEY ("operator_company_id") REFERENCES "operator_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
