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
