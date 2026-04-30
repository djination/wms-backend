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
