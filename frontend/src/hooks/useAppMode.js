import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';

/**
 * App Mode Constants
 * - CLIENT_PORTAL: For Media Clients - simplified experience
 * - OPERATOR_CONSOLE: For Partners, Vendors, Internal Staff - work management
 * - ADMIN_STUDIO: For Admins - full configuration access
 */
export const APP_MODES = {
  CLIENT_PORTAL: 'client_portal',
  OPERATOR_CONSOLE: 'operator_console',
  ADMIN_STUDIO: 'admin_studio'
};

/**
 * Determines available modes and primary mode based on account_type and capabilities
 * 
 * Mode assignment logic:
 * - media_client (Media Client) = Client Portal only
 * - partner (Partner) = Client Portal + Operator Console if can_pick or can_fulfill
 * - vendor (Vendor/Freelancer) = Operator Console limited
 * - internal_staff (Internal Staff) = Operator Console full
 * - admin (Administrator role) = Admin Studio + Operator Console + Client Portal preview
 */
export function useAppMode() {
  const { user } = useAuth();
  
  const modeConfig = useMemo(() => {
    if (!user) {
      return {
        primaryMode: null,
        availableModes: [],
        isClient: false,
        isOperator: false,
        isAdmin: false,
        canAccessClientPortal: false,
        canAccessOperatorConsole: false,
        canAccessAdminStudio: false,
        canPickFromPools: false,
        canFulfill: false,
        isInternalStaff: false,
        previewMode: null
      };
    }

    const accountType = user.account_type || '';
    const role = user.role || '';
    const canPick = user.can_pick === true;
    const poolAccess = user.pool_access || 'none';
    
    // Determine capabilities
    const canPickFromPools = false; // MVP: Pool routing disabled
    const canFulfill = canPick; // Simplified: if can pick, can fulfill
    
    // Determine mode access
    let canAccessClientPortal = false;
    let canAccessOperatorConsole = false;
    let canAccessAdminStudio = false;
    let isInternalStaff = false;
    let primaryMode = APP_MODES.CLIENT_PORTAL;
    
    // Account type based access
    switch (accountType) {
      case 'Media Client':
        // Client Portal only
        canAccessClientPortal = true;
        primaryMode = APP_MODES.CLIENT_PORTAL;
        break;
        
      case 'Partner':
        // Client Portal by default
        canAccessClientPortal = true;
        primaryMode = APP_MODES.CLIENT_PORTAL;
        // Plus Operator Console if they have picking/fulfillment capabilities
        if (canPickFromPools || canFulfill) {
          canAccessOperatorConsole = true;
          primaryMode = APP_MODES.OPERATOR_CONSOLE; // Operators default to operator view
        }
        break;
        
      case 'Vendor/Freelancer':
        // Operator Console limited (fulfillment only)
        canAccessOperatorConsole = true;
        primaryMode = APP_MODES.OPERATOR_CONSOLE;
        break;
        
      case 'Internal Staff':
        // Operator Console full
        canAccessOperatorConsole = true;
        isInternalStaff = true;
        primaryMode = APP_MODES.OPERATOR_CONSOLE;
        break;
        
      default:
        // Default to client portal for unknown types
        canAccessClientPortal = true;
        primaryMode = APP_MODES.CLIENT_PORTAL;
    }
    
    // Admin role overrides - full access
    if (role === 'Administrator') {
      canAccessAdminStudio = true;
      canAccessOperatorConsole = true;
      canAccessClientPortal = true; // For preview
      isInternalStaff = true;
      primaryMode = APP_MODES.ADMIN_STUDIO;
    }
    
    // Operator role gets operator console access
    if (role === 'Operator') {
      canAccessOperatorConsole = true;
      if (!canAccessAdminStudio) {
        primaryMode = APP_MODES.OPERATOR_CONSOLE;
      }
    }
    
    // Build available modes list
    const availableModes = [];
    if (canAccessAdminStudio) availableModes.push(APP_MODES.ADMIN_STUDIO);
    if (canAccessOperatorConsole) availableModes.push(APP_MODES.OPERATOR_CONSOLE);
    if (canAccessClientPortal) availableModes.push(APP_MODES.CLIENT_PORTAL);
    
    return {
      primaryMode,
      availableModes,
      isClient: primaryMode === APP_MODES.CLIENT_PORTAL && !canAccessOperatorConsole && !canAccessAdminStudio,
      isOperator: canAccessOperatorConsole,
      isAdmin: canAccessAdminStudio,
      canAccessClientPortal,
      canAccessOperatorConsole,
      canAccessAdminStudio,
      canPickFromPools: false, // MVP: Pool routing disabled
      canFulfill,
      isInternalStaff,
      previewMode: null // Will be set when admin uses "Preview as Client"
    };
  }, [user]);
  
  return modeConfig;
}

