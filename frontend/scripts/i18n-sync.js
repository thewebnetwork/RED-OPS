#!/usr/bin/env node

/**
 * i18n Key Sync Script
 * 
 * Syncs missing keys from en.json to es.json and pt.json
 * Adds placeholder translations that need manual review
 */

const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '../src/i18n/locales');

// Load JSON files
function loadJson(filename) {
  const filePath = path.join(localesDir, filename);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function saveJson(filename, data) {
  const filePath = path.join(localesDir, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

// Flatten nested object to dot notation
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

// Unflatten dot notation to nested object
function unflattenObject(obj) {
  const result = {};
  for (const key in obj) {
    const parts = key.split('.');
    let current = result;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = obj[key];
  }
  return result;
}

// Deep merge objects
function deepMerge(target, source) {
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key]) target[key] = {};
      deepMerge(target[key], source[key]);
    } else if (target[key] === undefined) {
      target[key] = source[key];
    }
  }
  return target;
}

console.log('🔄 Syncing translation keys...\n');

const en = loadJson('en.json');
const es = loadJson('es.json');
const pt = loadJson('pt.json');

const enFlat = flattenObject(en);
const esFlat = flattenObject(es);
const ptFlat = flattenObject(pt);

let esAdded = 0;
let ptAdded = 0;

// Find missing keys and add placeholders
for (const key in enFlat) {
  if (!(key in esFlat)) {
    esFlat[key] = `[ES] ${enFlat[key]}`;
    esAdded++;
  }
  if (!(key in ptFlat)) {
    ptFlat[key] = `[PT] ${enFlat[key]}`;
    ptAdded++;
  }
}

// Convert back to nested and save
const esNew = unflattenObject(esFlat);
const ptNew = unflattenObject(ptFlat);

// Merge with original to preserve structure
const esFinal = deepMerge(JSON.parse(JSON.stringify(es)), esNew);
const ptFinal = deepMerge(JSON.parse(JSON.stringify(pt)), ptNew);

saveJson('es.json', esFinal);
saveJson('pt.json', ptFinal);

console.log(`✅ Added ${esAdded} placeholder keys to es.json`);
console.log(`✅ Added ${ptAdded} placeholder keys to pt.json`);
console.log('\n⚠️  Keys prefixed with [ES] or [PT] need manual translation review');
console.log('   Search for "[ES]" or "[PT]" in locale files to find them\n');
