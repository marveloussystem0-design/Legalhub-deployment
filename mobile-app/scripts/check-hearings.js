const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const env = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
const envMap = {};
env.split('\n').forEach(l => {
  const idx = l.indexOf('=');
  if (idx > -1) envMap[l.slice(0, idx).trim()] = l.slice(idx + 1).trim();
});

const supabase = createClient(
  envMap.EXPO_PUBLIC_SUPABASE_URL,
  envMap.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const tenDays = new Date();
  tenDays.setDate(tenDays.getDate() + 10);
  const tenDaysStr = tenDays.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  console.log('Today (IST):', todayStr, '| +10 days:', tenDaysStr);

  // 1. Check case_hearings
  const { data: hRows } = await supabase
    .from('case_hearings')
    .select('id, case_id, hearing_date, hearing_type')
    .gte('hearing_date', todayStr)
    .limit(10);
  console.log('\n[case_hearings] future rows:', hRows?.length ?? 0);
  if (hRows?.length) console.log('Sample:', hRows.slice(0, 3));

  // 2. Check next_hearing_date column
  const { data: nhd } = await supabase
    .from('cases')
    .select('id, title, next_hearing_date')
    .gte('next_hearing_date', todayStr)
    .order('next_hearing_date')
    .limit(10);
  console.log('\n[cases.next_hearing_date] future rows:', nhd?.length ?? 0);
  if (nhd?.length) console.log('Sample:', nhd.slice(0, 3).map(x => ({ t: x.title?.slice(0, 30), d: x.next_hearing_date })));

  // 3. Check metadata JSON
  const { data: cases } = await supabase
    .from('cases')
    .select('id, title, metadata')
    .not('metadata', 'is', null)
    .limit(500);

  console.log('\n[cases.metadata] total cases with metadata:', cases?.length ?? 0);

  let withDate = 0;
  const allDates = [];
  const withinWindow = [];

  for (const c of cases || []) {
    const raw = c.metadata?.full_details?.['Next Hearing Date'];
    if (!raw) continue;
    withDate++;
    // Clean ordinal suffixes: 13th -> 13
    const clean = raw.replace(/(\d+)(st|nd|rd|th)/i, '$1');
    const d = new Date(clean);
    if (!isNaN(d.getTime())) {
      const ds = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      allDates.push(ds);
      if (ds >= todayStr && ds <= tenDaysStr) {
        withinWindow.push({ title: c.title?.slice(0, 30), raw, parsed: ds });
      }
    }
  }

  console.log('Cases with metadata Next Hearing Date:', withDate);
  console.log('Within 10-day window:', withinWindow.length);
  if (withinWindow.length) {
    console.log('Matches:', JSON.stringify(withinWindow, null, 2));
  } else {
    allDates.sort();
    console.log('All parsed dates (first 10):', allDates.slice(0, 10));
    console.log('All parsed dates (last 5):', allDates.slice(-5));
    // Check if web's 3 hearings might be from a different WIDER window
    console.log('\n--- Checking count per source (no date filter) ---');
    console.log('Total metadata dates found:', allDates.length);
    const futureOnly = allDates.filter(d => d >= todayStr);
    console.log('Future metadata dates:', futureOnly.length, futureOnly.slice(0, 5));
  }
})();
