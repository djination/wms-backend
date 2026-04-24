-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('SHARED', 'DEDICATED');

-- CreateEnum
CREATE TYPE "WarehouseType" AS ENUM ('SHARED', 'DEDICATED');

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CustomerType" NOT NULL DEFAULT 'SHARED',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operator_companies" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operator_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "WarehouseType" NOT NULL DEFAULT 'SHARED',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "customer_id" TEXT,
    "owner_company_id" TEXT NOT NULL,
    "operator_company_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_code_key" ON "customers"("code");

-- CreateIndex
CREATE INDEX "customers_is_active_idx" ON "customers"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "operator_companies_code_key" ON "operator_companies"("code");

-- CreateIndex
CREATE INDEX "operator_companies_is_active_idx" ON "operator_companies"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_code_key" ON "warehouses"("code");

-- CreateIndex
CREATE INDEX "warehouses_customer_id_idx" ON "warehouses"("customer_id");

-- CreateIndex
CREATE INDEX "warehouses_owner_company_id_idx" ON "warehouses"("owner_company_id");

-- CreateIndex
CREATE INDEX "warehouses_operator_company_id_idx" ON "warehouses"("operator_company_id");

-- CreateIndex
CREATE INDEX "warehouses_is_active_idx" ON "warehouses"("is_active");

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_owner_company_id_fkey" FOREIGN KEY ("owner_company_id") REFERENCES "operator_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_operator_company_id_fkey" FOREIGN KEY ("operator_company_id") REFERENCES "operator_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
