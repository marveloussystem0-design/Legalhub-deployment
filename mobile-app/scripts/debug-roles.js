const { createClient } = require('@supabase/supabase-js');
const { config } = require('dotenv');
config({ path: 'd:/Law App/web/.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function debugRoleIssue() {
    // Get all unique roles in case_participants to check capitalization
    const { data: roles, error: rolesError } = await supabase
        .from('case_participants')
        .select('role');
    
    if (rolesError) {
        console.error('Error fetching roles:', rolesError);
        return;
    }

    const uniqueRoles = [...new Set(roles.map(r => r.role))];
    console.log('Unique roles in case_participants:', uniqueRoles);

    // Check if any case has a hearing date soon but isn't showing up
    const { data: allHearings } = await supabase
        .from('case_hearings')
        .select('hearing_date, case_id')
        .gte('hearing_date', new Date().toISOString().split('T')[0])
        .limit(5);
    
    console.log('Sample future hearings:', allHearings);
}

debugRoleIssue();
