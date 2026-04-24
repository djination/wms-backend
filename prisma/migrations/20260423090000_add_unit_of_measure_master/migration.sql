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
