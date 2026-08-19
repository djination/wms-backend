-- WMS tenant schema baseline (consolidated from prisma/migrations)
-- Regenerate: npm run flyway:baseline:build
-- Target: per-tenant schema via Flyway (-defaultSchema=tenant_<slug>)

-- === 20260107000000_init ===
-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- === 20260407054919_1st ===
-- AlterTable
ALTER TABLE "users" ALTER COLUMN "updated_at" DROP DEFAULT;

-- === 20260407060650 ===
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

-- === 20260407061220 ===
-- CreateTable
CREATE TABLE "warehouse_areas" (
    "id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_zones" (
    "id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "area_id" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_bins" (
    "id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "zone_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_bins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_balances" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "bin_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "qty_on_hand" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_balances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "warehouse_areas_warehouse_id_is_active_idx" ON "warehouse_areas"("warehouse_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_areas_warehouse_id_code_key" ON "warehouse_areas"("warehouse_id", "code");

-- CreateIndex
CREATE INDEX "warehouse_zones_area_id_idx" ON "warehouse_zones"("area_id");

-- CreateIndex
CREATE INDEX "warehouse_zones_warehouse_id_is_active_idx" ON "warehouse_zones"("warehouse_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_zones_warehouse_id_code_key" ON "warehouse_zones"("warehouse_id", "code");

-- CreateIndex
CREATE INDEX "warehouse_bins_zone_id_idx" ON "warehouse_bins"("zone_id");

-- CreateIndex
CREATE INDEX "warehouse_bins_warehouse_id_is_active_idx" ON "warehouse_bins"("warehouse_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_bins_warehouse_id_code_key" ON "warehouse_bins"("warehouse_id", "code");

-- CreateIndex
CREATE INDEX "products_customer_id_is_active_idx" ON "products"("customer_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "products_customer_id_sku_key" ON "products"("customer_id", "sku");

-- CreateIndex
CREATE INDEX "inventory_balances_warehouse_id_idx" ON "inventory_balances"("warehouse_id");

-- CreateIndex
CREATE INDEX "inventory_balances_bin_id_idx" ON "inventory_balances"("bin_id");

-- CreateIndex
CREATE INDEX "inventory_balances_product_id_idx" ON "inventory_balances"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_balances_customer_id_warehouse_id_bin_id_product__key" ON "inventory_balances"("customer_id", "warehouse_id", "bin_id", "product_id");

-- AddForeignKey
ALTER TABLE "warehouse_areas" ADD CONSTRAINT "warehouse_areas_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_zones" ADD CONSTRAINT "warehouse_zones_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_zones" ADD CONSTRAINT "warehouse_zones_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "warehouse_areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_bins" ADD CONSTRAINT "warehouse_bins_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_bins" ADD CONSTRAINT "warehouse_bins_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "warehouse_zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_bin_id_fkey" FOREIGN KEY ("bin_id") REFERENCES "warehouse_bins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- === 20260407061745_inbound ===
-- CreateEnum
CREATE TYPE "InboundAsnStatus" AS ENUM ('DRAFT', 'RECEIVING', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "inbound_asns" (
    "id" TEXT NOT NULL,
    "asn_no" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "reference_no" TEXT,
    "status" "InboundAsnStatus" NOT NULL DEFAULT 'DRAFT',
    "expected_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inbound_asns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbound_asn_items" (
    "id" TEXT NOT NULL,
    "inbound_asn_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "qty_expected" DECIMAL(18,4) NOT NULL,
    "qty_received" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inbound_asn_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbound_receipts" (
    "id" TEXT NOT NULL,
    "inbound_asn_id" TEXT NOT NULL,
    "inbound_item_id" TEXT,
    "customer_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "bin_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "qty_received" DECIMAL(18,4) NOT NULL,
    "note" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inbound_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inbound_asns_asn_no_key" ON "inbound_asns"("asn_no");

-- CreateIndex
CREATE INDEX "inbound_asns_customer_id_idx" ON "inbound_asns"("customer_id");

-- CreateIndex
CREATE INDEX "inbound_asns_warehouse_id_idx" ON "inbound_asns"("warehouse_id");

-- CreateIndex
CREATE INDEX "inbound_asns_status_idx" ON "inbound_asns"("status");

-- CreateIndex
CREATE INDEX "inbound_asn_items_product_id_idx" ON "inbound_asn_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "inbound_asn_items_inbound_asn_id_product_id_key" ON "inbound_asn_items"("inbound_asn_id", "product_id");

-- CreateIndex
CREATE INDEX "inbound_receipts_inbound_asn_id_idx" ON "inbound_receipts"("inbound_asn_id");

-- CreateIndex
CREATE INDEX "inbound_receipts_customer_id_idx" ON "inbound_receipts"("customer_id");

-- CreateIndex
CREATE INDEX "inbound_receipts_warehouse_id_idx" ON "inbound_receipts"("warehouse_id");

-- CreateIndex
CREATE INDEX "inbound_receipts_bin_id_idx" ON "inbound_receipts"("bin_id");

-- CreateIndex
CREATE INDEX "inbound_receipts_product_id_idx" ON "inbound_receipts"("product_id");

-- AddForeignKey
ALTER TABLE "inbound_asns" ADD CONSTRAINT "inbound_asns_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_asns" ADD CONSTRAINT "inbound_asns_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_asn_items" ADD CONSTRAINT "inbound_asn_items_inbound_asn_id_fkey" FOREIGN KEY ("inbound_asn_id") REFERENCES "inbound_asns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_asn_items" ADD CONSTRAINT "inbound_asn_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_receipts" ADD CONSTRAINT "inbound_receipts_inbound_asn_id_fkey" FOREIGN KEY ("inbound_asn_id") REFERENCES "inbound_asns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_receipts" ADD CONSTRAINT "inbound_receipts_inbound_item_id_fkey" FOREIGN KEY ("inbound_item_id") REFERENCES "inbound_asn_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_receipts" ADD CONSTRAINT "inbound_receipts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_receipts" ADD CONSTRAINT "inbound_receipts_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_receipts" ADD CONSTRAINT "inbound_receipts_bin_id_fkey" FOREIGN KEY ("bin_id") REFERENCES "warehouse_bins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_receipts" ADD CONSTRAINT "inbound_receipts_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- === 20260407093240_rolemanagement ===
-- CreateEnum
CREATE TYPE "RoleScope" AS ENUM ('SYSTEM', 'OPERATIONAL');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scope" "RoleScope" NOT NULL DEFAULT 'OPERATIONAL',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menus" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT,
    "icon" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "parent_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_menus" (
    "id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "menu_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_menus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE INDEX "roles_is_active_idx" ON "roles"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "menus_code_key" ON "menus"("code");

-- CreateIndex
CREATE INDEX "menus_parent_id_sort_order_idx" ON "menus"("parent_id", "sort_order");

-- CreateIndex
CREATE INDEX "menus_is_active_idx" ON "menus"("is_active");

-- CreateIndex
CREATE INDEX "user_roles_role_id_idx" ON "user_roles"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_id_key" ON "user_roles"("user_id", "role_id");

-- CreateIndex
CREATE INDEX "role_menus_menu_id_idx" ON "role_menus"("menu_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_menus_role_id_menu_id_key" ON "role_menus"("role_id", "menu_id");

-- CreateIndex
CREATE INDEX "users_is_active_idx" ON "users"("is_active");

-- AddForeignKey
ALTER TABLE "menus" ADD CONSTRAINT "menus_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "menus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_menus" ADD CONSTRAINT "role_menus_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_menus" ADD CONSTRAINT "role_menus_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "menus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- === 20260410092505_add_billing_foundation ===
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

-- === 20260410093020_add_outbound_foundation ===
-- CreateEnum
CREATE TYPE "SalesOrderStatus" AS ENUM ('DRAFT', 'RELEASED', 'PICKING', 'PACKING', 'SHIPPED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OutboundTaskType" AS ENUM ('PICKING', 'PACKING', 'LOADING');

-- CreateEnum
CREATE TYPE "OutboundTaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateTable
CREATE TABLE "sales_orders" (
    "id" TEXT NOT NULL,
    "order_no" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "consignee_name" TEXT,
    "reference_no" TEXT,
    "status" "SalesOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "requested_at" TIMESTAMP(3),
    "shipped_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_order_items" (
    "id" TEXT NOT NULL,
    "sales_order_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "qty_ordered" DECIMAL(18,4) NOT NULL,
    "qty_picked" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "qty_packed" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "qty_shipped" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbound_waves" (
    "id" TEXT NOT NULL,
    "wave_no" TEXT NOT NULL,
    "sales_order_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "planned_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbound_waves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbound_tasks" (
    "id" TEXT NOT NULL,
    "sales_order_id" TEXT NOT NULL,
    "sales_order_item_id" TEXT NOT NULL,
    "wave_id" TEXT,
    "warehouse_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "source_bin_id" TEXT,
    "task_type" "OutboundTaskType" NOT NULL,
    "status" "OutboundTaskStatus" NOT NULL DEFAULT 'OPEN',
    "qty_task" DECIMAL(18,4) NOT NULL,
    "qty_done" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "assigned_to" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbound_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sales_orders_order_no_key" ON "sales_orders"("order_no");

-- CreateIndex
CREATE INDEX "sales_orders_customer_id_status_idx" ON "sales_orders"("customer_id", "status");

-- CreateIndex
CREATE INDEX "sales_orders_warehouse_id_status_idx" ON "sales_orders"("warehouse_id", "status");

-- CreateIndex
CREATE INDEX "sales_order_items_product_id_idx" ON "sales_order_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_order_items_sales_order_id_product_id_key" ON "sales_order_items"("sales_order_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "outbound_waves_wave_no_key" ON "outbound_waves"("wave_no");

-- CreateIndex
CREATE INDEX "outbound_waves_sales_order_id_idx" ON "outbound_waves"("sales_order_id");

-- CreateIndex
CREATE INDEX "outbound_waves_warehouse_id_idx" ON "outbound_waves"("warehouse_id");

-- CreateIndex
CREATE INDEX "outbound_tasks_sales_order_id_task_type_status_idx" ON "outbound_tasks"("sales_order_id", "task_type", "status");

-- CreateIndex
CREATE INDEX "outbound_tasks_sales_order_item_id_idx" ON "outbound_tasks"("sales_order_item_id");

-- CreateIndex
CREATE INDEX "outbound_tasks_wave_id_idx" ON "outbound_tasks"("wave_id");

-- CreateIndex
CREATE INDEX "outbound_tasks_warehouse_id_idx" ON "outbound_tasks"("warehouse_id");

-- CreateIndex
CREATE INDEX "outbound_tasks_product_id_idx" ON "outbound_tasks"("product_id");

-- CreateIndex
CREATE INDEX "outbound_tasks_source_bin_id_idx" ON "outbound_tasks"("source_bin_id");

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_items" ADD CONSTRAINT "sales_order_items_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_items" ADD CONSTRAINT "sales_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_waves" ADD CONSTRAINT "outbound_waves_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_waves" ADD CONSTRAINT "outbound_waves_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_tasks" ADD CONSTRAINT "outbound_tasks_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_tasks" ADD CONSTRAINT "outbound_tasks_sales_order_item_id_fkey" FOREIGN KEY ("sales_order_item_id") REFERENCES "sales_order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_tasks" ADD CONSTRAINT "outbound_tasks_wave_id_fkey" FOREIGN KEY ("wave_id") REFERENCES "outbound_waves"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_tasks" ADD CONSTRAINT "outbound_tasks_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_tasks" ADD CONSTRAINT "outbound_tasks_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_tasks" ADD CONSTRAINT "outbound_tasks_source_bin_id_fkey" FOREIGN KEY ("source_bin_id") REFERENCES "warehouse_bins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- === 20260414095500_add_warehouse_customers_mapping ===
CREATE TABLE "warehouse_customers" (
  "id" TEXT NOT NULL,
  "warehouse_id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "warehouse_customers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "warehouse_customers_warehouse_id_customer_id_key"
  ON "warehouse_customers"("warehouse_id", "customer_id");

CREATE INDEX "warehouse_customers_warehouse_id_is_active_idx"
  ON "warehouse_customers"("warehouse_id", "is_active");

CREATE INDEX "warehouse_customers_customer_id_is_active_idx"
  ON "warehouse_customers"("customer_id", "is_active");

ALTER TABLE "warehouse_customers"
  ADD CONSTRAINT "warehouse_customers_warehouse_id_fkey"
  FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "warehouse_customers"
  ADD CONSTRAINT "warehouse_customers_customer_id_fkey"
  FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- === 20260414095755_customer_mapping ===
-- AlterTable
ALTER TABLE "warehouse_customers" ALTER COLUMN "updated_at" DROP DEFAULT;

-- === 20260416100000_add_suppliers_and_asn_supplier_safe ===
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

-- === 20260422120000_supplier_details_and_pics ===
-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN "phone" TEXT,
ADD COLUMN "address" TEXT;

-- CreateTable
CREATE TABLE "supplier_pics" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_pics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supplier_pics_supplier_id_sort_order_idx" ON "supplier_pics"("supplier_id", "sort_order");

-- AddForeignKey
ALTER TABLE "supplier_pics" ADD CONSTRAINT "supplier_pics_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- === 20260422132000_address_hierarchy_for_master_data ===
-- AlterTable
ALTER TABLE "customers"
ADD COLUMN "phone" TEXT,
ADD COLUMN "address" TEXT,
ADD COLUMN "province" TEXT,
ADD COLUMN "city" TEXT,
ADD COLUMN "district" TEXT,
ADD COLUMN "subdistrict" TEXT,
ADD COLUMN "postal_code" TEXT;

-- AlterTable
ALTER TABLE "operator_companies"
ADD COLUMN "phone" TEXT,
ADD COLUMN "address" TEXT,
ADD COLUMN "province" TEXT,
ADD COLUMN "city" TEXT,
ADD COLUMN "district" TEXT,
ADD COLUMN "subdistrict" TEXT,
ADD COLUMN "postal_code" TEXT;

-- AlterTable
ALTER TABLE "suppliers"
ADD COLUMN "province" TEXT,
ADD COLUMN "city" TEXT,
ADD COLUMN "district" TEXT,
ADD COLUMN "subdistrict" TEXT,
ADD COLUMN "postal_code" TEXT;

-- === 20260422152000_customer_operator_pics_and_warehouse_address ===
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

-- === 20260422170000_user_operator_warehouse_scope ===
-- AlterTable
ALTER TABLE "users" ADD COLUMN "operator_company_id" TEXT;

-- CreateTable
CREATE TABLE "user_warehouses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_warehouses_user_id_warehouse_id_key" ON "user_warehouses"("user_id", "warehouse_id");
CREATE INDEX "user_warehouses_warehouse_id_idx" ON "user_warehouses"("warehouse_id");
CREATE INDEX "users_operator_company_id_idx" ON "users"("operator_company_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_operator_company_id_fkey" FOREIGN KEY ("operator_company_id") REFERENCES "operator_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "user_warehouses" ADD CONSTRAINT "user_warehouses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_warehouses" ADD CONSTRAINT "user_warehouses_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- === 20260423090000_add_unit_of_measure_master ===
CREATE TABLE "unit_of_measures" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "unit_of_measures_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "unit_of_measures_code_key" ON "unit_of_measures"("code");
CREATE INDEX "unit_of_measures_is_active_idx" ON "unit_of_measures"("is_active");

-- === 20260423102000_inbound_item_uom ===
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

-- === 20260427091500_outbound_event_log_and_status ===
-- AlterEnum
ALTER TYPE "SalesOrderStatus" ADD VALUE 'ALLOCATED';
ALTER TYPE "SalesOrderStatus" ADD VALUE 'LOADING';

-- CreateTable
CREATE TABLE "outbound_event_logs" (
    "id" TEXT NOT NULL,
    "sales_order_id" TEXT NOT NULL,
    "outbound_task_id" TEXT,
    "warehouse_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "operator_company_id" TEXT,
    "event_code" TEXT NOT NULL,
    "note" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbound_event_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "outbound_event_logs_sales_order_id_created_at_idx" ON "outbound_event_logs"("sales_order_id", "created_at");

-- CreateIndex
CREATE INDEX "outbound_event_logs_outbound_task_id_created_at_idx" ON "outbound_event_logs"("outbound_task_id", "created_at");

-- CreateIndex
CREATE INDEX "outbound_event_logs_warehouse_id_created_at_idx" ON "outbound_event_logs"("warehouse_id", "created_at");

-- CreateIndex
CREATE INDEX "outbound_event_logs_customer_id_created_at_idx" ON "outbound_event_logs"("customer_id", "created_at");

-- AddForeignKey
ALTER TABLE "outbound_event_logs" ADD CONSTRAINT "outbound_event_logs_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_event_logs" ADD CONSTRAINT "outbound_event_logs_outbound_task_id_fkey" FOREIGN KEY ("outbound_task_id") REFERENCES "outbound_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_event_logs" ADD CONSTRAINT "outbound_event_logs_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_event_logs" ADD CONSTRAINT "outbound_event_logs_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_event_logs" ADD CONSTRAINT "outbound_event_logs_operator_company_id_fkey" FOREIGN KEY ("operator_company_id") REFERENCES "operator_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- === 20260427094000_add_outbound_allocations ===
-- CreateTable
CREATE TABLE "outbound_allocations" (
    "id" TEXT NOT NULL,
    "sales_order_id" TEXT NOT NULL,
    "sales_order_item_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "bin_id" TEXT NOT NULL,
    "qty_allocated" DECIMAL(18,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbound_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "outbound_allocations_sales_order_id_sales_order_item_id_idx" ON "outbound_allocations"("sales_order_id", "sales_order_item_id");

-- CreateIndex
CREATE INDEX "outbound_allocations_warehouse_id_product_id_bin_id_idx" ON "outbound_allocations"("warehouse_id", "product_id", "bin_id");

-- CreateIndex
CREATE INDEX "outbound_allocations_customer_id_created_at_idx" ON "outbound_allocations"("customer_id", "created_at");

-- AddForeignKey
ALTER TABLE "outbound_allocations" ADD CONSTRAINT "outbound_allocations_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_allocations" ADD CONSTRAINT "outbound_allocations_sales_order_item_id_fkey" FOREIGN KEY ("sales_order_item_id") REFERENCES "sales_order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_allocations" ADD CONSTRAINT "outbound_allocations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_allocations" ADD CONSTRAINT "outbound_allocations_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_allocations" ADD CONSTRAINT "outbound_allocations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_allocations" ADD CONSTRAINT "outbound_allocations_bin_id_fkey" FOREIGN KEY ("bin_id") REFERENCES "warehouse_bins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- === 20260427164000_add_internal_transfer_and_transformation ===
-- CreateEnum
CREATE TYPE "InternalTransferStatus" AS ENUM ('DRAFT', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MaterialTransformationStatus" AS ENUM ('DRAFT', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "internal_transfers" (
    "id" TEXT NOT NULL,
    "transfer_no" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "from_warehouse_id" TEXT NOT NULL,
    "to_warehouse_id" TEXT NOT NULL,
    "status" "InternalTransferStatus" NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internal_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internal_transfer_lines" (
    "id" TEXT NOT NULL,
    "transfer_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "source_bin_id" TEXT NOT NULL,
    "destination_bin_id" TEXT NOT NULL,
    "qty" DECIMAL(18,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internal_transfer_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_transformations" (
    "id" TEXT NOT NULL,
    "process_no" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "output_product_id" TEXT NOT NULL,
    "output_bin_id" TEXT NOT NULL,
    "qty_output" DECIMAL(18,4) NOT NULL,
    "status" "MaterialTransformationStatus" NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_transformations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_transformation_inputs" (
    "id" TEXT NOT NULL,
    "transformation_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "bin_id" TEXT NOT NULL,
    "qty_consumed" DECIMAL(18,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_transformation_inputs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "internal_transfers_transfer_no_key" ON "internal_transfers"("transfer_no");
CREATE INDEX "internal_transfers_customer_id_status_idx" ON "internal_transfers"("customer_id", "status");
CREATE INDEX "internal_transfers_from_warehouse_id_status_idx" ON "internal_transfers"("from_warehouse_id", "status");
CREATE INDEX "internal_transfers_to_warehouse_id_status_idx" ON "internal_transfers"("to_warehouse_id", "status");

-- CreateIndex
CREATE INDEX "internal_transfer_lines_transfer_id_idx" ON "internal_transfer_lines"("transfer_id");
CREATE INDEX "internal_transfer_lines_product_id_idx" ON "internal_transfer_lines"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "material_transformations_process_no_key" ON "material_transformations"("process_no");
CREATE INDEX "material_transformations_customer_id_status_idx" ON "material_transformations"("customer_id", "status");
CREATE INDEX "material_transformations_warehouse_id_status_idx" ON "material_transformations"("warehouse_id", "status");

-- CreateIndex
CREATE INDEX "material_transformation_inputs_transformation_id_idx" ON "material_transformation_inputs"("transformation_id");
CREATE INDEX "material_transformation_inputs_product_id_idx" ON "material_transformation_inputs"("product_id");

-- AddForeignKey
ALTER TABLE "internal_transfers" ADD CONSTRAINT "internal_transfers_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "internal_transfers" ADD CONSTRAINT "internal_transfers_from_warehouse_id_fkey" FOREIGN KEY ("from_warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "internal_transfers" ADD CONSTRAINT "internal_transfers_to_warehouse_id_fkey" FOREIGN KEY ("to_warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_transfer_lines" ADD CONSTRAINT "internal_transfer_lines_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "internal_transfers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "internal_transfer_lines" ADD CONSTRAINT "internal_transfer_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "internal_transfer_lines" ADD CONSTRAINT "internal_transfer_lines_source_bin_id_fkey" FOREIGN KEY ("source_bin_id") REFERENCES "warehouse_bins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "internal_transfer_lines" ADD CONSTRAINT "internal_transfer_lines_destination_bin_id_fkey" FOREIGN KEY ("destination_bin_id") REFERENCES "warehouse_bins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_transformations" ADD CONSTRAINT "material_transformations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "material_transformations" ADD CONSTRAINT "material_transformations_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "material_transformations" ADD CONSTRAINT "material_transformations_output_product_id_fkey" FOREIGN KEY ("output_product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "material_transformations" ADD CONSTRAINT "material_transformations_output_bin_id_fkey" FOREIGN KEY ("output_bin_id") REFERENCES "warehouse_bins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_transformation_inputs" ADD CONSTRAINT "material_transformation_inputs_transformation_id_fkey" FOREIGN KEY ("transformation_id") REFERENCES "material_transformations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "material_transformation_inputs" ADD CONSTRAINT "material_transformation_inputs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "material_transformation_inputs" ADD CONSTRAINT "material_transformation_inputs_bin_id_fkey" FOREIGN KEY ("bin_id") REFERENCES "warehouse_bins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- === 20260429171000_add_process_recipes ===
-- CreateTable
CREATE TABLE "process_recipes" (
    "id" TEXT NOT NULL,
    "recipe_code" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "output_product_id" TEXT NOT NULL,
    "base_output_qty" DECIMAL(18,4) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "process_recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "process_recipe_lines" (
    "id" TEXT NOT NULL,
    "recipe_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "qty_per_base" DECIMAL(18,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "process_recipe_lines_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "material_transformations" ADD COLUMN "recipe_id" TEXT;

-- Indexes
CREATE UNIQUE INDEX "process_recipes_customer_id_recipe_code_key" ON "process_recipes"("customer_id", "recipe_code");
CREATE INDEX "process_recipes_customer_id_is_active_idx" ON "process_recipes"("customer_id", "is_active");
CREATE INDEX "process_recipes_output_product_id_is_active_idx" ON "process_recipes"("output_product_id", "is_active");
CREATE INDEX "process_recipe_lines_recipe_id_idx" ON "process_recipe_lines"("recipe_id");
CREATE INDEX "process_recipe_lines_product_id_idx" ON "process_recipe_lines"("product_id");

-- Foreign keys
ALTER TABLE "process_recipes" ADD CONSTRAINT "process_recipes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "process_recipes" ADD CONSTRAINT "process_recipes_output_product_id_fkey" FOREIGN KEY ("output_product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "process_recipe_lines" ADD CONSTRAINT "process_recipe_lines_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "process_recipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "process_recipe_lines" ADD CONSTRAINT "process_recipe_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "material_transformations" ADD CONSTRAINT "material_transformations_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "process_recipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- === 20260429195500_add_process_flow_event_logs ===
-- CreateTable
CREATE TABLE "process_flow_event_logs" (
    "id" TEXT NOT NULL,
    "event_code" TEXT NOT NULL,
    "process_type" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "operator_company_id" TEXT,
    "internal_transfer_id" TEXT,
    "material_transformation_id" TEXT,
    "note" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "process_flow_event_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "process_flow_event_logs_customer_id_created_at_idx" ON "process_flow_event_logs"("customer_id", "created_at");

-- CreateIndex
CREATE INDEX "process_flow_event_logs_warehouse_id_created_at_idx" ON "process_flow_event_logs"("warehouse_id", "created_at");

-- CreateIndex
CREATE INDEX "process_flow_event_logs_internal_transfer_id_created_at_idx" ON "process_flow_event_logs"("internal_transfer_id", "created_at");

-- CreateIndex
CREATE INDEX "process_flow_event_logs_material_transformation_id_created_at_idx" ON "process_flow_event_logs"("material_transformation_id", "created_at");

-- AddForeignKey
ALTER TABLE "process_flow_event_logs" ADD CONSTRAINT "process_flow_event_logs_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_flow_event_logs" ADD CONSTRAINT "process_flow_event_logs_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_flow_event_logs" ADD CONSTRAINT "process_flow_event_logs_operator_company_id_fkey" FOREIGN KEY ("operator_company_id") REFERENCES "operator_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_flow_event_logs" ADD CONSTRAINT "process_flow_event_logs_internal_transfer_id_fkey" FOREIGN KEY ("internal_transfer_id") REFERENCES "internal_transfers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_flow_event_logs" ADD CONSTRAINT "process_flow_event_logs_material_transformation_id_fkey" FOREIGN KEY ("material_transformation_id") REFERENCES "material_transformations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- === 20260430083500_add_lot_batch_traceability ===
-- Add lot/batch traceability columns
ALTER TABLE "material_transformations"
  ADD COLUMN "output_lot_no" TEXT,
  ADD COLUMN "output_batch_no" TEXT;

ALTER TABLE "material_transformation_inputs"
  ADD COLUMN "lot_no" TEXT,
  ADD COLUMN "batch_no" TEXT;

ALTER TABLE "inbound_receipts"
  ADD COLUMN "lot_no" TEXT,
  ADD COLUMN "batch_no" TEXT,
  ADD COLUMN "expiry_date" TIMESTAMP(3);

-- === 20260430084500_add_serial_traceability ===
ALTER TABLE "material_transformations"
  ADD COLUMN "output_serial_nos" JSONB;

ALTER TABLE "material_transformation_inputs"
  ADD COLUMN "serial_nos" JSONB;

ALTER TABLE "inbound_receipts"
  ADD COLUMN "serial_nos" JSONB;

-- === 20260430085500_add_outbound_task_serials ===
ALTER TABLE "outbound_tasks"
  ADD COLUMN "serial_nos" JSONB;

-- === 20260430093000_add_product_uom_conversions_and_transfer_uom ===
-- Product base UOM
ALTER TABLE products
ADD COLUMN base_uom_id TEXT NULL;

ALTER TABLE products
ADD CONSTRAINT products_base_uom_id_fkey
FOREIGN KEY (base_uom_id) REFERENCES unit_of_measures(id)
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX products_base_uom_id_idx ON products(base_uom_id);

-- Product-specific UOM conversions
CREATE TABLE product_uom_conversions (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  from_uom_id TEXT NOT NULL,
  to_uom_id TEXT NOT NULL,
  factor DECIMAL(18, 6) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  note TEXT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE product_uom_conversions
ADD CONSTRAINT product_uom_conversions_product_id_fkey
FOREIGN KEY (product_id) REFERENCES products(id)
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE product_uom_conversions
ADD CONSTRAINT product_uom_conversions_from_uom_id_fkey
FOREIGN KEY (from_uom_id) REFERENCES unit_of_measures(id)
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE product_uom_conversions
ADD CONSTRAINT product_uom_conversions_to_uom_id_fkey
FOREIGN KEY (to_uom_id) REFERENCES unit_of_measures(id)
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX product_uom_conversions_product_id_from_uom_id_to_uom_id_key
ON product_uom_conversions(product_id, from_uom_id, to_uom_id);

CREATE INDEX product_uom_conversions_product_id_is_active_idx
ON product_uom_conversions(product_id, is_active);

CREATE INDEX product_uom_conversions_from_uom_id_idx
ON product_uom_conversions(from_uom_id);

CREATE INDEX product_uom_conversions_to_uom_id_idx
ON product_uom_conversions(to_uom_id);

-- Transfer line UOM and converted base qty
ALTER TABLE internal_transfer_lines
ADD COLUMN uom_id TEXT NULL,
ADD COLUMN qty_base DECIMAL(18, 4) NULL,
ADD COLUMN conversion_factor DECIMAL(18, 6) NULL;

ALTER TABLE internal_transfer_lines
ADD CONSTRAINT internal_transfer_lines_uom_id_fkey
FOREIGN KEY (uom_id) REFERENCES unit_of_measures(id)
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX internal_transfer_lines_uom_id_idx
ON internal_transfer_lines(uom_id);

-- === 20260430094800_add_transformation_uom_conversion_columns ===
ALTER TABLE material_transformations
ADD COLUMN output_uom_id TEXT NULL,
ADD COLUMN qty_output_input DECIMAL(18,4) NULL,
ADD COLUMN output_conversion_factor DECIMAL(18,6) NULL;

ALTER TABLE material_transformations
ADD CONSTRAINT material_transformations_output_uom_id_fkey
FOREIGN KEY (output_uom_id) REFERENCES unit_of_measures(id)
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX material_transformations_output_uom_id_idx
ON material_transformations(output_uom_id);

ALTER TABLE material_transformation_inputs
ADD COLUMN uom_id TEXT NULL,
ADD COLUMN qty_consumed_input DECIMAL(18,4) NULL,
ADD COLUMN conversion_factor DECIMAL(18,6) NULL;

ALTER TABLE material_transformation_inputs
ADD CONSTRAINT material_transformation_inputs_uom_id_fkey
FOREIGN KEY (uom_id) REFERENCES unit_of_measures(id)
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX material_transformation_inputs_uom_id_idx
ON material_transformation_inputs(uom_id);

-- === 20260430100000_add_user_channel_access_flags ===
ALTER TABLE users
ADD COLUMN can_access_web BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN can_access_mobile BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX users_can_access_web_idx
ON users(can_access_web);

CREATE INDEX users_can_access_mobile_idx
ON users(can_access_mobile);

-- === 20260430100500_add_inbound_uom_conversion_columns ===
ALTER TABLE inbound_asn_items
ADD COLUMN qty_expected_base DECIMAL(18,4) NOT NULL DEFAULT 0,
ADD COLUMN qty_received_base DECIMAL(18,4) NOT NULL DEFAULT 0;

UPDATE inbound_asn_items
SET qty_expected_base = qty_expected,
    qty_received_base = qty_received;

ALTER TABLE inbound_receipts
ADD COLUMN qty_received_input DECIMAL(18,4) NULL,
ADD COLUMN conversion_factor DECIMAL(18,6) NULL;

-- === 20260430113000_add_outbound_uom_conversion_columns ===
ALTER TABLE outbound_tasks
ADD COLUMN uom_id TEXT NULL,
ADD COLUMN qty_task_input DECIMAL(18,4) NULL,
ADD COLUMN conversion_factor DECIMAL(18,6) NULL;

UPDATE outbound_tasks
SET qty_task_input = qty_task,
    conversion_factor = 1;

ALTER TABLE outbound_tasks
ADD CONSTRAINT outbound_tasks_uom_id_fkey
FOREIGN KEY (uom_id) REFERENCES unit_of_measures(id)
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX outbound_tasks_uom_id_idx ON outbound_tasks(uom_id);

-- === 20260430162000_add_outbound_serial_reservations ===
-- Create enum for outbound serial reservation lifecycle
CREATE TYPE "OutboundSerialReservationStatus" AS ENUM ('ACTIVE', 'CONSUMED', 'RELEASED');

-- Create table to pre-reserve serial numbers in planning phase
CREATE TABLE "outbound_serial_reservations" (
    "id" TEXT NOT NULL,
    "sales_order_id" TEXT NOT NULL,
    "sales_order_item_id" TEXT NOT NULL,
    "wave_id" TEXT,
    "outbound_task_id" TEXT,
    "customer_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "serial_no" TEXT NOT NULL,
    "status" "OutboundSerialReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "reserved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumed_at" TIMESTAMP(3),
    "released_at" TIMESTAMP(3),
    "release_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "outbound_serial_reservations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "outbound_serial_reservations_customer_id_product_id_serial_no_sta_key"
ON "outbound_serial_reservations"("customer_id", "product_id", "serial_no", "status");

CREATE INDEX "outbound_serial_reservations_sales_order_id_sales_order_item_id_idx"
ON "outbound_serial_reservations"("sales_order_id", "sales_order_item_id", "status");
CREATE INDEX "outbound_serial_reservations_wave_id_status_idx"
ON "outbound_serial_reservations"("wave_id", "status");
CREATE INDEX "outbound_serial_reservations_outbound_task_id_status_idx"
ON "outbound_serial_reservations"("outbound_task_id", "status");
CREATE INDEX "outbound_serial_reservations_warehouse_id_product_id_status_idx"
ON "outbound_serial_reservations"("warehouse_id", "product_id", "status");
CREATE INDEX "outbound_serial_reservations_customer_id_created_at_idx"
ON "outbound_serial_reservations"("customer_id", "created_at");

ALTER TABLE "outbound_serial_reservations"
ADD CONSTRAINT "outbound_serial_reservations_sales_order_id_fkey"
FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "outbound_serial_reservations"
ADD CONSTRAINT "outbound_serial_reservations_sales_order_item_id_fkey"
FOREIGN KEY ("sales_order_item_id") REFERENCES "sales_order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "outbound_serial_reservations"
ADD CONSTRAINT "outbound_serial_reservations_wave_id_fkey"
FOREIGN KEY ("wave_id") REFERENCES "outbound_waves"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "outbound_serial_reservations"
ADD CONSTRAINT "outbound_serial_reservations_outbound_task_id_fkey"
FOREIGN KEY ("outbound_task_id") REFERENCES "outbound_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "outbound_serial_reservations"
ADD CONSTRAINT "outbound_serial_reservations_customer_id_fkey"
FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "outbound_serial_reservations"
ADD CONSTRAINT "outbound_serial_reservations_warehouse_id_fkey"
FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "outbound_serial_reservations"
ADD CONSTRAINT "outbound_serial_reservations_product_id_fkey"
FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- === 20260504120000_add_warehouse_is_transit_import_hub ===
-- Transit import hub flag (orthogonal to warehouse type). Default false preserves existing behavior.
ALTER TABLE "warehouses" ADD COLUMN "is_transit_import_hub" BOOLEAN NOT NULL DEFAULT false;

-- === 20260504133000_inbound_receipt_customs_clearance ===
-- CreateEnum
CREATE TYPE "InboundReceiptCustomsClearanceStatus" AS ENUM ('NONE', 'HELD', 'CLEARED');

-- AlterTable
ALTER TABLE "inbound_receipts" ADD COLUMN "customs_clearance_status" "InboundReceiptCustomsClearanceStatus" NOT NULL DEFAULT 'NONE';
ALTER TABLE "inbound_receipts" ADD COLUMN "customs_hold_started_at" TIMESTAMP(3);
ALTER TABLE "inbound_receipts" ADD COLUMN "customs_released_at" TIMESTAMP(3);
ALTER TABLE "inbound_receipts" ADD COLUMN "customs_release_ref" VARCHAR(255);

-- CreateIndex
CREATE INDEX "inbound_receipts_customs_clearance_status_idx" ON "inbound_receipts"("customs_clearance_status");

-- === 20260505120000_import_consignments_manifest_review ===
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

-- === 20260505140000_import_consignment_documents ===
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

