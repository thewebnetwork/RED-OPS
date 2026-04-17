/**
 * OrgContext — Single-tenant-per-user architecture.
 *
 * Decision: every user is their own org. org_id = user.id.
 * See docs/audits/AUDIT_2026-04-16.md §4.2.1 decision log.
 *
 * This context is short-circuited: it always returns the current user's id
 * as the org. Multi-org switching, membership, and module gating are stubs
 * preserved for API compatibility. Cleanup in a separate pass.
 */
import { createContext, useContext, useCallback } from 'react';
import { useAuth } from './AuthContext';

const OrgContext = createContext(null);

export function OrgProvider({ children }) {
  const { user } = useAuth();

  const orgId = user?.id || null;

  const switchOrg = useCallback(async () => orgId, [orgId]);
  const hasModule = useCallback(() => true, []);
  const hasOrgPermission = useCallback(() => true, []);
  const hasOrgRole = useCallback(() => true, []);
  const refreshOrgs = useCallback(async () => {}, []);

  const value = {
    currentOrg: orgId ? { id: orgId, name: user?.name } : null,
    orgs: orgId ? [{ id: orgId, name: user?.name }] : [],
    membership: orgId ? { role: 'owner', permissions: {} } : null,
    orgConfig: null,
    loading: false,
    switchOrg,
    hasModule,
    hasOrgPermission,
    hasOrgRole,
    refreshOrgs,
    isOrgMember: !!orgId,
  };

  return (
    <OrgContext.Provider value={value}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  const context = useContext(OrgContext);
  if (!context) {
    throw new Error('useOrg must be used within an OrgProvider');
  }
  return context;
}
