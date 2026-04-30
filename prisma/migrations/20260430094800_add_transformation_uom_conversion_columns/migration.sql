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
