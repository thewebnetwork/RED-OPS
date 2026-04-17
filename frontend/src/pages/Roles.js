import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Shield,
  ShieldCheck,
  User,
  Users,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Save,
  Info
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Role icons and colors
const roleConfig = {
  'Administrator': {
    icon: Shield,
    color: 'var(--accent)',
    bgColor: 'var(--accent-soft)'
  },
  'Privileged User': {
    icon: ShieldCheck,
    color: '#2563eb',
    bgColor: '#2563eb15'
  },
  'Standard User': {
    icon: User,
    color: '#22c55e',
    bgColor: '#22c55e15'
  }
};

export default function Roles() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState(null);
  const [editingPermissions, setEditingPermissions] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalPermissions, setOriginalPermissions] = useState(null);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [pendingRoleSwitch, setPendingRoleSwitch] = useState(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [expandedModules, setExpandedModules] = useState({});

  useEffect(() => {
    fetchRoles();
  }, []);

  useEffect(() => {
    if (originalPermissions && editingPermissions) {
      const changed = JSON.stringify(editingPermissions) !== JSON.stringify(originalPermissions);
      setHasChanges(changed);
    }
  }, [editingPermissions, originalPermissions]);

  const fetchRoles = async () => {
    try {
      const res = await axios.get(`${API}/roles`);
      setRoles(res.data);
      if (res.data.length > 0 && !selectedRole) {
        selectRole(res.data[0]);
      }
    } catch (error) {
      toast.error('Failed to load roles');
    } finally {
      setLoading(false);
    }
  };

  const selectRole = (role) => {
    setSelectedRole(role);
    setEditingPermissions(JSON.parse(JSON.stringify(role.permissions)));
    setOriginalPermissions(JSON.parse(JSON.stringify(role.permissions)));
    setHasChanges(false);
    const expanded = {};
    Object.keys(role.permissions).forEach(m => expanded[m] = true);
    setExpandedModules(expanded);
  };

  const handleRoleSwitch = (role) => {
    if (hasChanges) {
      setPendingRoleSwitch(role);
      setShowUnsavedWarning(true);
    } else {
      selectRole(role);
    }
  };

  const confirmRoleSwitch = () => {
    setShowUnsavedWarning(false);
    if (pendingRoleSwitch) {
      selectRole(pendingRoleSwitch);
      setPendingRoleSwitch(null);
    }
  };

  const togglePermission = (module, action) => {
    setEditingPermissions(prev => ({
      ...prev,
      [module]: {
        ...prev[module],
        [action]: !prev[module][action]
      }
    }));
  };

  const toggleAllInModule = (module, value) => {
    const newModulePerms = {};
    Object.keys(editingPermissions[module]).forEach(action => {
      newModulePerms[action] = value;
    });
    setEditingPermissions(prev => ({
      ...prev,
      [module]: newModulePerms
    }));
  };

  const isModuleFullyEnabled = (module) => {
    return Object.values(editingPermissions[module]).every(v => v === true);
  };

  const isModulePartiallyEnabled = (module) => {
    const values = Object.values(editingPermissions[module]);
    return values.some(v => v) && !values.every(v => v);
  };

  const toggleModuleExpanded = (module) => {
    setExpandedModules(prev => ({
      ...prev,
      [module]: !prev[module]
    }));
  };

  const handleSave = async () => {
    if (!selectedRole) return;

    try {
      await axios.patch(`${API}/roles/${selectedRole.id}`, {
        permissions: editingPermissions
      });
      toast.success(`${selectedRole.name} permissions saved`);
      setOriginalPermissions(JSON.parse(JSON.stringify(editingPermissions)));
      setHasChanges(false);
      const res = await axios.get(`${API}/roles`);
      setRoles(res.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save permissions');
    }
  };

  const handleResetToDefaults = async () => {
    if (!selectedRole) return;

    try {
      await axios.post(`${API}/roles/reset-defaults/${selectedRole.id}`);
      toast.success(`${selectedRole.name} permissions reset to defaults`);
      setShowResetConfirm(false);
      const res = await axios.get(`${API}/roles`);
      setRoles(res.data);
      const updated = res.data.find(r => r.id === selectedRole.id);
      if (updated) selectRole(updated);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reset permissions');
    }
  };

  const getModuleLabel = (module) => {
    const labels = {
      dashboard: 'Dashboard',
      command_center: 'Command Center',
      orders: 'Orders/Tickets',
      users: 'Users',
      teams: 'Teams',
      roles: 'Roles',
      categories: 'Categories',
      workflows: 'Workflows',
      escalation: 'Escalation',
      sla: 'SLA Management',
      integrations: 'Integrations',
      announcements: 'Announcements',
      logs: 'Logs',
      settings: 'Settings',
      reports: 'Reports'
    };
    return labels[module] || module;
  };

  const getActionLabel = (action) => {
    const labels = {
      view: 'View',
      create: 'Create',
      edit: 'Edit',
      delete: 'Delete',
      export: 'Export',
      pick: 'Pick/Claim',
      execute: 'Execute',
      acknowledge: 'Acknowledge'
    };
    return labels[action] || action;
  };

  const getEnabledCount = (role) => {
    let total = 0;
    let enabled = 0;
    Object.values(role.permissions).forEach(module => {
      Object.values(module).forEach(val => {
        total++;
        if (val) enabled++;
      });
    });
    return { total, enabled };
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '16rem'
      }}>
        <div style={{
          width: '2rem',
          height: '2rem',
          borderRadius: '50%',
          border: '4px solid var(--border)',
          borderTopColor: 'var(--accent)',
          animation: 'spin 1s linear infinite'
        }} />
      </div>
    );
  }

  return (
    <div style={{ padding: '1.5rem' }} data-testid="roles-page">
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{
          fontSize: '1.875rem',
          fontWeight: 'bold',
          color: 'var(--tx-1)',
          marginBottom: '0.25rem'
        }}>
          Role Permissions
        </h1>
        <p style={{ color: 'var(--tx-2)', fontSize: '0.875rem' }}>
          Configure access permissions for each role
        </p>
      </div>

      {/* Info Banner */}
      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '1rem',
        display: 'flex',
        gap: '0.75rem',
        marginBottom: '1.5rem'
      }}>
        <Info size={20} style={{ color: 'var(--tx-2)', flexShrink: 0, marginTop: '0.125rem' }} />
        <div>
          <p style={{ fontWeight: 600, color: 'var(--tx-1)', marginBottom: '0.25rem' }}>
            Identity & Access Management
          </p>
          <p style={{ fontSize: '0.875rem', color: 'var(--tx-2)', lineHeight: 1.5 }}>
            The platform uses 3 fixed roles: <strong>Administrator</strong>, <strong>Privileged User</strong>, and <strong>Standard User</strong>.
            Each role has default permissions that can be customized below. For user-specific overrides, use the Permissions tab when editing a user.
          </p>
        </div>
      </div>

      {/* Main Layout */}
      <div style={{ display: 'flex', gap: '1.5rem' }}>
        {/* Left Panel - Role Cards */}
        <div style={{ width: '300px', flexShrink: 0 }}>
          <h2 style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--tx-2)',
            marginBottom: '1rem'
          }}>
            System Roles
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {roles.map((role) => {
              const config = roleConfig[role.name] || roleConfig['Standard User'];
              const Icon = config.icon;
              const counts = getEnabledCount(role);
              const isSelected = selectedRole?.id === role.id;

              return (
                <div
                  key={role.id}
                  onClick={() => handleRoleSwitch(role)}
                  style={{
                    background: 'var(--card)',
                    border: isSelected ? `2px solid var(--accent)` : '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '1rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: isSelected ? '0 4px 6px rgba(0,0,0,0.1)' : 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.boxShadow = 'none';
                    }
                  }}
                  data-testid={`role-card-${role.name.replace(/\s+/g, '-').toLowerCase()}`}
                >
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <div
                      style={{
                        width: '2.5rem',
                        height: '2.5rem',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: config.bgColor
                      }}
                    >
                      <Icon size={20} color={config.color} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 600, color: 'var(--tx-1)', marginBottom: '0.25rem' }}>
                        {role.display_name}
                      </p>
                      <p style={{
                        fontSize: '0.75rem',
                        color: 'var(--tx-2)',
                        marginBottom: '0.5rem',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}>
                        {role.description}
                      </p>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: '0.75rem',
                          background: 'var(--bg)',
                          border: '1px solid var(--border)',
                          borderRadius: '4px',
                          padding: '0.25rem 0.5rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          color: 'var(--tx-2)'
                        }}>
                          <Users size={12} />
                          {role.user_count} users
                        </span>
                        <span style={{
                          fontSize: '0.75rem',
                          background: 'var(--bg)',
                          border: `1px solid ${config.color}`,
                          borderRadius: '4px',
                          padding: '0.25rem 0.5rem',
                          color: config.color
                        }}>
                          {counts.enabled}/{counts.total} enabled
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Panel - Permission Matrix */}
        <div style={{ flex: 1 }}>
          {selectedRole && editingPermissions ? (
            <div style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
            }}>
              {/* Header */}
              <div style={{
                borderBottom: '1px solid var(--border)',
                padding: '1rem'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {(() => {
                      const config = roleConfig[selectedRole.name] || roleConfig['Standard User'];
                      const Icon = config.icon;
                      return (
                        <>
                          <div
                            style={{
                              width: '2.5rem',
                              height: '2.5rem',
                              borderRadius: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: config.bgColor
                            }}
                          >
                            <Icon size={20} color={config.color} />
                          </div>
                          <div>
                            <h2 style={{
                              fontWeight: 600,
                              color: 'var(--tx-1)',
                              fontSize: '1rem'
                            }}>
                              {selectedRole.display_name}
                            </h2>
                            <p style={{
                              fontSize: '0.875rem',
                              color: 'var(--tx-2)'
                            }}>
                              {selectedRole.description}
                            </p>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {hasChanges && (
                      <span style={{
                        fontSize: '0.75rem',
                        background: 'var(--yellow)',
                        color: '#000',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '4px',
                        fontWeight: 600
                      }}>
                        Unsaved changes
                      </span>
                    )}
                    <button
                      onClick={() => setShowResetConfirm(true)}
                      style={{
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        padding: '0.5rem 0.75rem',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        color: 'var(--tx-1)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--border)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--bg)';
                      }}
                    >
                      <RotateCcw size={14} />
                      Reset to Defaults
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={!hasChanges}
                      style={{
                        background: hasChanges ? 'var(--accent)' : 'var(--border)',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '0.5rem 0.75rem',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        cursor: hasChanges ? 'pointer' : 'not-allowed',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        if (hasChanges) {
                          e.currentTarget.style.opacity = '0.9';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (hasChanges) {
                          e.currentTarget.style.opacity = '1';
                        }
                      }}
                      data-testid="save-permissions-btn"
                    >
                      <Save size={14} />
                      Save Changes
                    </button>
                  </div>
                </div>
              </div>

              {/* Permission Modules */}
              <div>
                {Object.entries(editingPermissions).map(([module, actions], idx) => (
                  <div key={module}>
                    {idx > 0 && <div style={{ borderTop: '1px solid var(--border)' }} />}

                    {/* Module Header */}
                    <div
                      onClick={() => toggleModuleExpanded(module)}
                      style={{
                        padding: '0.75rem 1rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'background 0.2s ease',
                        backgroundColor: expandedModules[module] ? 'var(--bg)' : 'transparent'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--bg)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = expandedModules[module] ? 'var(--bg)' : 'transparent';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {expandedModules[module] ? (
                          <ChevronDown size={16} color="var(--tx-2)" />
                        ) : (
                          <ChevronRight size={16} color="var(--tx-2)" />
                        )}
                        <span style={{ fontWeight: 500, color: 'var(--tx-1)' }}>
                          {getModuleLabel(module)}
                        </span>
                        <span style={{
                          fontSize: '0.75rem',
                          background: 'var(--border)',
                          color: 'var(--tx-2)',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px'
                        }}>
                          {Object.values(actions).filter(v => v).length}/{Object.keys(actions).length}
                        </span>
                      </div>
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span style={{
                          fontSize: '0.75rem',
                          color: 'var(--tx-2)'
                        }}>
                          {isModuleFullyEnabled(module) ? 'All enabled' : isModulePartiallyEnabled(module) ? 'Partial' : 'Disabled'}
                        </span>
                        <button
                          onClick={() => toggleAllInModule(module, !isModuleFullyEnabled(module))}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '2.5rem',
                            height: '1.5rem',
                            borderRadius: '999px',
                            border: 'none',
                            background: isModuleFullyEnabled(module) ? 'var(--accent)' : 'var(--border)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                          data-testid={`module-toggle-${module}`}
                        >
                          <div style={{
                            width: '1.25rem',
                            height: '1.25rem',
                            borderRadius: '50%',
                            background: '#fff',
                            transition: 'transform 0.2s ease',
                            transform: isModuleFullyEnabled(module) ? 'translateX(0.5rem)' : 'translateX(-0.5rem)'
                          }} />
                        </button>
                      </div>
                    </div>

                    {/* Expanded Actions Grid */}
                    {expandedModules[module] && (
                      <div style={{
                        padding: '1rem',
                        backgroundColor: 'var(--bg)',
                        borderTop: '1px solid var(--border)'
                      }}>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                          gap: '0.75rem'
                        }}>
                          {Object.entries(actions).map(([action, enabled]) => (
                            <label
                              key={action}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.75rem',
                                borderRadius: '8px',
                                border: enabled ? `2px solid var(--accent)` : '1px solid var(--border)',
                                background: 'var(--card)',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                              }}
                              onMouseEnter={(e) => {
                                if (!enabled) {
                                  e.currentTarget.style.borderColor = 'var(--border)';
                                  e.currentTarget.style.background = 'var(--bg)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!enabled) {
                                  e.currentTarget.style.borderColor = 'var(--border)';
                                  e.currentTarget.style.background = 'var(--card)';
                                }
                              }}
                              data-testid={`permission-${module}-${action}`}
                            >
                              <input
                                type="checkbox"
                                checked={enabled}
                                onChange={() => togglePermission(module, action)}
                                style={{
                                  width: '1rem',
                                  height: '1rem',
                                  cursor: 'pointer',
                                  accentColor: 'var(--accent)'
                                }}
                              />
                              <span style={{
                                fontSize: '0.875rem',
                                fontWeight: 500,
                                color: 'var(--tx-1)',
                                textTransform: 'capitalize'
                              }}>
                                {getActionLabel(action)}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '3rem',
              textAlign: 'center'
            }}>
              <Shield size={48} style={{ color: 'var(--tx-3)', margin: '0 auto 1rem' }} />
              <p style={{ color: 'var(--tx-2)' }}>
                Select a role to view and edit its permissions
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Unsaved Changes Warning Modal */}
      {showUnsavedWarning && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50
        }} onClick={() => setShowUnsavedWarning(false)}>
          <div style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '1.5rem',
            maxWidth: '400px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{
              fontSize: '1.125rem',
              fontWeight: 600,
              color: 'var(--tx-1)',
              marginBottom: '0.5rem'
            }}>
              Unsaved Changes
            </h3>
            <p style={{
              color: 'var(--tx-2)',
              marginBottom: '1.5rem',
              fontSize: '0.875rem',
              lineHeight: 1.5
            }}>
              You have unsaved permission changes for "{selectedRole?.display_name}".
              Do you want to discard these changes?
            </p>
            <div style={{
              display: 'flex',
              gap: '0.75rem',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => {
                  setShowUnsavedWarning(false);
                  setPendingRoleSwitch(null);
                }}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--tx-1)',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--border)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--bg)';
                }}
              >
                Stay
              </button>
              <button
                onClick={confirmRoleSwitch}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--red)',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
              >
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50
        }} onClick={() => setShowResetConfirm(false)}>
          <div style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '1.5rem',
            maxWidth: '400px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{
              fontSize: '1.125rem',
              fontWeight: 600,
              color: 'var(--tx-1)',
              marginBottom: '0.5rem'
            }}>
              Reset Permissions
            </h3>
            <p style={{
              color: 'var(--tx-2)',
              marginBottom: '1.5rem',
              fontSize: '0.875rem',
              lineHeight: 1.5
            }}>
              This will reset all permissions for "{selectedRole?.display_name}" back to their default values.
              This action cannot be undone.
            </p>
            <div style={{
              display: 'flex',
              gap: '0.75rem',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => setShowResetConfirm(false)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--tx-1)',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--border)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--bg)';
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleResetToDefaults}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--red)',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
              >
                Reset to Defaults
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
