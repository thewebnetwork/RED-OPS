/**
 * i18n Helper utilities for dynamic content translation
 */

/**
 * Get the translated name for a category based on current language
 * @param {Object} category - Category object with name_en, name_es, name_pt fields
 * @param {string} language - Current language code (en, es, pt)
 * @returns {string} - Translated name or fallback to default name
 */
export const getTranslatedCategoryName = (category, language = 'en') => {
  if (!category) return '';
  
  // Try to get the translated name based on language
  const translatedName = category[`name_${language}`];
  
  // Return translated name if available, otherwise fallback to default name
  return translatedName || category.name || '';
};

/**
 * Get translated status name
 * @param {string} status - Status key
 * @param {function} t - Translation function
 * @returns {string} - Translated status
 */
export const getTranslatedStatus = (status, t) => {
  const statusKeys = {
    'Open': 'status.open',
    'In Progress': 'status.inProgress',
    'Pending Review': 'status.pendingReview',
    'Delivered': 'status.delivered',
    'Closed': 'status.closed',
    'Cancelled': 'status.cancelled',
    'On Hold': 'status.onHold'
  };
  
  const key = statusKeys[status];
  return key ? t(key) : status;
};

/**
 * Get translated priority name
 * @param {string} priority - Priority key
 * @param {function} t - Translation function
 * @returns {string} - Translated priority
 */
export const getTranslatedPriority = (priority, t) => {
  const priorityKeys = {
    'Low': 'priority.low',
    'Normal': 'priority.normal',
    'High': 'priority.high',
    'Urgent': 'priority.urgent'
  };
  
  const key = priorityKeys[priority];
  return key ? t(key) : priority;
};

/**
 * Get translated SLA status
 * @param {string} slaStatus - SLA status key
 * @param {function} t - Translation function
 * @returns {string} - Translated SLA status
 */
export const getTranslatedSLAStatus = (slaStatus, t) => {
  const slaKeys = {
    'on_track': 'sla.onTrack',
    'at_risk': 'sla.atRisk',
    'breached': 'sla.breached',
    'unacknowledged': 'sla.unacknowledged'
  };
  
  const key = slaKeys[slaStatus];
  return key ? t(key) : slaStatus;
};

/**
 * Get translated account type
 * @param {string} accountType - Account type key
 * @param {function} t - Translation function
 * @returns {string} - Translated account type
 */
export const getTranslatedAccountType = (accountType, t) => {
  const accountKeys = {
    'Partner': 'accountTypes.partner',
    'Media Client': 'accountTypes.mediaClient',
    'Internal Staff': 'accountTypes.internalStaff',
    'Vendor/Freelancer': 'accountTypes.vendorFreelancer'
  };
  
  const key = accountKeys[accountType];
  return key ? t(key) : accountType;
};

/**
 * Get translated role name
 * @param {string} role - Role key
 * @param {function} t - Translation function
 * @returns {string} - Translated role
 */
export const getTranslatedRole = (role, t) => {
  const roleKeys = {
    'Administrator': 'roles.administrator',
    'Operator': 'roles.operator',
    'Standard User': 'roles.standardUser'
  };
  
  const key = roleKeys[role];
  return key ? t(key) : role;
};
