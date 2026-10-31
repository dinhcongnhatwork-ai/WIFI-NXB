-- AlterTable
ALTER TABLE "admins" ADD COLUMN     "disabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'ADMIN';

-- CreateTable
CREATE TABLE "network_connections" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "base_url" TEXT NOT NULL,
    "username" TEXT,
    "encrypted_credentials" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "version" TEXT,
    "capabilities" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'unknown',
    "last_sync_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "network_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monitoring_targets" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "connection_id" TEXT,
    "site_id" TEXT,
    "device_id" TEXT,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "zabbix_host_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'unknown',
    "last_seen_at" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monitoring_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operational_logs" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "connection_id" TEXT,
    "device_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operational_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "actor_name" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "connection_id" TEXT,
    "device_id" TEXT,
    "before" JSONB,
    "after" JSONB,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monitoring_checkpoints" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monitoring_checkpoints_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "network_connections_provider_is_default_idx" ON "network_connections"("provider", "is_default");

-- CreateIndex
CREATE UNIQUE INDEX "monitoring_targets_key_key" ON "monitoring_targets"("key");

-- CreateIndex
CREATE INDEX "monitoring_targets_connection_id_site_id_idx" ON "monitoring_targets"("connection_id", "site_id");

-- CreateIndex
CREATE UNIQUE INDEX "operational_logs_fingerprint_key" ON "operational_logs"("fingerprint");

-- CreateIndex
CREATE INDEX "operational_logs_occurred_at_id_idx" ON "operational_logs"("occurred_at", "id");

-- CreateIndex
CREATE INDEX "operational_logs_source_severity_occurred_at_idx" ON "operational_logs"("source", "severity", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_id_idx" ON "audit_logs"("created_at", "id");

-- CreateIndex
CREATE INDEX "audit_logs_connection_id_device_id_idx" ON "audit_logs"("connection_id", "device_id");


-- Concurrency invariants for a single controller and designated default routers.
CREATE UNIQUE INDEX "network_connections_one_unifi" ON "network_connections" ("provider") WHERE "provider" = 'UNIFI';
CREATE UNIQUE INDEX "network_connections_one_default" ON "network_connections" ("provider") WHERE "is_default" = true;
ALTER TABLE "network_connections" ADD CONSTRAINT "network_connections_provider_check" CHECK ("provider" IN ('UNIFI','MIKROTIK'));
ALTER TABLE "admins" ADD CONSTRAINT "admins_role_check" CHECK ("role" IN ('ADMIN','OPERATOR','VIEWER'));
