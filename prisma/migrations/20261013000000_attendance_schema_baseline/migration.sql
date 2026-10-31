-- Additive bridge for attendance/settings previously provisioned with db push.
-- Existing tables/columns/data and publication triggers are retained.
-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "unifi_site" TEXT DEFAULT 'default',
ADD COLUMN IF NOT EXISTS "wlan_conf_id" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "attendance_sessions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "campaign_id" TEXT,
    "unifi_site" TEXT NOT NULL DEFAULT 'default',
    "ssid" TEXT NOT NULL,
    "wlan_conf_id" TEXT,
    "target_ap_macs" JSONB NOT NULL DEFAULT '[]',
    "form_schema" JSONB NOT NULL DEFAULT '[]',
    "name_field_key" TEXT NOT NULL DEFAULT 'fullname',
    "id_field_key" TEXT NOT NULL DEFAULT 'employee_code',
    "dialog_title" TEXT DEFAULT 'Điểm danh cuộc họp',
    "dialog_description" TEXT,
    "confirm_button_text" TEXT DEFAULT 'Xác nhận điểm danh và kết nối',
    "success_message" TEXT DEFAULT 'Điểm danh thành công! Đang cấp quyền truy cập Internet...',
    "warning_threshold_minutes" INTEGER NOT NULL DEFAULT 15,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "attendance_registrations" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "identity_value" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "form_answers" JSONB NOT NULL DEFAULT '{}',
    "primary_mac" TEXT NOT NULL,
    "primary_ip" TEXT,
    "device_vendor" TEXT,
    "device_os" TEXT,
    "first_seen_at" TIMESTAMP(3),
    "last_seen_at" TIMESTAMP(3),
    "current_ap_mac" TEXT,
    "current_rssi" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PRESENT',
    "total_present_seconds" INTEGER NOT NULL DEFAULT 0,
    "total_absent_seconds" INTEGER NOT NULL DEFAULT 0,
    "total_unknown_seconds" INTEGER NOT NULL DEFAULT 0,
    "warning_count" INTEGER NOT NULL DEFAULT 0,
    "absent_started_at" TIMESTAMP(3),
    "consecutive_miss_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "attendance_intervals" (
    "id" TEXT NOT NULL,
    "registration_id" TEXT NOT NULL,
    "ap_mac" TEXT,
    "joined_at" TIMESTAMP(3) NOT NULL,
    "left_at" TIMESTAMP(3),
    "duration_seconds" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PRESENT',

    CONSTRAINT "attendance_intervals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "attendance_device_histories" (
    "id" TEXT NOT NULL,
    "registration_id" TEXT NOT NULL,
    "old_mac" TEXT NOT NULL,
    "new_mac" TEXT NOT NULL,
    "reason" TEXT,
    "performed_by" TEXT NOT NULL DEFAULT 'Admin',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_device_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "attendance_logs" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "registration_id" TEXT,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "attendance_unregistered_clients" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "mac" TEXT NOT NULL,
    "ip" TEXT,
    "ap_mac" TEXT,
    "signal" INTEGER,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_unregistered_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "system_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "attendance_registrations_session_id_primary_mac_idx" ON "attendance_registrations"("session_id", "primary_mac");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "attendance_registrations_session_id_identity_value_key" ON "attendance_registrations"("session_id", "identity_value");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "attendance_intervals_registration_id_joined_at_idx" ON "attendance_intervals"("registration_id", "joined_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "attendance_logs_session_id_created_at_idx" ON "attendance_logs"("session_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "attendance_unregistered_clients_session_id_mac_key" ON "attendance_unregistered_clients"("session_id", "mac");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_sessions_campaign_id_fkey' AND conrelid = '"attendance_sessions"'::regclass) THEN
    ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_registrations_session_id_fkey' AND conrelid = '"attendance_registrations"'::regclass) THEN
    ALTER TABLE "attendance_registrations" ADD CONSTRAINT "attendance_registrations_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "attendance_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_intervals_registration_id_fkey' AND conrelid = '"attendance_intervals"'::regclass) THEN
    ALTER TABLE "attendance_intervals" ADD CONSTRAINT "attendance_intervals_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "attendance_registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_device_histories_registration_id_fkey' AND conrelid = '"attendance_device_histories"'::regclass) THEN
    ALTER TABLE "attendance_device_histories" ADD CONSTRAINT "attendance_device_histories_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "attendance_registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_logs_session_id_fkey' AND conrelid = '"attendance_logs"'::regclass) THEN
    ALTER TABLE "attendance_logs" ADD CONSTRAINT "attendance_logs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "attendance_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_unregistered_clients_session_id_fkey' AND conrelid = '"attendance_unregistered_clients"'::regclass) THEN
    ALTER TABLE "attendance_unregistered_clients" ADD CONSTRAINT "attendance_unregistered_clients_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "attendance_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

