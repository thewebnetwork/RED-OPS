#!/usr/bin/env node

/**
 * i18n CI Check Script
 * 
 * Designed for CI/CD pipelines. Exits with:
 * - 0: No missing keys (hardcoded strings are warnings only)
 * - 1: Missing translation keys detected (blocking)
 * 
 * Usage in CI:
 *   npm run i18n:ci
 * 
 * Environment variables:
 *   I18N_STRICT=true    - Also fail on hardcoded strings
 *   I18N_VERBOSE=true   - Show detailed output
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const isStrict = process.env.I18N_STRICT === 'true';
const isVerbose = process.env.I18N_VERBOSE === 'true';

const localesDir = path.join(__dirname, '../src/i18n/locales');
const srcDir = path.join(__dirname, '../src');

// Flatten object helper
function flattenObject(obj, prefix = '') {
  const result = {};
  for (const key in obj) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      Object.assign(result, flattenObject(obj[key], newKey));
    } else {
      result[newKey] = obj[key];
    }
  }
  return result;
}

// Load locales
const supportedLocales = ['en', 'es', 'pt'];
const locales = {};

for (const locale of supportedLocales) {
  try {
    const content = fs.readFileSync(path.join(localesDir, `${locale}.json`), 'utf8');
    locales[locale] = flattenObject(JSON.parse(content));
  } catch (e) {
    console.error(`❌ Failed to load ${locale}.json: ${e.message}`);
    process.exit(1);
  }
}

// Check for missing keys
const missingKeys = [];
const enKeys = locales.en;

for (const locale of ['es', 'pt']) {
  const localeKeys = locales[locale];
  for (const key in enKeys) {
    if (!(key in localeKeys)) {
      missingKeys.push({ locale, key });
    }
  }
}

// Count hardcoded strings (simplified detection)
let hardcodedCount = 0;

const files = glob.sync('**/*.{js,jsx}', {
  cwd: srcDir,
  ignore: ['node_modules/**', 'i18n/**', '**/*.test.*']
});

const hardcodedPattern = /toast\.(error|success|info|warning)\s*\(\s*["']([^"']+)["']\s*\)/g;

for (const file of files) {
  const content = fs.readFileSync(path.join(srcDir, file), 'utf8');
  if (!content.includes('t(') || content.includes('t(\'') === false) {
    const matches = content.match(hardcodedPattern);
    if (matches) {
      hardcodedCount += matches.length;
    }
  }
}

// Output results
console.log('\n📊 i18n CI Check Results');
console.log('========================');
console.log(`Total EN keys: ${Object.keys(enKeys).length}`);
console.log(`Total ES keys: ${Object.keys(locales.es).length}`);
console.log(`Total PT keys: ${Object.keys(locales.pt).length}`);
console.log(`Missing keys: ${missingKeys.length}`);
console.log(`Hardcoded strings (approx): ${hardcodedCount}`);

if (isVerbose && missingKeys.length > 0) {
  console.log('\nMissing keys:');
  for (const { locale, key } of missingKeys.slice(0, 20)) {
    console.log(`  ${locale}: ${key}`);
  }
  if (missingKeys.length > 20) {
    console.log(`  ... and ${missingKeys.length - 20} more`);
  }
}

// Determine exit code
let exitCode = 0;
let status = '✅ PASS';

if (missingKeys.length > 0) {
  exitCode = 1;
  status = '❌ FAIL - Missing translation keys';
} else if (isStrict && hardcodedCount > 0) {
  exitCode = 1;
  status = '❌ FAIL - Hardcoded strings detected (strict mode)';
} else if (hardcodedCount > 0) {
  status = '⚠️  WARN - Hardcoded strings detected (non-blocking)';
}

console.log(`\n${status}\n`);
process.exit(exitCode);
