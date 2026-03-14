-- Migration: Add day_tasks table (run if you already have the base schema)
CREATE TABLE IF NOT EXISTS day_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  task_date DATE NOT NULL,
  title TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE day_tasks ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_day_tasks_user ON day_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_day_tasks_date ON day_tasks(user_id, task_date);
