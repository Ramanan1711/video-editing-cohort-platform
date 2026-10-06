import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();

interface EnvMap {
  [key: string]: string;
}

function loadEnvFile(): EnvMap {
  const envPath = path.join(ROOT_DIR, '.env');
  const env: EnvMap = {};
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

interface EdgeFunctionSpec {
  name: string;
  path: string;
  description: string;
  requiredSecrets: string[];
  optionalSecrets: string[];
  requiresNoVerifyJwt: boolean;
}

const EDGE_FUNCTIONS: EdgeFunctionSpec[] = [
  {
    name: 'create-razorpay-order',
    path: 'supabase/functions/create-razorpay-order/index.ts',
    description: 'Initializes server-authoritative Razorpay orders and atomically reserves cohort seats',
    requiredSecrets: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'],
    optionalSecrets: [],
    requiresNoVerifyJwt: false,
  },
  {
    name: 'verify-razorpay-payment',
    path: 'supabase/functions/verify-razorpay-payment/index.ts',
    description: 'Verifies Razorpay HMAC-SHA256 signatures and activates student cohort enrollments',
    requiredSecrets: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'],
    optionalSecrets: [],
    requiresNoVerifyJwt: false,
  },
  {
    name: 'razorpay-webhook',
    path: 'supabase/functions/razorpay-webhook/index.ts',
    description: 'Asynchronous webhook processor for payment.captured, payment.failed, order.paid events',
    requiredSecrets: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'RAZORPAY_WEBHOOK_SECRET'],
    optionalSecrets: [],
    requiresNoVerifyJwt: true, // Crucial: external webhooks do not send Supabase auth tokens
  },
  {
    name: 'unlock-challenges',
    path: 'supabase/functions/unlock-challenges/index.ts',
    description: 'Automated daily challenge scheduler executing midnight unlocks across cohorts',
    requiredSecrets: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
    optionalSecrets: [],
    requiresNoVerifyJwt: false,
  },
];

