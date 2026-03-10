-- Migration: Add frequency column to day_tasks
ALTER TABLE day_tasks ADD COLUMN IF NOT EXISTS frequency TEXT DEFAULT 'once' CHECK (frequency IN ('once', 'daily', 'weekly', 'monthly'));
