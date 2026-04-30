ALTER TABLE inbound_asn_items
ADD COLUMN qty_expected_base DECIMAL(18,4) NOT NULL DEFAULT 0,
ADD COLUMN qty_received_base DECIMAL(18,4) NOT NULL DEFAULT 0;

UPDATE inbound_asn_items
SET qty_expected_base = qty_expected,
    qty_received_base = qty_received;

ALTER TABLE inbound_receipts
ADD COLUMN qty_received_input DECIMAL(18,4) NULL,
ADD COLUMN conversion_factor DECIMAL(18,6) NULL;