/**
 * Get navigation items for a specific mode
 */
export function getNavItemsForMode(mode, modeConfig, t) {
  const { 
    canPickFromPools, 
    isInternalStaff, 
    isAdmin,
    canAccessAdminStudio 
  } = modeConfig;
  
  switch (mode) {
    case APP_MODES.CLIENT_PORTAL:
      return [
        { path: '/', icon: 'Home', labelKey: 'nav.home', label: t('nav.home') },
        { path: '/services', icon: 'ShoppingBag', labelKey: 'nav.requestService', label: t('nav.requestService') },
        { path: '/my-requests', icon: 'FileText', labelKey: 'nav.myRequests', label: t('nav.myRequests') },
        { path: '/tasks', icon: 'CheckSquare', labelKey: 'nav.tasks', label: t('nav.tasks') },
        { path: '/my-account', icon: 'User', labelKey: 'nav.myAccount', label: t('nav.myAccount') }
      ];
      
    case APP_MODES.OPERATOR_CONSOLE:
      const operatorNav = [
        { path: '/queue', icon: 'Inbox', labelKey: 'nav.myQueue', label: t('nav.myQueue') }
      ];
      
      // MVP: Pool routing disabled - all requests go to standard queue
      // Pool/Team Queue - only for pool pickers
      // if (canPickFromPools) {
      //   operatorNav.push({ 
      //     path: '/pool', 
      //     icon: 'Layers', 
      //     labelKey: 'nav.pool', 
      //     label: t('nav.pool') 
      //   });
      // }
      
      // All Requests - only for internal staff and admin
      if (isInternalStaff || isAdmin) {
        operatorNav.push({ 
          path: '/all-requests', 
          icon: 'ClipboardList', 
          labelKey: 'nav.allRequests', 
          label: t('nav.allRequests') 
        });
      }
      
      // Reports - only for internal staff and admin
      if (isInternalStaff || isAdmin) {
        operatorNav.push({ 
          path: '/reports', 
          icon: 'BarChart3', 
          labelKey: 'nav.reports', 
          label: t('nav.reports') 
        });
      }
      
      return operatorNav;
      
    case APP_MODES.ADMIN_STUDIO:
      return [
        { path: '/admin', icon: 'LayoutDashboard', labelKey: 'nav.adminDashboard', label: t('nav.adminDashboard') },
        { path: '/iam', icon: 'KeyRound', labelKey: 'iam.title', label: t('iam.title') },
        { path: '/settings', icon: 'Settings', labelKey: 'nav.settings', label: t('nav.settings') },
        { path: '/reports', icon: 'BarChart3', labelKey: 'nav.reports', label: t('nav.reports') },
        { path: '/logs', icon: 'FileText', labelKey: 'nav.logs', label: t('nav.logs') },
        { path: '/announcements', icon: 'Megaphone', labelKey: 'nav.announcements', label: t('nav.announcements') }
      ];
      
    default:
      return [];
  }
}

export default useAppMode;
