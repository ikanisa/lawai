#!/usr/bin/env node

/**
 * Secret Validation Script
 * Validates that production secrets don't contain placeholder values
 * Used in CI/CD to prevent accidental deployment with test secrets
 */

const PLACEHOLDER_PATTERNS = [
  { pattern: /sk-test-/i, name: 'OpenAI test key' },
  { pattern: /sk-demo-/i, name: 'OpenAI demo key' },
  { pattern: /sk-placeholder-/i, name: 'OpenAI placeholder key' },
  { pattern: /example\.supabase\.co/i, name: 'Supabase example URL' },
  { pattern: /localhost/i, name: 'Localhost URL' },
  { pattern: /127\.0\.0\.1/i, name: 'Localhost IP' },
  { pattern: /your-project-ref/i, name: 'Project ref placeholder' },
  { pattern: /your-secret-here/i, name: 'Generic secret placeholder' },
];

const REQUIRED_SECRETS = [
  'OPENAI_API_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
];

function validateSecrets() {
  console.log('🔒 Validating production secrets...\n');
  
  let hasErrors = false;
  const warnings = [];
  
  // Check for required secrets
  for (const secretName of REQUIRED_SECRETS) {
    const secretValue = process.env[secretName];
    
    if (!secretValue) {
      console.error(`❌ ERROR: Required secret "${secretName}" is not set`);
      hasErrors = true;
      continue;
    }
    
    // Check for placeholder patterns
    for (const { pattern, name } of PLACEHOLDER_PATTERNS) {
      if (pattern.test(secretValue)) {
        console.error(`❌ ERROR: Secret "${secretName}" contains placeholder value: ${name}`);
        console.error(`   Pattern detected: ${pattern.source}`);
        hasErrors = true;
      }
    }
    
    // Check for minimum length (basic sanity check)
    if (secretValue.length < 10) {
      warnings.push(`⚠️  WARNING: Secret "${secretName}" is suspiciously short (${secretValue.length} chars)`);
    }
  }
  
  // Print warnings
  if (warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    warnings.forEach(warning => console.log(warning));
  }
  
  // Final result
  if (hasErrors) {
    console.error('\n❌ Secret validation FAILED');
    console.error('Fix the issues above before deploying to production');
    process.exit(1);
  } else {
    console.log('\n✅ All secrets validated successfully');
    process.exit(0);
  }
}

// Run validation
validateSecrets();
