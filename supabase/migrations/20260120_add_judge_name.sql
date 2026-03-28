-- Add judge_name column to vc_meeting_links table
ALTER TABLE vc_meeting_links 
ADD COLUMN IF NOT EXISTS judge_name VARCHAR(255);
