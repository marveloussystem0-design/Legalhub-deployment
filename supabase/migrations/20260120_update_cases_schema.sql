-- Add new fields to cases table for eCourts compatibility
ALTER TABLE cases
ADD COLUMN IF NOT EXISTS subject_matter TEXT,
ADD COLUMN IF NOT EXISTS act_rule_applicable TEXT,
ADD COLUMN IF NOT EXISTS relief_sought TEXT;
