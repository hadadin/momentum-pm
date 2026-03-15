-- ============================================================
-- Momentum PM v2 — New tables & columns
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Goals table (weekly focus + daily top 3)
CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('weekly', 'daily')),
  text TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  linked_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE goals DISABLE ROW LEVEL SECURITY;

-- 2. Time blocks table (for calendar scheduling)
CREATE TABLE IF NOT EXISTS time_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TEXT NOT NULL, -- HH:mm format
  end_time TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE time_blocks DISABLE ROW LEVEL SECURITY;

-- 3. Subtasks table
CREATE TABLE IF NOT EXISTS subtasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE subtasks DISABLE ROW LEVEL SECURITY;

-- 4. Add new columns to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS focused_time_spent INTEGER DEFAULT 0;

-- 5. Add new columns to kpi_entries
ALTER TABLE kpi_entries ADD COLUMN IF NOT EXISTS unit TEXT;
ALTER TABLE kpi_entries ADD COLUMN IF NOT EXISTS trend TEXT CHECK (trend IN ('up', 'down', 'neutral'));
ALTER TABLE kpi_entries ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT false;
ALTER TABLE kpi_entries ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- 6. Add project_id to meetings
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'tasks_created'));
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS extracted_action_items JSONB;

-- 7. Add settings columns to workspaces
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS work_start_hour INTEGER DEFAULT 9;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS work_end_hour INTEGER DEFAULT 18;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS week_starts_on INTEGER DEFAULT 0;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS default_task_duration INTEGER DEFAULT 60;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS show_weekends BOOLEAN DEFAULT false;

-- Done!
