-- Function to calculate advocate stats securely (bypassing RLS for aggregation)
CREATE OR REPLACE FUNCTION public.get_advocate_public_stats(advocate_uuid UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with privileges of creator (postgres), bypassing RLS
AS $$
DECLARE
    total_count INTEGER;
    won_count INTEGER;
    spec_stats JSONB;
BEGIN
    -- 1. Get Totals (Overall)
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE outcome = 'won')
    INTO total_count, won_count
    FROM cases
    WHERE created_by = advocate_uuid 
      AND status = 'closed'
      AND outcome IS NOT NULL;

    -- 2. Get Per-Specialization Stats using CTE to avoid nested aggregate error
    WITH spec_counts AS (
        SELECT 
            COALESCE(case_type, 'General') as type_name,
            COUNT(*) as type_total,
            COUNT(*) FILTER (WHERE outcome = 'won') as type_won
        FROM cases
        WHERE created_by = advocate_uuid 
          AND status = 'closed'
          AND outcome IS NOT NULL
        GROUP BY case_type
    )
    SELECT jsonb_object_agg(
        type_name, 
        jsonb_build_object(
            'total', type_total,
            'won', type_won
        )
    )
    INTO spec_stats
    FROM spec_counts;

    -- 3. Return Combined JSON
    RETURN jsonb_build_object(
        'total', COALESCE(total_count, 0),
        'won', COALESCE(won_count, 0),
        'bySpec', COALESCE(spec_stats, '{}'::jsonb)
    );
END;
$$;
