-- Migration: Create audit_logs table for SOC2 compliance
-- Created: April 26, 2026
-- Description: Production-grade audit logging with RLS policies

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT,
    action TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('auth', 'sync', 'transport', 'encryption', 'access', 'system')),
    success BOOLEAN NOT NULL,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    session_id TEXT,
    room_id_hash TEXT,
    client_id TEXT
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON audit_logs(category);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_room_id ON audit_logs(room_id_hash);

-- Composite index for common filter patterns
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_timestamp ON audit_logs(user_id, timestamp DESC);

-- Enable Row Level Security
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own audit logs
CREATE POLICY "Users can view own audit logs"
    ON audit_logs
    FOR SELECT
    USING (auth.uid()::text = user_id OR user_id IS NULL);

-- RLS Policy: Service role can insert all audit logs
CREATE POLICY "Service role can insert audit logs"
    ON audit_logs
    FOR INSERT
    WITH CHECK (true);

-- RLS Policy: Users cannot delete audit logs (immutability)
CREATE POLICY "No deletion of audit logs"
    ON audit_logs
    FOR DELETE
    USING (false);

-- RLS Policy: Users cannot update audit logs (immutability)
CREATE POLICY "No updates to audit logs"
    ON audit_logs
    FOR UPDATE
    USING (false);

-- Add table comment
COMMENT ON TABLE audit_logs IS 'SOC2 compliant audit logging for all user actions and system events';

-- Create function for GDPR data export
CREATE OR REPLACE FUNCTION export_user_audit_logs(p_user_id TEXT)
RETURNS TABLE (
    id UUID,
    action TEXT,
    category TEXT,
    success BOOLEAN,
    details JSONB,
    timestamp TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        audit_logs.id,
        audit_logs.action,
        audit_logs.category,
        audit_logs.success,
        audit_logs.details,
        audit_logs.timestamp
    FROM audit_logs
    WHERE audit_logs.user_id = p_user_id
    ORDER BY audit_logs.timestamp DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function for GDPR data deletion (right to be forgotten)
CREATE OR REPLACE FUNCTION delete_user_audit_logs(p_user_id TEXT)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Anonymize instead of hard delete for audit trail integrity
    UPDATE audit_logs
    SET 
        user_id = '[DELETED]',
        ip_address = NULL,
        user_agent = NULL,
        session_id = NULL,
        client_id = NULL,
        details = details - 'userId' - 'email' - 'userName'
    WHERE user_id = p_user_id;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create cleanup function for old audit logs (retention: 1 year)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM audit_logs
    WHERE timestamp < NOW() - INTERVAL '1 year';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
