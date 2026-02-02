#!/usr/bin/env node

/**
 * i18n Translation Coverage Audit Script
 * 
 * Scans the frontend codebase for:
 * 1. Hardcoded UI strings in JSX (not wrapped in t())
 * 2. Missing translation keys across en.json, es.json, pt.json
 * 3. Unused keys (optional)
 * 
 * Usage: node scripts/i18n-audit.js [--strict] [--fix-suggestions]
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Configuration
const CONFIG = {
  localesDir: path.join(__dirname, '../src/i18n/locales'),
  srcDir: path.join(__dirname, '../src'),
  primaryLocale: 'en',
  supportedLocales: ['en', 'es', 'pt'],
  
  // Patterns to scan for hardcoded strings
  filePatterns: ['**/*.js', '**/*.jsx', '**/*.tsx'],
  excludeDirs: ['node_modules', 'build', 'dist', '.git', 'scripts'],
  
  // Safe patterns that should NOT be flagged (regex)
  safePatterns: [
    /^[0-9.,%]+$/, // Numbers, percentages
    /^#[0-9a-fA-F]{3,8}$/, // Hex colors
    /^(https?:\/\/|mailto:|tel:)/, // URLs
    /^[a-z]+-[a-z]+(-[a-z]+)*$/, // kebab-case IDs (data-testid, etc.)
    /^[A-Z_]+$/, // CONSTANT_CASE
    /^\s*$/, // Whitespace only
    /^(true|false|null|undefined)$/, // JS keywords
    /^(sm|md|lg|xl|2xl|xs)$/, // Tailwind sizes
    /^(left|right|center|top|bottom|start|end)$/, // CSS positions
    /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/, // HTTP methods
    /^(div|span|button|input|form|table|tr|td|th|thead|tbody)$/, // HTML tags
    /^[a-z]+:\/\//, // Protocol URLs
    /^application\//, // MIME types
    /^[A-Za-z0-9+/=]+$/, // Base64-like (if short, ignore)
    /^\d{1,2}:\d{2}/, // Time formats
    /^\d{4}-\d{2}-\d{2}/, // Date formats
  ],
  
  // Component props that typically contain translatable text
  translatableProps: [
    'label', 'placeholder', 'title', 'description', 'message',
    'text', 'children', 'alt', 'aria-label', 'helperText',
    'errorMessage', 'successMessage', 'emptyMessage', 'emptyText',
    'buttonText', 'submitText', 'cancelText', 'confirmText'
  ],
  
  // Allowlist - known exceptions that are intentionally hardcoded
  allowlist: [
    // Brand names
    'Red Ribbon', 'RED OPS', 'Emergent',
    // Technical constants
    'Bearer', 'application/json', 'multipart/form-data',
    // Library-specific
    'monotone', 'basis', 'linear',
  ],
  
  // Key namespace suggestions based on context
  namespaceHints: {
    'button': 'buttons',
    'btn': 'buttons',
    'submit': 'buttons',
    'cancel': 'buttons',
    'save': 'buttons',
    'delete': 'buttons',
    'error': 'errors',
    'failed': 'errors',
    'success': 'success',
    'loading': 'common',
    'form': 'forms',
    'label': 'forms',
    'placeholder': 'forms',
    'validation': 'formValidation',
    'required': 'formValidation',
    'invalid': 'formValidation',
    'modal': 'modals',
    'dialog': 'modals',
    'confirm': 'modals',
    'nav': 'nav',
    'menu': 'nav',
    'sidebar': 'nav',
    'dashboard': 'dashboard',
    'settings': 'settings',
    'user': 'iam',
    'team': 'iam',
    'role': 'iam',
    'ticket': 'tickets',
    'order': 'tickets',
    'status': 'status',
    'sla': 'sla',
    'pool': 'pool',
    'category': 'categories',
  }
};

// Results storage
const results = {
  hardcodedStrings: [],
  missingKeys: [],
  unusedKeys: [],
  keyCountByLocale: {},
  errors: []
};

