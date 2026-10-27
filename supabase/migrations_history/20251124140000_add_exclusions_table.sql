-- Add exclusions table for gifting restrictions
-- This allows specifying that person A cannot give to person B

CREATE TABLE exclusions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  giver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  excluded_receiver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Prevent duplicate exclusions
  UNIQUE(group_id, giver_id, excluded_receiver_id),
  -- Prevent self-exclusion (redundant since algorithm already prevents self-assignment)
  CHECK (giver_id != excluded_receiver_id)
);

-- Indexes for performance
CREATE INDEX idx_exclusions_group_id ON exclusions(group_id);
CREATE INDEX idx_exclusions_giver_id ON exclusions(giver_id);

-- RLS Policies
ALTER TABLE exclusions ENABLE ROW LEVEL SECURITY;

-- Members can view exclusions in their groups
CREATE POLICY "Members can view group exclusions" ON exclusions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM members
      WHERE members.group_id = exclusions.group_id
      AND members.user_id = auth.uid()
    )
  );

-- Admin can manage exclusions
CREATE POLICY "Admin can insert exclusions" ON exclusions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM groups
      WHERE groups.id = exclusions.group_id
      AND groups.admin_id = auth.uid()
    )
  );

CREATE POLICY "Admin can delete exclusions" ON exclusions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM groups
      WHERE groups.id = exclusions.group_id
      AND groups.admin_id = auth.uid()
    )
  );

-- Comment to document the table
COMMENT ON TABLE exclusions IS 'Gifting restrictions: prevents giver_id from being assigned excluded_receiver_id in Secret Santa draw';
