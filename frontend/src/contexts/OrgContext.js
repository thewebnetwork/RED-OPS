import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

const OrgContext = createContext(null);

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export function OrgProvider({ children }) {
  const { user, isAuthenticated, updateUser } = useAuth();
  const [currentOrg, setCurrentOrg] = useState(null);
  const [orgs, setOrgs] = useState([]);
  const [membership, setMembership] = useState(null);
  const [orgConfig, setOrgConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch user's organizations on auth
  const fetchOrgs = useCallback(async () => {
    if (!isAuthenticated) {
      setOrgs([]);
      setCurrentOrg(null);
      setMembership(null);
      setOrgConfig(null);
      setLoading(false);
      return;
    }

    try {
      const res = await axios.get(`${API}/organizations`);
      setOrgs(res.data || []);

      // If user has a primary org, load it
      if (user?.primary_org_id) {
        const orgRes = await axios.get(`${API}/organizations/${user.primary_org_id}`);
        const org = orgRes.data;
        setCurrentOrg(org);
        setMembership({
          role: org.my_role,
          permissions: org.my_permissions || {},
        });
        setOrgConfig(org.config || null);
      } else if (res.data?.length > 0) {
        // Default to first org if no primary set
        const first = res.data[0];
        const orgRes = await axios.get(`${API}/organizations/${first.id}`);
        const org = orgRes.data;
        setCurrentOrg(org);
        setMembership({
          role: org.my_role,
          permissions: org.my_permissions || {},
        });
        setOrgConfig(org.config || null);
      }
    } catch (err) {
      console.error('Failed to fetch organizations:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user?.primary_org_id]);

  useEffect(() => {
    fetchOrgs();
  }, [fetchOrgs]);

  // Switch active organization
  const switchOrg = useCallback(async (orgId) => {
    try {
      const res = await axios.post(`${API}/organizations/me/switch/${orgId}`);
      const { org, membership: mem } = res.data;
      setCurrentOrg(org);
      setMembership({
        role: mem?.org_role || 'member',
        permissions: mem?.permissions || {},
      });
      setOrgConfig(org?.config || null);
      // Update user's primary_org_id locally
      updateUser({ primary_org_id: orgId, org_id: orgId });
      return org;
    } catch (err) {
      console.error('Failed to switch org:', err);
      throw err;
    }
  }, [updateUser]);

  // Check if current org has access to a module
  const hasModule = useCallback((moduleName) => {
    if (!orgConfig) return false;
    const modules = orgConfig.modules || [];
    return modules.includes('*') || modules.includes(moduleName);
  }, [orgConfig]);

  // Check if current user has an org-level permission
  const hasOrgPermission = useCallback((permission) => {
    if (!membership) return false;
    // Owners always have all permissions
    if (membership.role === 'owner') return true;
    return membership.permissions?.[permission] === true;
  }, [membership]);

  // Check org role
  const hasOrgRole = useCallback((...roles) => {
    if (!membership) return false;
    return roles.includes(membership.role);
  }, [membership]);

  const value = {
    currentOrg,
    orgs,
    membership,
    orgConfig,
    loading,
    switchOrg,
    hasModule,
    hasOrgPermission,
    hasOrgRole,
    refreshOrgs: fetchOrgs,
    isOrgMember: !!currentOrg,
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
