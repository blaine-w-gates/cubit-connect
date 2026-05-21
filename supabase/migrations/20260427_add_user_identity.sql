-- Migration: Add User Identity Infrastructure (Phase 6)
-- Created: April 27, 2026
-- Description: User authentication, device linkage, and identity migration tracking

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- USER DEVICES TABLE
-- Tracks device linkage to user accounts
-- =====================================================
CREATE TABLE IF NOT EXISTS user_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    device_name TEXT,
    device_fingerprint TEXT, -- Browser + OS hash for duplicate detection
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, device_id)
);

-- Index for fast user device lookups
CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON user_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_device_id ON user_devices(device_id);

-- Enable Row Level Security
ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own devices
CREATE POLICY "Users can view own devices"
    ON user_devices
    FOR SELECT
    USING (user_id = auth.uid());

-- RLS Policy: Users can insert their own devices
CREATE POLICY "Users can insert own devices"
    ON user_devices
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- RLS Policy: Users can update their own device records
CREATE POLICY "Users can update own devices"
    ON user_devices
    FOR UPDATE
    USING (user_id = auth.uid());

-- RLS Policy: Users can delete their own devices
CREATE POLICY "Users can delete own devices"
    ON user_devices
    FOR DELETE
    USING (user_id = auth.uid());

-- Table comment
COMMENT ON TABLE user_devices IS 'Links devices to authenticated users for multi-device access';

-- =====================================================
-- IDENTITY MIGRATIONS TABLE
-- Audit log for anonymous to registered transitions
-- =====================================================
CREATE TABLE IF NOT EXISTS identity_migrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    old_device_id TEXT NOT NULL,
    new_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    device_count_migrated INTEGER DEFAULT 0,
    project_count_migrated INTEGER DEFAULT 0,
    migration_status TEXT NOT NULL DEFAULT 'pending' 
        CHECK (migration_status IN ('pending', 'in_progress', 'completed', 'failed', 'rolled_back')),
    error_message TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    rolled_back_at TIMESTAMPTZ,
    exported_data_size INTEGER -- Size of pre-migration backup in bytes
);

-- Index for migration lookups by device
CREATE INDEX IF NOT EXISTS idx_identity_migrations_device ON identity_migrations(old_device_id);
CREATE INDEX IF NOT EXISTS idx_identity_migrations_user ON identity_migrations(new_user_id);
CREATE INDEX IF NOT EXISTS idx_identity_migrations_status ON identity_migrations(migration_status);

-- Enable Row Level Security
ALTER TABLE identity_migrations ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own migrations
CREATE POLICY "Users can view own migrations"
    ON identity_migrations
    FOR SELECT
    USING (new_user_id = auth.uid());

-- RLS Policy: Service role can insert migration records
CREATE POLICY "Service role can insert migrations"
    ON identity_migrations
    FOR INSERT
    WITH CHECK (true);

-- RLS Policy: Service role can update migration records
CREATE POLICY "Service role can update migrations"
    ON identity_migrations
    FOR UPDATE
    USING (true);

-- Table comment
COMMENT ON TABLE identity_migrations IS 'Audit log tracking anonymous to registered user identity migrations';

-- =====================================================
-- USER PROJECTS TABLE
-- Cloud-synced project metadata for registered users
-- =====================================================
CREATE TABLE IF NOT EXISTS user_projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id TEXT NOT NULL, -- Maps to local project ID
    project_name TEXT NOT NULL,
    project_color TEXT,
    workspace_type TEXT NOT NULL CHECK (workspace_type IN ('personalUno', 'personalMulti', 'teamWorkspace')),
    last_modified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, project_id)
);

-- Index for user project lookups
CREATE INDEX IF NOT EXISTS idx_user_projects_user_id ON user_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_user_projects_modified ON user_projects(user_id, last_modified_at DESC);

-- Enable Row Level Security
ALTER TABLE user_projects ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own projects
CREATE POLICY "Users can view own projects"
    ON user_projects
    FOR SELECT
    USING (user_id = auth.uid());