// ============== UTILITY FUNCTIONS ==============

function loadJsonFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    results.errors.push(`Failed to load ${filePath}: ${error.message}`);
    return null;
  }
}

function flattenObject(obj, prefix = '') {
  const flattened = {};
  
  for (const key in obj) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      Object.assign(flattened, flattenObject(obj[key], newKey));
    } else {
      flattened[newKey] = obj[key];
    }
  }
  
  return flattened;
}

function isSafeString(str) {
  // Check against safe patterns
  for (const pattern of CONFIG.safePatterns) {
    if (pattern.test(str)) return true;
  }
  
  // Check allowlist
  if (CONFIG.allowlist.some(allowed => str.includes(allowed))) return true;
  
  // Very short strings (1-2 chars) are usually safe
  if (str.length <= 2) return true;
  
  // Strings that look like code/technical
  if (/^[a-z_]+\.[a-z_]+/i.test(str)) return true; // dot notation
  if (/^\$\{/.test(str)) return true; // template literals
  if (/^[A-Z][a-z]+[A-Z]/.test(str) && str.length < 20) return true; // camelCase components
  
  return false;
}

function suggestNamespace(str, context = '') {
  const lowerStr = str.toLowerCase();
  const lowerContext = context.toLowerCase();
  
  for (const [hint, namespace] of Object.entries(CONFIG.namespaceHints)) {
    if (lowerStr.includes(hint) || lowerContext.includes(hint)) {
      return namespace;
    }
  }
  
  return 'common';
}

function generateKeyName(str) {
  // Convert string to a reasonable key name
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .map((word, i) => i === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

// ============== HARDCODED STRING DETECTION ==============

function findHardcodedStrings(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const relativePath = path.relative(CONFIG.srcDir, filePath);
  
  // Skip non-component files
  if (relativePath.includes('i18n/') || relativePath.includes('test') || relativePath.includes('.test.')) {
    return;
  }
  
  // Patterns to detect hardcoded strings in JSX
  const patterns = [
    // Direct string in JSX: >Some text<
    />\s*([A-Z][a-zA-Z\s]{3,}[a-z])\s*</g,
    
    // String props: label="Some text"
    /(label|placeholder|title|description|message|text|alt|emptyMessage|emptyText)=["']([^"']+)["']/g,
    
    // toast.error/success with hardcoded strings
    /toast\.(error|success|info|warning)\s*\(\s*["']([^"']+)["']\s*\)/g,
    
    // Button/Label with direct children
    /<(Button|Label|CardTitle|CardDescription|DialogTitle|DialogDescription)[^>]*>\s*([A-Z][^<]{2,})\s*<\//g,
  ];
  
  lines.forEach((line, lineIndex) => {
    const lineNum = lineIndex + 1;
    
    // Skip comments and imports
    if (line.trim().startsWith('//') || line.trim().startsWith('*') || line.includes('import ')) {
      return;
    }
    
    // Skip lines that already use t() or translation helpers
    if (line.includes('t(') || line.includes('getTranslated') || line.includes('i18n.')) {
      return;
    }
    
    // Check each pattern
    for (const pattern of patterns) {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);
      
      while ((match = regex.exec(line)) !== null) {
        const str = match[2] || match[1];
        
        if (str && !isSafeString(str) && str.length > 2) {
          const namespace = suggestNamespace(str, line);
          const suggestedKey = `${namespace}.${generateKeyName(str)}`;
          
          results.hardcodedStrings.push({
            file: relativePath,
            line: lineNum,
            string: str.substring(0, 50) + (str.length > 50 ? '...' : ''),
            fullString: str,
            suggestedKey,
            context: line.trim().substring(0, 100)
          });
        }
      }
    }
  });
}

// ============== MISSING KEYS DETECTION ==============

function findMissingKeys(locales) {
  const primaryKeys = locales[CONFIG.primaryLocale];
  
  for (const locale of CONFIG.supportedLocales) {
    if (locale === CONFIG.primaryLocale) continue;
    
    const localeKeys = locales[locale];
    
    for (const key in primaryKeys) {
      if (!(key in localeKeys)) {
        results.missingKeys.push({
          locale,
          key,
          englishValue: primaryKeys[key]
        });
      }
    }
  }
}

// ============== UNUSED KEYS DETECTION ==============

function findUsedKeys(srcDir) {
  const usedKeys = new Set();
  
  const files = glob.sync('**/*.{js,jsx,tsx}', {
    cwd: srcDir,
    ignore: CONFIG.excludeDirs.map(d => `${d}/**`)
  });
  
  for (const file of files) {
    const filePath = path.join(srcDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Find all t('key') or t("key") patterns
    const tCallPattern = /t\s*\(\s*["']([^"']+)["']/g;
    let match;
    
    while ((match = tCallPattern.exec(content)) !== null) {
      usedKeys.add(match[1]);
    }
  }
  
  return usedKeys;
}

function findUnusedKeys(locales, usedKeys) {
  const primaryKeys = locales[CONFIG.primaryLocale];
  
  for (const key in primaryKeys) {
    // Skip nested namespace keys (they might be accessed dynamically)
    if (key.split('.').length > 3) continue;
    
    if (!usedKeys.has(key)) {
      results.unusedKeys.push({
        key,
        value: primaryKeys[key]
      });
    }
  }
}

// ============== MAIN AUDIT FUNCTION ==============

function runAudit(options = {}) {
  console.log('\n🔍 i18n Translation Coverage Audit\n');
  console.log('='.repeat(60));
  
  // Load all locale files
  const locales = {};
  
  for (const locale of CONFIG.supportedLocales) {
    const filePath = path.join(CONFIG.localesDir, `${locale}.json`);
    const data = loadJsonFile(filePath);
    
    if (data) {
      locales[locale] = flattenObject(data);
      results.keyCountByLocale[locale] = Object.keys(locales[locale]).length;
    }
  }
  
  console.log('\n📊 Locale Key Counts:');
  for (const [locale, count] of Object.entries(results.keyCountByLocale)) {
    console.log(`   ${locale.toUpperCase()}: ${count} keys`);
  }
  
  // Find missing keys
  console.log('\n🔎 Checking for missing translation keys...');
  findMissingKeys(locales);
  
  // Scan for hardcoded strings
  console.log('🔎 Scanning for hardcoded strings...');
  
  const files = glob.sync('**/*.{js,jsx}', {
    cwd: CONFIG.srcDir,
    ignore: CONFIG.excludeDirs.map(d => `${d}/**`)
  });
  
  for (const file of files) {
    const filePath = path.join(CONFIG.srcDir, file);
    findHardcodedStrings(filePath);
  }
  
  // Find unused keys (optional)
  if (options.checkUnused) {
    console.log('🔎 Checking for unused keys...');
    const usedKeys = findUsedKeys(CONFIG.srcDir);
    findUnusedKeys(locales, usedKeys);
  }
  
  // Print results
  printResults(options);
  
  // Return exit code
  const hasErrors = results.missingKeys.length > 0 || 
    (options.strict && results.hardcodedStrings.length > 0);
  
  return hasErrors ? 1 : 0;
}

function printResults(options) {
  console.log('\n' + '='.repeat(60));
  console.log('📋 AUDIT RESULTS');
  console.log('='.repeat(60));
  
  // Missing Keys
  console.log(`\n❌ Missing Translation Keys: ${results.missingKeys.length}`);
  if (results.missingKeys.length > 0) {
    console.log('-'.repeat(40));
    
    // Group by locale
    const byLocale = {};
    for (const item of results.missingKeys) {
      if (!byLocale[item.locale]) byLocale[item.locale] = [];
      byLocale[item.locale].push(item);
    }
    
    for (const [locale, items] of Object.entries(byLocale)) {
      console.log(`\n   📁 ${locale.toUpperCase()}.json (${items.length} missing):`);
      for (const item of items.slice(0, 20)) {
        console.log(`      • ${item.key}`);
        if (options.showValues) {
          console.log(`        EN: "${item.englishValue}"`);
        }
      }
      if (items.length > 20) {
        console.log(`      ... and ${items.length - 20} more`);
      }
    }
  }
  
  // Hardcoded Strings
  console.log(`\n⚠️  Hardcoded Strings Found: ${results.hardcodedStrings.length}`);
  if (results.hardcodedStrings.length > 0) {
    console.log('-'.repeat(40));
    
    // Group by file
    const byFile = {};
    for (const item of results.hardcodedStrings) {
      if (!byFile[item.file]) byFile[item.file] = [];
      byFile[item.file].push(item);
    }
    
    for (const [file, items] of Object.entries(byFile)) {
      console.log(`\n   📄 ${file}:`);
      for (const item of items.slice(0, 10)) {
        console.log(`      Line ${item.line}: "${item.string}"`);
        if (options.showSuggestions) {
          console.log(`        → Suggested key: ${item.suggestedKey}`);
        }
      }
      if (items.length > 10) {
        console.log(`      ... and ${items.length - 10} more in this file`);
      }
    }
  }
  
  // Unused Keys (if checked)
  if (results.unusedKeys.length > 0) {
    console.log(`\n🗑️  Potentially Unused Keys: ${results.unusedKeys.length}`);
    console.log('-'.repeat(40));
    for (const item of results.unusedKeys.slice(0, 10)) {
      console.log(`   • ${item.key}`);
    }
    if (results.unusedKeys.length > 10) {
      console.log(`   ... and ${results.unusedKeys.length - 10} more`);
    }
  }
  
  // Errors
  if (results.errors.length > 0) {
    console.log(`\n🚨 Errors: ${results.errors.length}`);
    for (const error of results.errors) {
      console.log(`   • ${error}`);
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`   Total keys (EN):        ${results.keyCountByLocale.en || 0}`);
  console.log(`   Missing keys:           ${results.missingKeys.length}`);
  console.log(`   Hardcoded strings:      ${results.hardcodedStrings.length}`);
  if (results.unusedKeys.length > 0) {
    console.log(`   Potentially unused:     ${results.unusedKeys.length}`);
  }
  
  // Final status
  console.log('\n' + '='.repeat(60));
  if (results.missingKeys.length === 0 && results.hardcodedStrings.length === 0) {
    console.log('✅ PASS - No i18n issues found!');
  } else if (results.missingKeys.length === 0) {
    console.log('⚠️  WARN - No missing keys, but hardcoded strings detected');
  } else {
    console.log('❌ FAIL - Missing translation keys detected');
  }
  console.log('='.repeat(60) + '\n');
}

// ============== CLI HANDLING ==============

const args = process.argv.slice(2);
const options = {
  strict: args.includes('--strict'),
  showSuggestions: args.includes('--fix-suggestions') || args.includes('--suggestions'),
  showValues: args.includes('--show-values'),
  checkUnused: args.includes('--check-unused'),
};

if (args.includes('--help')) {
  console.log(`
i18n Translation Coverage Audit

Usage: node scripts/i18n-audit.js [options]

Options:
  --strict           Fail on hardcoded strings (not just missing keys)
  --fix-suggestions  Show suggested translation keys for hardcoded strings
  --show-values      Show English values for missing keys
  --check-unused     Also check for potentially unused translation keys
  --help             Show this help message

Examples:
  npm run i18n:audit                  # Basic audit
  npm run i18n:audit -- --strict      # Strict mode (fails on any issues)
  npm run i18n:audit -- --fix-suggestions --show-values
`);
  process.exit(0);
}

const exitCode = runAudit(options);
process.exit(exitCode);
