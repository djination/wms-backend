-- SaaS control plane registry (phase S2)

CREATE TYPE platform."TenantStatus" AS ENUM (
  'PROVISIONING',
  'TRIAL',
  'ACTIVE',
  'PAST_DUE',
  'SUSPENDED',
  'CANCELLED'
);

CREATE TYPE platform."SubscriptionStatus" AS ENUM (
  'TRIAL',
  'ACTIVE',
  'PAST_DUE',
  'CANCELLED'
);

CREATE TYPE platform."PlatformRole" AS ENUM (
  'SUPER_ADMIN',
  'SUPPORT',
  'BILLING'
);

CREATE TYPE platform."ProvisioningJobStatus" AS ENUM (
  'PENDING',
  'RUNNING',
  'FAILED',
  'SUCCESS'
);

CREATE TYPE platform."ProvisioningStep" AS ENUM (
  'CREATE_SCHEMA',
  'MIGRATE',
  'SEED',
  'DONE'
);

CREATE TABLE platform.plans (
  id TEXT NOT NULL,
  code VARCHAR(64) NOT NULL,
  name VARCHAR(200) NOT NULL,
  max_warehouses INTEGER NOT NULL DEFAULT 1,
  max_users INTEGER NOT NULL DEFAULT 5,
  max_customers INTEGER NOT NULL DEFAULT 10,
  features JSONB NOT NULL DEFAULT '{}',
  price_monthly DECIMAL(18, 2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT plans_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX plans_code_key ON platform.plans (code);
CREATE INDEX plans_is_active_idx ON platform.plans (is_active);

CREATE TABLE platform.tenants (
  id TEXT NOT NULL,
  slug VARCHAR(64) NOT NULL,
  schema_name VARCHAR(80) NOT NULL,
  name VARCHAR(200) NOT NULL,
  status platform."TenantStatus" NOT NULL DEFAULT 'PROVISIONING',
  plan_id TEXT,
  trial_ends_at TIMESTAMP(3),
  provisioned_at TIMESTAMP(3),
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT tenants_pkey PRIMARY KEY (id),
  CONSTRAINT tenants_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES platform.plans (id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX tenants_slug_key ON platform.tenants (slug);
CREATE UNIQUE INDEX tenants_schema_name_key ON platform.tenants (schema_name);
CREATE INDEX tenants_status_idx ON platform.tenants (status);
CREATE INDEX tenants_plan_id_idx ON platform.tenants (plan_id);

CREATE TABLE platform.tenant_subscriptions (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  status platform."SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
  trial_ends_at TIMESTAMP(3),
  current_period_start TIMESTAMP(3),
  current_period_end TIMESTAMP(3),
  external_customer_id VARCHAR(120),
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT tenant_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT tenant_subscriptions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES platform.tenants (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT tenant_subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES platform.plans (id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX tenant_subscriptions_tenant_id_key ON platform.tenant_subscriptions (tenant_id);
CREATE INDEX tenant_subscriptions_plan_id_idx ON platform.tenant_subscriptions (plan_id);
CREATE INDEX tenant_subscriptions_status_idx ON platform.tenant_subscriptions (status);

CREATE TABLE platform.platform_users (
  id TEXT NOT NULL,
  email VARCHAR(320) NOT NULL,
  password_hash TEXT NOT NULL,
  name VARCHAR(200),
  role platform."PlatformRole" NOT NULL DEFAULT 'SUPPORT',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT platform_users_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX platform_users_email_key ON platform.platform_users (email);
CREATE INDEX platform_users_is_active_idx ON platform.platform_users (is_active);

CREATE TABLE platform.tenant_provisioning_jobs (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  step platform."ProvisioningStep" NOT NULL,
  status platform."ProvisioningJobStatus" NOT NULL DEFAULT 'PENDING',
  error TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMP(3),
  finished_at TIMESTAMP(3),
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT tenant_provisioning_jobs_pkey PRIMARY KEY (id),
  CONSTRAINT tenant_provisioning_jobs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES platform.tenants (id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX tenant_provisioning_jobs_tenant_id_created_at_idx
  ON platform.tenant_provisioning_jobs (tenant_id, created_at DESC);
CREATE INDEX tenant_provisioning_jobs_status_idx ON platform.tenant_provisioning_jobs (status);

CREATE TABLE platform.platform_audit_logs (
  id TEXT NOT NULL,
  platform_user_id TEXT,
  tenant_id TEXT,
  action VARCHAR(120) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT platform_audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT platform_audit_logs_platform_user_id_fkey FOREIGN KEY (platform_user_id) REFERENCES platform.platform_users (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT platform_audit_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES platform.tenants (id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX platform_audit_logs_tenant_id_created_at_idx ON platform.platform_audit_logs (tenant_id, created_at DESC);
CREATE INDEX platform_audit_logs_platform_user_id_created_at_idx ON platform.platform_audit_logs (platform_user_id, created_at DESC);

CREATE TABLE platform.platform_settings (
  key VARCHAR(120) NOT NULL,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT platform_settings_pkey PRIMARY KEY (key)
);

CREATE TABLE platform.tenant_feature_flags (
  id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  flag_key VARCHAR(120) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT tenant_feature_flags_pkey PRIMARY KEY (id),
  CONSTRAINT tenant_feature_flags_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES platform.tenants (id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX tenant_feature_flags_tenant_id_flag_key_key ON platform.tenant_feature_flags (tenant_id, flag_key);
