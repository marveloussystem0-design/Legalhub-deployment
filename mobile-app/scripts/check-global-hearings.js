const { createClient } = require('@supabase/supabase-js');
const { config } = require('dotenv');
config({ path: 'd:/Law App/web/.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkUpcomingHearings() {
    // Today IST
    const today = new Date();
    const todayStr = today.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    
    const tenDaysOut = new Date(today);
    tenDaysOut.setDate(tenDaysOut.getDate() + 10);
    const tenDaysStr = tenDaysOut.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    console.log(`Window: ${todayStr} to ${tenDaysStr}`);

    // 1. Check case_hearings table
    const { data: tableHearings } = await supabase
        .from('case_hearings')
        .select('*')
        .gte('hearing_date', todayStr)
        .lte('hearing_date', tenDaysStr);
    
    console.log(`Hearings in case_hearings table: ${tableHearings?.length || 0}`);

    // 2. Check cases table metadata
    const { data: casesWithDates } = await supabase
        .from('cases')
        .select('title, next_hearing_date, metadata')
        .not('metadata', 'is', null);

    let foundInMetadata = 0;
    let foundInColumn = 0;

    casesWithDates.forEach(c => {
        if (c.next_hearing_date) {
            const d = new Date(c.next_hearing_date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
            if (d >= todayStr && d <= tenDaysStr) {
                foundInColumn++;
                console.log(`[COLUMN] ${c.title}: ${d}`);
            }
        }

        const metaRaw = c.metadata?.full_details?.['Next Hearing Date'];
        if (metaRaw && typeof metaRaw === 'string') {
            const clean = metaRaw.replace(/(\d+)(st|nd|rd|th)/, '$1');
            const d = new Date(clean);
            if (!isNaN(d.getTime())) {
                const ds = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
                if (ds >= todayStr && ds <= tenDaysStr) {
                    foundInMetadata++;
                    console.log(`[METADATA] ${c.title}: ${ds} (Raw: ${metaRaw})`);
                }
            }
        }
    });

    console.log(`Found in column: ${foundInColumn}`);
    console.log(`Found in metadata: ${foundInMetadata}`);
}

checkUpcomingHearings();
