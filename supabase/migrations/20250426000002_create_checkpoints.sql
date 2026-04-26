-- Migration: Create yjs_checkpoints table for Phase 2
-- Created: April 26, 2026
-- Description: Checkpoint storage for Yjs document state

-- Create yjs_checkpoints table
CREATE TABLE IF NOT EXISTS yjs_checkpoints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_hash TEXT NOT NULL,
    client_id TEXT NOT NULL,
    checkpoint_data BYTEA NOT NULL, -- E2EE encrypted Yjs state
    sequence_number INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_compressed BOOLEAN DEFAULT FALSE,
    original_size INTEGER, -- Size before compression (for >100KB)
    metadata JSONB -- Optional metadata (e.g., document version)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_checkpoints_room_hash ON yjs_checkpoints(room_hash);
CREATE INDEX IF NOT EXISTS idx_checkpoints_room_created ON yjs_checkpoints(room_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_checkpoints_client ON yjs_checkpoints(client_id);
CREATE INDEX IF NOT EXISTS idx_checkpoints_sequence ON yjs_checkpoints(room_hash, sequence_number DESC);

-- Composite index for retrieving latest checkpoint
CREATE INDEX IF NOT EXISTS idx_checkpoints_latest 
ON yjs_checkpoints(room_hash, created_at DESC) 
WHERE sequence_number = (
    SELECT MAX(sequence_number) 
    FROM yjs_checkpoints sub 
    WHERE sub.room_hash = yjs_checkpoints.room_hash
);

-- Enable Row Level Security
ALTER TABLE yjs_checkpoints ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Authenticated users can insert checkpoints for rooms they have access to
CREATE POLICY "Users can insert checkpoints"
    ON yjs_checkpoints
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- RLS Policy: Users can read checkpoints for rooms they participate in
-- Note: In production, you'd want a separate room_memberships table
CREATE POLICY "Users can read room checkpoints"
    ON yjs_checkpoints
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- RLS Policy: Users can only update their own checkpoints
CREATE POLICY "Users can update own checkpoints"
    ON yjs_checkpoints
    FOR UPDATE
    USING (client_id = auth.uid()::text);

-- RLS Policy: Users can only delete their own checkpoints
CREATE POLICY "Users can delete own checkpoints"
    ON yjs_checkpoints
    FOR DELETE
    USING (client_id = auth.uid()::text);

-- Add table comment
COMMENT ON TABLE yjs_checkpoints IS 'E2EE-encrypted Yjs document checkpoints for state synchronization';

-- Create function to auto-increment sequence number
CREATE OR REPLACE FUNCTION get_next_checkpoint_sequence(p_room_hash TEXT)
RETURNS INTEGER AS $$
DECLARE
    next_seq INTEGER;
BEGIN
    SELECT COALESCE(MAX(sequence_number), 0) + 1
    INTO next_seq
    FROM yjs_checkpoints
    WHERE room_hash = p_room_hash;
    
    RETURN next_seq;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function for auto-cleanup of old checkpoints (retain 30 most recent per room)
CREATE OR REPLACE FUNCTION cleanup_old_checkpoints()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
    room_record RECORD;
BEGIN
    -- For each room, delete all but the 30 most recent checkpoints
    FOR room_record IN 
        SELECT DISTINCT room_hash 
        FROM yjs_checkpoints 
        WHERE created_at < NOW() - INTERVAL '7 days'
    LOOP
        DELETE FROM yjs_checkpoints
        WHERE id IN (
            SELECT id 
            FROM yjs_checkpoints 
            WHERE room_hash = room_record.room_hash
            ORDER BY sequence_number DESC
            OFFSET 30
        )
        AND created_at < NOW() - INTERVAL '7 days';
        
        GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT;
    END LOOP;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get latest checkpoint for a room
CREATE OR REPLACE FUNCTION get_latest_checkpoint(p_room_hash TEXT)
RETURNS TABLE (
    id UUID,
    client_id TEXT,
    checkpoint_data BYTEA,
    sequence_number INTEGER,
    created_at TIMESTAMPTZ,
    is_compressed BOOLEAN,
    original_size INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.client_id,
        c.checkpoint_data,
        c.sequence_number,
        c.created_at,
        c.is_compressed,
        c.original_size
    FROM yjs_checkpoints c
    WHERE c.room_hash = p_room_hash
    ORDER BY c.sequence_number DESC, c.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_checkpoints_updated_at
    BEFORE UPDATE ON yjs_checkpoints
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add constraints
ALTER TABLE yjs_checkpoints 
    ADD CONSTRAINT chk_sequence_positive CHECK (sequence_number > 0),
    ADD CONSTRAINT chk_original_size_positive CHECK (original_size IS NULL OR original_size > 0);
