# i18n Translation Audit System

This document describes the translation coverage audit system for Red Ribbon Ops.

## Quick Start

```bash
# Run the full audit with suggestions
npm run i18n:audit

# Run CI-friendly check (fails only on missing keys)
npm run i18n:ci

# Sync missing keys from English to other locales
npm run i18n:sync

# Run strict check (fails on hardcoded strings too)
npm run i18n:audit:strict
```

## Available Commands

| Command | Description | Fails On |
|---------|-------------|----------|
| `npm run i18n:audit` | Full audit with suggestions | Missing keys |
| `npm run i18n:ci` | CI-friendly check | Missing keys only |
| `npm run i18n:sync` | Sync keys across locales | Never |
| `npm run i18n:audit:strict` | Strict audit | Missing keys + hardcoded strings |

## What Gets Checked

### 1. Missing Translation Keys
The audit compares all locale files (`en.json`, `es.json`, `pt.json`) and reports:
- Keys present in English but missing in Spanish
- Keys present in English but missing in Portuguese

**This is a blocking check** - the CI will fail if any keys are missing.

### 2. Hardcoded Strings
The audit scans all JSX files for:
- Direct string literals in JSX (e.g., `>Some text<`)
- String props not using `t()` (e.g., `label="Some text"`)
- Toast messages with hardcoded text
- Button/Label components with direct text children

**This is a non-blocking warning** by default. Use `--strict` or `I18N_STRICT=true` to fail on these.

## Syncing Keys

When you add new translation keys to `en.json`, run:

```bash
npm run i18n:sync
```

This will:
1. Add missing keys to `es.json` with `[ES]` prefix
2. Add missing keys to `pt.json` with `[PT]` prefix

Keys with these prefixes need manual translation review.

## CI Integration

The audit runs automatically:
1. **Pre-build hook**: Runs before every build
2. **GitHub Actions**: Runs on PRs and pushes to main/develop

### GitHub Actions Workflow

Located at `.github/workflows/i18n-check.yml`:
- **i18n-check** job: Fails if missing keys (blocking)
- **i18n-strict** job: Also checks hardcoded strings (informational)

## Output Example

```
📊 i18n CI Check Results
========================
Total EN keys: 1096
Total ES keys: 1145
Total PT keys: 1145
Missing keys: 0
Hardcoded strings (approx): 139

⚠️  WARN - Hardcoded strings detected (non-blocking)
```

## Fixing Issues

### Missing Keys
1. Run `npm run i18n:sync` to add placeholders
2. Find keys prefixed with `[ES]` or `[PT]` in locale files
3. Replace with proper translations

### Hardcoded Strings
1. Run `npm run i18n:audit` to see suggestions
2. For each hardcoded string:
   - Add a key to `en.json` (follow namespace conventions)
   - Add translations to `es.json` and `pt.json`
   - Replace hardcoded string with `t('key.name')`

## Key Naming Conventions

| Namespace | Use For |
|-----------|---------|
| `common.*` | General UI (Save, Cancel, Loading, etc.) |
| `nav.*` | Navigation items |
| `buttons.*` | Button labels |
| `forms.*` | Form field labels and placeholders |
| `formValidation.*` | Validation error messages |
| `errors.*` | Error messages |
| `success.*` | Success messages |
| `dashboard.*` | Dashboard-specific labels |
| `tickets.*` | Ticket-related labels |
| `iam.*` | User/team/role management |
| `settings.*` | Settings pages |
| `modals.*` | Modal dialogs |

## Best Practices

1. **Always use `t()` for user-facing text**
2. **Run `npm run i18n:ci` before committing**
3. **Add keys to all 3 locale files together**
4. **Use descriptive, namespaced keys**
5. **Keep translations close to English meaning**
