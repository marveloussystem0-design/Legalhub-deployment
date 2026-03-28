const { createClient } = require('@supabase/supabase-js');
const { config } = require('dotenv');
config({ path: 'd:/Law App/web/.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function dumpAdvocateCases() {
    // 1. Get all advocate participations
    const { data: participations } = await supabase
        .from('case_participants')
        .select('case_id, user_id')
        .eq('role', 'advocate');
    
    if (!participations || participations.length === 0) {
        console.log('No advocate participations found.');
        return;
    }

    const caseIds = participations.map(p => p.case_id);
    console.log(`Found ${caseIds.length} advocate participations.`);

    // 2. Fetch those cases
    const { data: cases } = await supabase
        .from('cases')
        .select('id, title, next_hearing_date, metadata')
        .in('id', caseIds);
    
    console.log(`Fetched ${cases?.length} cases.`);

    cases.forEach(c => {
        const metaDate = c.metadata?.full_details?.['Next Hearing Date'];
        console.log(`Case: ${c.title}`);
        console.log(`  next_hearing_date: ${c.next_hearing_date}`);
        console.log(`  Metadata date: ${metaDate}`);
        
        if (metaDate) {
            const clean = metaDate.replace(/(\d+)(st|nd|rd|th)/, '$1');
            const d = new Date(clean);
            console.log(`  Parsed Metadata date: ${d.toISOString().split('T')[0]} (Valid: ${!isNaN(d.getTime())})`);
        }
    });

    const now = new Date();
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    console.log(`Today (IST): ${todayStr}`);
}

dumpAdvocateCases();
