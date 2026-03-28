/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const https = require("node:https");
const { createClient } = require("@supabase/supabase-js");
const puppeteer = require("puppeteer");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const requiredEnv = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_ENCRYPTION_SALT",
  "CRON_SECRET",
];

const requiredTables = [
  "profiles",
  "cases",
  "case_participants",
  "case_hearings",
  "documents",
  "notifications",
  "ecourts_cases",
  "case_ecourts_links",
  "case_user_preferences",
  "invites",
];

function checkMigrationLayout() {
  const countSqlFiles = (dir) => {
    if (!fs.existsSync(dir)) return 0;
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".sql")).length;
  };

  const cwd = process.cwd();
  const rootCandidates = [
    path.resolve(cwd, "supabase", "migrations"),
    path.resolve(cwd, "..", "supabase", "migrations"),
  ];
  const rootMigrationsDir =
    rootCandidates.find((candidate) => countSqlFiles(candidate) > 0) ||
    rootCandidates.find((candidate) => fs.existsSync(candidate)) ||
    rootCandidates[0];

  const deprecatedCandidates = [
    path.resolve(cwd, "web", "supabase", "migrations"),
    path.resolve(cwd, "supabase", "migrations"),
  ];
  const deprecatedWebMigrationsDir =
    deprecatedCandidates.find((candidate) => candidate !== rootMigrationsDir && fs.existsSync(candidate)) ||
    deprecatedCandidates[0];

  if (!fs.existsSync(rootMigrationsDir)) {
    fail("Missing source-of-truth migration directory: supabase/migrations (repo root)");
    return false;
  }

  const readSqlFiles = (dir) =>
    fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".sql"))
      .map((entry) => entry.name)
      .sort();

  const rootFiles = readSqlFiles(rootMigrationsDir);
  if (rootFiles.length === 0) {
    fail("No SQL migrations found in supabase/migrations");
    return false;
  }
  ok(`Root migration directory detected with ${rootFiles.length} SQL files`);

  if (fs.existsSync(deprecatedWebMigrationsDir)) {
    const webFiles = readSqlFiles(deprecatedWebMigrationsDir);
    if (webFiles.length > 0) {
      fail(
        `Deprecated migration directory web/supabase/migrations still has ${webFiles.length} SQL files. Keep only root supabase/migrations.`
      );
      console.log(
        `FAIL Remove from web/supabase/migrations: ${webFiles.slice(0, 10).join(", ")}${webFiles.length > 10 ? " ..." : ""}`
      );
      return false;
    }
  }

  ok("Migration layout is clean (single source-of-truth)");
  return true;
}

function ok(message) {
  console.log(`OK   ${message}`);
}

function fail(message) {
  console.log(`FAIL ${message}`);
}

function hasAllEnv() {
  const missing = requiredEnv.filter((name) => !process.env[name] || !String(process.env[name]).trim());
  if (missing.length > 0) {
    fail(`Missing required env vars: ${missing.join(", ")}`);
    return false;
  }
  ok("Required env vars are present");
  return true;
}

async function checkTables(supabase) {
  let pass = true;
  for (const table of requiredTables) {
    const { error } = await supabase.from(table).select("*", { head: true, count: "exact" }).limit(1);
    if (error) {
      fail(`Table access failed for '${table}': ${error.message}`);
      pass = false;
    } else {
      ok(`Table accessible: ${table}`);
    }
  }
  return pass;
}

async function checkKeyQueries(supabase) {
  let pass = true;

  const caseList = await supabase
    .from("cases")
    .select("id, title, status, case_hearings(hearing_date), case_participants(user_id, role)")
    .limit(1);
  if (caseList.error) {
    fail(`Cases relational query failed: ${caseList.error.message}`);
    pass = false;
  } else {
    ok("Cases relational query works");
  }

  const ecourtsLink = await supabase
    .from("case_ecourts_links")
    .select("case_id, ecourts_case_id, ecourts_cases(last_synced_at, status)")
    .limit(1);
  if (ecourtsLink.error) {
    fail(`eCourts link relational query failed: ${ecourtsLink.error.message}`);
    pass = false;
  } else {
    ok("eCourts link relational query works");
  }

  const notifProbe = await supabase
    .from("notifications")
    .select("id, user_id, type, category, push_sent, metadata")
    .limit(1);
  if (notifProbe.error) {
    fail(`Notifications query failed: ${notifProbe.error.message}`);
    pass = false;
  } else {
    ok("Notifications query works");
  }

  return pass;
}

async function checkStorage(supabase) {
  const { data, error } = await supabase.storage.listBuckets();
  if (error) {
    fail(`Storage listBuckets failed: ${error.message}`);
    return false;
  }
  const bucketNames = (data || []).map((bucket) => bucket.name);
  if (!bucketNames.includes("case-documents")) {
    fail("Storage bucket 'case-documents' not found");
    return false;
  }
  ok("Storage bucket 'case-documents' exists");
  return true;
}

function checkEcourtsReachability() {
  return new Promise((resolve) => {
    const req = https.get("https://services.ecourts.gov.in/ecourtindia_v6/", { timeout: 10000 }, (res) => {
      if (res.statusCode && res.statusCode >= 200 && res.statusCode < 500) {
        ok(`eCourts endpoint reachable (HTTP ${res.statusCode})`);
        resolve(true);
      } else {
        fail(`eCourts endpoint returned unexpected status: ${res.statusCode}`);
        resolve(false);
      }
      res.resume();
    });
    req.on("timeout", () => {
      req.destroy();
      fail("eCourts endpoint timeout");
      resolve(false);
    });
    req.on("error", (err) => {
      fail(`eCourts endpoint check failed: ${err.message}`);
      resolve(false);
    });
  });
}

async function checkPuppeteerRuntime() {
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (executablePath && !fs.existsSync(executablePath)) {
    fail(`PUPPETEER_EXECUTABLE_PATH does not exist: ${executablePath}`);
    return false;
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
      ...(executablePath ? { executablePath } : {}),
    });
    const page = await browser.newPage();
    await page.goto("about:blank");
    ok("Puppeteer launch smoke test passed");
    return true;
  } catch (err) {
    fail(`Puppeteer launch failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    return false;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

async function main() {
  console.log("== Production Readiness Doctor ==");
  const migrationsOk = checkMigrationLayout();
  if (!migrationsOk) {
    console.log(
      "FAIL Run SQL assertions before deploy: supabase/predeploy/20260318_predeploy_assertions.sql"
    );
    process.exitCode = 1;
  }

  const envOk = hasAllEnv();
  if (!envOk) {
    process.exitCode = 1;
    return;
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const checks = await Promise.all([
    checkTables(supabase),
    checkKeyQueries(supabase),
    checkStorage(supabase),
    checkEcourtsReachability(),
    checkPuppeteerRuntime(),
  ]);

  const allPassed = checks.every(Boolean);
  if (allPassed) {
    console.log("== PASS: Production readiness checks passed ==");
  } else {
    console.log("== FAIL: One or more readiness checks failed ==");
    process.exitCode = 1;
  }
}

main().catch((err) => {
  fail(err instanceof Error ? err.message : "Unknown failure");
  process.exitCode = 1;
});