async function main() {
  console.log('==============================================================================');
  console.log('🔐 Supabase Edge Functions & Server-Side Secrets Configuration Auditor');
  console.log('==============================================================================\n');

  const localEnv = loadEnvFile();
  const supabaseUrl = process.env.VITE_SUPABASE_URL || localEnv.VITE_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || localEnv.VITE_SUPABASE_ANON_KEY || '';
  const razorpayKeyId = process.env.VITE_RAZORPAY_KEY_ID || localEnv.VITE_RAZORPAY_KEY_ID || '';
  const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || localEnv.RAZORPAY_KEY_SECRET || '';
  const razorpayWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || localEnv.RAZORPAY_WEBHOOK_SECRET || '';

  // Extract project ref from URL or file
  let projectRef = '';
  const projectRefFile = path.join(ROOT_DIR, 'supabase', '.temp', 'project-ref');
  if (fs.existsSync(projectRefFile)) {
    projectRef = fs.readFileSync(projectRefFile, 'utf-8').trim();
  } else if (supabaseUrl) {
    const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
    if (match) projectRef = match[1];
  }

  console.log('📡 Environment Identity:');
  console.log(`   Project Ref:       ${projectRef || 'Not linked / unknown'}`);
  console.log(`   Supabase URL:      ${supabaseUrl ? supabaseUrl : 'MISSING'}`);
  console.log(`   Supabase Anon Key: ${supabaseAnonKey ? `${supabaseAnonKey.slice(0, 16)}...` : 'MISSING'}`);
  console.log(`   Razorpay Key ID:   ${razorpayKeyId ? `${razorpayKeyId.slice(0, 14)}... (${razorpayKeyId.startsWith('rzp_live_') ? 'PRODUCTION LIVE' : 'TEST MODE'})` : 'MISSING'}`);
  console.log(`   Razorpay Secret:   ${razorpayKeySecret ? `${razorpayKeySecret.slice(0, 6)}... (Configured locally)` : 'MISSING'}`);
  console.log(`   Webhook Secret:    ${razorpayWebhookSecret ? `${razorpayWebhookSecret.slice(0, 6)}... (Configured locally)` : 'NOT SET in local .env (Mandatory on server-side)'}`);
  console.log('');

  // 1. Audit edge functions on disk
  console.log('📋 Edge Functions Codebase Audit:');
  for (const fn of EDGE_FUNCTIONS) {
    const fullPath = path.join(ROOT_DIR, fn.path);
    const exists = fs.existsSync(fullPath);
    if (!exists) {
      console.log(`   ❌ [${fn.name}]: Source file missing at ${fn.path}`);
      continue;
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    const checkedSecrets: string[] = [];
    for (const secret of fn.requiredSecrets) {
      if (content.includes(secret)) {
        checkedSecrets.push(secret);
      }
    }

    console.log(`   ✅ [${fn.name}]`);
    console.log(`      Purpose: ${fn.description}`);
    console.log(`      Required Secrets: ${fn.requiredSecrets.join(', ')} (Verified in code: ${checkedSecrets.length}/${fn.requiredSecrets.length})`);
    if (fn.requiresNoVerifyJwt) {
      console.log(`      ⚠️  Deployment Flag: MUST be deployed with "--no-verify-jwt" (external gateway webhook)`);
    }
  }

  console.log('\n------------------------------------------------------------------------------');
  console.log('🚀 Server-Side Secrets Configuration Guide:');
  console.log('------------------------------------------------------------------------------');
  console.log('Edge functions execute in a secure isolated Deno runtime on Supabase.');
  console.log('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are automatically injected by Supabase.');
  console.log('Razorpay secrets MUST be uploaded securely into the Supabase Secret Vault:\n');

  console.log('Method 1: Supabase CLI (Recommended)');
  console.log('Run the following command in your terminal:');
  const targetRef = projectRef || '<YOUR_PROJECT_REF>';
  const keyIdVal = razorpayKeyId || 'rzp_live_YOUR_KEY_ID';
  const keySecretVal = razorpayKeySecret || 'YOUR_RAZORPAY_KEY_SECRET';
  const webhookSecretVal = razorpayWebhookSecret || 'YOUR_RAZORPAY_WEBHOOK_SECRET';

  console.log(`
supabase secrets set \\
  RAZORPAY_KEY_ID="${keyIdVal}" \\
  RAZORPAY_KEY_SECRET="${keySecretVal}" \\
  RAZORPAY_WEBHOOK_SECRET="${webhookSecretVal}" \\
  --project-ref ${targetRef}
`);

  console.log('Method 2: Supabase Web Dashboard');
  console.log(`1. Open: https://supabase.com/dashboard/project/${targetRef}/settings/functions`);
  console.log('2. Click "Add new secret" for each of:');
  console.log('   - RAZORPAY_KEY_ID');
  console.log('   - RAZORPAY_KEY_SECRET');
  console.log('   - RAZORPAY_WEBHOOK_SECRET');

  console.log('\n------------------------------------------------------------------------------');
  console.log('📦 Edge Function Deployment Commands:');
  console.log('------------------------------------------------------------------------------');
  console.log('Deploy each Edge Function to your linked Supabase production environment:\n');

  console.log(`# 1. Deploy Create Order Function`);
  console.log(`supabase functions deploy create-razorpay-order --project-ref ${targetRef}\n`);

  console.log(`# 2. Deploy Payment Verification Function`);
  console.log(`supabase functions deploy verify-razorpay-payment --project-ref ${targetRef}\n`);

  console.log(`# 3. Deploy Webhook Receiver (MUST use --no-verify-jwt)`);
  console.log(`supabase functions deploy razorpay-webhook --no-verify-jwt --project-ref ${targetRef}\n`);

  console.log(`# 4. Deploy Challenge Scheduler`);
  console.log(`supabase functions deploy unlock-challenges --project-ref ${targetRef}\n`);

  console.log('------------------------------------------------------------------------------');
  console.log('🔗 Razorpay Dashboard Webhook Registration:');
  console.log('------------------------------------------------------------------------------');
  console.log(`Endpoint URL: https://${targetRef}.supabase.co/functions/v1/razorpay-webhook`);
  console.log(`Secret:       ${webhookSecretVal}`);
  console.log(`Active Events:`);
  console.log(`  - payment.captured  (Activates enrollment automatically upon payment success)`);
  console.log(`  - payment.failed    (Records failed payment and logs telemetry)`);
  console.log(`  - order.paid        (Secondary confirmation gate for asynchronous bank settlements)`);
  console.log('==============================================================================\n');
}

main().catch((err) => {
  console.error('Fatal error during secret check:', err);
  process.exit(1);
});
