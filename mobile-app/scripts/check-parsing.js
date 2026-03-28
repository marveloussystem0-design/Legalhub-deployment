const { createClient } = require('@supabase/supabase-js');
const { config } = require('dotenv');
config({ path: 'd:/Law App/web/.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkDateParsing() {
    const rawDates = [
        "04th March 2026",
        "13th February 2026",
        "1st January 2026",
        "22nd April 2026",
        "3rd June 2026"
    ];

    rawDates.forEach(rd => {
        // Current logic in app:
        const clean = rd.replace(/(\d+)(st|nd|rd|th)/, '$1');
        const d = new Date(clean);
        const iso = d.toISOString().split('T')[0];
        console.log(`Raw: [${rd}] -> Cleaned: [${clean}] -> Parsed: [${iso}] (Valid: ${!isNaN(d.getTime())})`);
    });

    const now = new Date();
    // Replicate App's getISTDateStr
    const getISTDateStr = (d) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    
    console.log(`Current IST Date String (en-CA): ${getISTDateStr(now)}`);
}

checkDateParsing();
