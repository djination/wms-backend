-- CreateEnum
CREATE TYPE "BillingComponent" AS ENUM ('STORAGE', 'HANDLING', 'VAS', 'DEDICATED_RESOURCE', 'FIXED_FEE');

-- CreateEnum
CREATE TYPE "BillingTransactionStatus" AS ENUM ('DRAFT', 'POSTED');

-- CreateTable
CREATE TABLE "billing_contracts" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "contract_no" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "billing_cycle_day" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_rates" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "component" "BillingComponent" NOT NULL,
    "activity_code" TEXT NOT NULL,
    "uom" TEXT NOT NULL,
    "rate" DECIMAL(18,4) NOT NULL,
    "min_charge" DECIMAL(18,4),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_transactions" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "warehouse_id" TEXT,
    "operator_company_id" TEXT,
    "component" "BillingComponent" NOT NULL,
    "activity_code" TEXT NOT NULL,
    "uom" TEXT NOT NULL,
    "qty" DECIMAL(18,4) NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "period_key" TEXT NOT NULL,
    "status" "BillingTransactionStatus" NOT NULL DEFAULT 'DRAFT',
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "billing_contracts_customer_id_is_active_idx" ON "billing_contracts"("customer_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "billing_contracts_customer_id_contract_no_key" ON "billing_contracts"("customer_id", "contract_no");

-- CreateIndex
CREATE INDEX "billing_rates_contract_id_is_active_idx" ON "billing_rates"("contract_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "billing_rates_contract_id_component_activity_code_uom_key" ON "billing_rates"("contract_id", "component", "activity_code", "uom");

-- CreateIndex
CREATE INDEX "billing_transactions_customer_id_period_key_status_idx" ON "billing_transactions"("customer_id", "period_key", "status");

-- CreateIndex
CREATE INDEX "billing_transactions_warehouse_id_idx" ON "billing_transactions"("warehouse_id");

-- CreateIndex
CREATE INDEX "billing_transactions_operator_company_id_idx" ON "billing_transactions"("operator_company_id");

-- CreateIndex
CREATE INDEX "billing_transactions_occurred_at_idx" ON "billing_transactions"("occurred_at");

-- AddForeignKey
ALTER TABLE "billing_contracts" ADD CONSTRAINT "billing_contracts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_rates" ADD CONSTRAINT "billing_rates_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "billing_contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_transactions" ADD CONSTRAINT "billing_transactions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_transactions" ADD CONSTRAINT "billing_transactions_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_transactions" ADD CONSTRAINT "billing_transactions_operator_company_id_fkey" FOREIGN KEY ("operator_company_id") REFERENCES "operator_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
