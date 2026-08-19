-- Display order for subscription plans (pricing page, admin list)

ALTER TABLE platform.plans
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

UPDATE platform.plans SET sort_order = 1 WHERE code = 'STARTER' AND sort_order = 0;
UPDATE platform.plans SET sort_order = 2 WHERE code = 'PRO' AND sort_order = 0;
UPDATE platform.plans SET sort_order = 3 WHERE code = 'ENTERPRISE' AND sort_order = 0;

CREATE INDEX IF NOT EXISTS plans_sort_order_idx ON platform.plans (sort_order);
