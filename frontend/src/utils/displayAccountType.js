/**
 * Display alias for account_type values.
 * Maps backend account_type to user-facing labels.
 * Do NOT use this for auth/role checks — use the raw account_type for those.
 */
export function displayAccountType(accountType) {
  if (accountType === 'Media Client') return 'Client';
  return accountType || '';
}
