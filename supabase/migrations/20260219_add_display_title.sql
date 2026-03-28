-- Add display_title column to cases table
ALTER TABLE public.cases 
ADD COLUMN IF NOT EXISTS display_title TEXT;

-- Update existing cases to have their current title as display_title if desired,
-- or leave as NULL to fallback. User said "copy the title and keep it there to edit".
-- So let's initialize it.
UPDATE public.cases 
SET display_title = title 
WHERE display_title IS NULL;

COMMENT ON COLUMN public.cases.display_title IS 'User-editable title for the case, distinct from the official eCourts/synced title.';