-- RLS Policy: Users can manage their own projects
CREATE POLICY "Users can manage own projects"
    ON user_projects
    FOR ALL
    USING (user_id = auth.uid());

-- Table comment
COMMENT ON TABLE user_projects IS 'User-owned project metadata for cloud synchronization';

-- =====================================================
-- UPDATE EXISTING TABLES RLS POLICIES
-- Ensure existing tables have proper user-scoped policies
-- =====================================================

-- Update yjs_checkpoints to support authenticated users
-- Note: Existing policies allow authenticated role, which is correct
-- Additional policy for user-scoped checkpoints
CREATE POLICY IF NOT EXISTS "Users can view their checkpoints"
    ON yjs_checkpoints
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to get or create device linkage
CREATE OR REPLACE FUNCTION link_device_to_user(
    p_user_id UUID,
    p_device_id TEXT,
    p_device_name TEXT DEFAULT NULL,
    p_device_fingerprint TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    device_record_id UUID;
BEGIN
    -- Try to update existing device (idempotent)
    UPDATE user_devices
    SET last_seen_at = NOW(),
        device_name = COALESCE(p_device_name, device_name),
        device_fingerprint = COALESCE(p_device_fingerprint, device_fingerprint)
    WHERE user_id = p_user_id AND device_id = p_device_id
    RETURNING id INTO device_record_id;
    
    -- If not found, insert new
    IF device_record_id IS NULL THEN
        INSERT INTO user_devices (user_id, device_id, device_name, device_fingerprint)
        VALUES (p_user_id, p_device_id, p_device_name, p_device_fingerprint)
        RETURNING id INTO device_record_id;
    END IF;
    
    RETURN device_record_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log migration start
CREATE OR REPLACE FUNCTION start_identity_migration(
    p_old_device_id TEXT,
    p_new_user_id UUID,
    p_exported_data_size INTEGER DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    migration_id UUID;
BEGIN
    INSERT INTO identity_migrations (
        old_device_id,
        new_user_id,
        migration_status,
        exported_data_size
    ) VALUES (
        p_old_device_id,
        p_new_user_id,
        'in_progress',
        p_exported_data_size
    )
    RETURNING id INTO migration_id;
    
    RETURN migration_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to complete migration
CREATE OR REPLACE FUNCTION complete_identity_migration(
    p_migration_id UUID,
    p_device_count INTEGER,
    p_project_count INTEGER
)
RETURNS VOID AS $$
BEGIN
    UPDATE identity_migrations
    SET migration_status = 'completed',
        device_count_migrated = p_device_count,
        project_count_migrated = p_project_count,
        completed_at = NOW()
    WHERE id = p_migration_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to fail migration
CREATE OR REPLACE FUNCTION fail_identity_migration(
    p_migration_id UUID,
    p_error_message TEXT
)
RETURNS VOID AS $$
BEGIN
    UPDATE identity_migrations
    SET migration_status = 'failed',
        error_message = p_error_message,
        completed_at = NOW()
    WHERE id = p_migration_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to rollback migration
CREATE OR REPLACE FUNCTION rollback_identity_migration(
    p_migration_id UUID
)
RETURNS VOID AS $$
BEGIN
    UPDATE identity_migrations
    SET migration_status = 'rolled_back',
        rolled_back_at = NOW()
    WHERE id = p_migration_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's linked devices
CREATE OR REPLACE FUNCTION get_user_devices(p_user_id UUID)
RETURNS TABLE (
    device_id TEXT,
    device_name TEXT,
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ud.device_id,
        ud.device_name,
        ud.last_seen_at,
        ud.created_at
    FROM user_devices ud
    WHERE ud.user_id = p_user_id
    ORDER BY ud.last_seen_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- CLEANUP FUNCTION FOR ORPHANED ANONYMOUS DATA
-- =====================================================

-- Function to clean up old migration records (retention: 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_migrations()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM identity_migrations
    WHERE completed_at < NOW() - INTERVAL '90 days'
    AND migration_status IN ('completed', 'failed', 'rolled_back');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
