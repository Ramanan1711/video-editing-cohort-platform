import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ROOT_DIR = process.cwd();
const BOOTSTRAP_SQL = path.join(ROOT_DIR, 'supabase', 'bootstrap_complete_schema.sql');
const MANIFEST_PATH = path.join(ROOT_DIR, 'supabase', 'migrations_manifest.json');

// Core tables required for production readiness
const REQUIRED_TABLES = [
  'profiles',
  'cohorts',
  'enrollments',
  'mentor_cohorts',
  'courses',
  'modules',
  'lessons',
  'lesson_progress',
  'lesson_resources',
  'assignments',
  'submissions',
  'submission_versions',
  'feedback',
  'feedback_replies',
  'live_sessions',
  'session_attendance',
  'announcements',
  'notifications',
  'daily_challenges',
  'daily_challenge_submissions',
  'internship_reports',
  'whatsapp_notifications_log',
  'audit_logs',
  'app_error_logs',
  'community_posts',
  'community_comments',
  'community_reactions',
  'community_reports',
  'community_messages',
  'certificates',
  'payments',
];

function loadEnvFile(): Record<string, string> {
  const envPath = path.join(ROOT_DIR, '.env');
  const env: Record<string, string> = {};
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
        env[key] = val;
      }
    }
  }
  return env;
}

async function main() {
  console.log('==============================================================================');
  console.log('🚀 CUT / CRAFT Video Editing Cohort Platform: Database Bootstrap & Health Check');
  console.log('==============================================================================\n');

  if (!fs.existsSync(BOOTSTRAP_SQL)) {
    console.error('❌ Missing bootstrap file. Run "npm run migrations:bundle" first.');
    process.exit(1);
  }

  const manifest = fs.existsSync(MANIFEST_PATH)
    ? JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'))
    : null;

  console.log(`📦 Consolidated Schema Bootstrap: ${path.relative(ROOT_DIR, BOOTSTRAP_SQL)}`);
  console.log(`📊 Total Managed Migrations: ${manifest ? manifest.migrationCount : '39'}`);

  const localEnv = loadEnvFile();
  const supabaseUrl = process.env.VITE_SUPABASE_URL || localEnv.VITE_SUPABASE_URL || '';
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || localEnv.VITE_SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseKey) {
    console.log('\n⚠️  Notice: No VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY detected in environment.');
    console.log('    To apply migrations, use one of the following methods:\n');
    printBootstrapInstructions();
    return;
  }

  console.log(`\n📡 Probing target Supabase endpoint: ${supabaseUrl}`);
  const client = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  const reachableTables: string[] = [];
  const unreachableTables: string[] = [];

  for (const table of REQUIRED_TABLES) {
    try {
      const { error } = await client.from(table).select('count', { count: 'exact', head: true });
      // If error is 42P01 (relation does not exist), table is missing
      if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
        unreachableTables.push(table);
      } else {
        // Table exists (even if RLS blocks reading data, table exists in catalog)
        reachableTables.push(table);
      }
    } catch {
      unreachableTables.push(table);
    }
  }

  console.log(`\n📋 Database Table Readiness Scorecard:`);
  console.log(`   ✅ Present / Verified: ${reachableTables.length}/${REQUIRED_TABLES.length}`);
  if (unreachableTables.length > 0) {
    console.log(`   ⚠️  Pending or Missing: ${unreachableTables.length}/${REQUIRED_TABLES.length} (${unreachableTables.join(', ')})`);
    console.log('\n🔧 Action Required: Apply bootstrap schema to target database.');
    printBootstrapInstructions();
  } else {
    console.log(`   🎉 All ${REQUIRED_TABLES.length} required tables are present in the target database catalog!`);
  }
}

function printBootstrapInstructions() {
  console.log('------------------------------------------------------------------------------');
  console.log('📖 Canonical Database Deployment & Bootstrap Methods:');
  console.log('------------------------------------------------------------------------------');
  console.log('Option 1 (Supabase Dashboard - Recommended for quick setup):');
  console.log('  1. Open your project at https://supabase.com/dashboard/project/<your-project-id>');
  console.log('  2. Navigate to SQL Editor > New query');
  console.log('  3. Paste the contents of supabase/bootstrap_complete_schema.sql');
  console.log('  4. Click "Run" to bootstrap the entire schema with all RLS policies and RPCs.\n');
  console.log('Option 2 (Supabase CLI):');
  console.log('  supabase db push\n');
  console.log('Option 3 (Direct psql connection):');
  console.log('  psql "$DATABASE_URL" -f supabase/bootstrap_complete_schema.sql');
  console.log('------------------------------------------------------------------------------\n');
}

main().catch((err) => {
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});
