-- Transit import hub flag (orthogonal to warehouse type). Default false preserves existing behavior.
ALTER TABLE "warehouses" ADD COLUMN "is_transit_import_hub" BOOLEAN NOT NULL DEFAULT false;
