
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../web/.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
  try {
    console.log("--- ADVOCATES ---");
    const { data: advocates } = await supabase.from('advocates').select('full_name, bio, specialization');
    console.log(JSON.stringify(advocates, null, 2));

    console.log("\n--- CASE TYPES ---");
    const { data: cases } = await supabase.from('cases').select('case_type');
    const types = [...new Set(cases?.map(c => c.case_type))];
    console.log(JSON.stringify(types, null, 2));

    console.log("\n--- PARTICIPANTS ---");
    const { data: participants } = await supabase.from('case_participants').select('user_id, role, case_id');
    console.log(JSON.stringify(participants, null, 2));
  } catch (err) {
    console.error(err);
  }
}

checkData();
