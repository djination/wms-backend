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
