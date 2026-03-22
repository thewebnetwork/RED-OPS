import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  FolderKanban,
  Plus,
  Filter,
  Calendar,
  Users,
  CheckSquare,
  MoreHorizontal,
  ChevronRight,
  Circle,
  Clock,
  Folder,
  Tag,
  X
} from 'lucide-react';
;

const mockProjects = [
  {
    id: 1,
    name: 'Thompson RE — April Campaign',
    type: 'Campaign Build',
    client: 'Thompson Realty',
    progress: 65,
    tasksComplete: 13,
    tasksTotal: 20,
    dueDate: '2026-05-15',
    status: 'Active',
    team: [
      { initials: 'MR', name: 'Marcus Rodriguez' },
      { initials: 'JP', name: 'Jessica Park' },
      { initials: 'DK', name: 'David Kim' }
    ]
  },
  {
    id: 2,
    name: 'Riverside Realty Onboarding',
    type: 'Client Onboarding',
    client: 'Riverside Realty',
    progress: 40,
    tasksComplete: 6,
    tasksTotal: 16,
    dueDate: '2026-04-30',
    status: 'Active',
    team: [
      { initials: 'SC', name: 'Sarah Chen' },
      { initials: 'AT', name: 'Alex Thompson' }
    ]
  },
  {
    id: 3,
    name: 'Apex Content Sprint — May',
    type: 'Creative Sprint',
    client: 'Apex Marketing',
    progress: 10,
    tasksComplete: 2,
    tasksTotal: 20,
    dueDate: '2026-05-31',
    status: 'Planning',
    team: [
      { initials: 'JP', name: 'Jessica Park' },
      { initials: 'MR', name: 'Marcus Rodriguez' }
    ]
  },
  {
    id: 4,
    name: 'Dani K. Rebrand Package',
    type: 'Campaign Build',
    client: 'Dani K. Coaching',
    progress: 90,
    tasksComplete: 18,
    tasksTotal: 20,
    dueDate: '2026-04-22',
    status: 'Active',
    team: [
      { initials: 'DK', name: 'David Kim' },
      { initials: 'JP', name: 'Jessica Park' },
      { initials: 'SC', name: 'Sarah Chen' }
    ]
  },
  {
    id: 5,
    name: 'Burnham Strategy Build',
    type: 'Internal',
    progress: 55,
    tasksComplete: 11,
    tasksTotal: 20,
    dueDate: '2026-05-10',
    status: 'Active',
    team: [
      { initials: 'MR', name: 'Marcus Rodriguez' },
      { initials: 'AT', name: 'Alex Thompson' }
    ]
  },
  {
    id: 6,
    name: 'RRM ISA Scripts Update',
    type: 'Internal',
    progress: 100,
    tasksComplete: 8,
    tasksTotal: 8,
    dueDate: '2026-04-15',
    status: 'Completed',
    team: [
      { initials: 'AT', name: 'Alex Thompson' }
    ]
  },
  {
    id: 7,
    name: 'Riverside May Content Month',
    type: 'Creative Sprint',
    client: 'Riverside Realty',
    progress: 0,
    tasksComplete: 0,
    tasksTotal: 30,
    dueDate: '2026-05-31',
    status: 'Planning',
    team: [
      { initials: 'JP', name: 'Jessica Park' }
    ]
  },
  {
    id: 8,
    name: 'Team SOP Audit Q2',
    type: 'Internal',
    progress: 30,
    tasksComplete: 3,
    tasksTotal: 10,
    dueDate: '2026-05-20',
    status: 'Active',
    team: [
      { initials: 'SC', name: 'Sarah Chen' },
      { initials: 'MR', name: 'Marcus Rodriguez' },
      { initials: 'AT', name: 'Alex Thompson' },
      { initials: 'DK', name: 'David Kim' }
    ]
  }
];

const typeConfig = {
  'Campaign Build': { color: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)' },
  'Client Onboarding': { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
  'Creative Sprint': { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)' },
  'Internal': { color: '#606060', bg: 'rgba(96, 96, 96, 0.15)' }
};

const statusConfig = {
  'Active': { color: '#22c55e', icon: Circle },
  'Planning': { color: '#f59e0b', icon: Clock },
  'Completed': { color: '#3b82f6', icon: CheckSquare },
  'On Hold': { color: '#c92a3e', icon: Clock }
};

function ProjectModal({ onClose, onCreate }) {
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    client: '',
    dueDate: '',
    teamMembers: []
  });

  const teamOptions = ['Sarah Chen', 'Marcus Rodriguez', 'Jessica Park', 'David Kim', 'Alex Thompson'];
  const typeOptions = ['Campaign Build', 'Client Onboarding', 'Creative Sprint', 'Internal'];
  const clientOptions = ['Thompson Realty', 'Riverside Realty', 'Apex Marketing', 'Dani K. Coaching', 'Burnham Group'];

  const handleSubmit = () => {
    if (formData.name && formData.type) {
      onCreate(formData);
      onClose();
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div className="card" style={{
        width: '90%',
        maxWidth: '500px',
        padding: '30px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px'
        }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: '700',
            color: 'var(--tx-1)',
            margin: 0
          }}>
            New Project
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--tx-2)',
              padding: '4px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '500',
              color: 'var(--tx-2)',
              marginBottom: '6px'
            }}>
              Project Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input-field"
              placeholder="e.g., Acme Corp Campaign"
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '500',
              color: 'var(--tx-2)',
              marginBottom: '6px'
            }}>
              Project Type *
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="input-field"
              style={{ cursor: 'pointer' }}
            >
              <option value="">Select a type</option>
              {typeOptions.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          {formData.type !== 'Internal' && (
            <div>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '500',
                color: 'var(--tx-2)',
                marginBottom: '6px'
              }}>
                Client
              </label>
              <select
                value={formData.client}
                onChange={(e) => setFormData({ ...formData, client: e.target.value })}
                className="input-field"
                style={{ cursor: 'pointer' }}
              >
                <option value="">Select a client</option>
                {clientOptions.map(client => (
                  <option key={client} value={client}>{client}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '500',
              color: 'var(--tx-2)',
              marginBottom: '6px'
            }}>
              Target Completion Date
            </label>
            <input
              type="date"
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              className="input-field"
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '500',
              color: 'var(--tx-2)',
              marginBottom: '6px'
            }}>
              Team Members
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {teamOptions.map(member => (
                <label key={member} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  padding: '8px 0'
                }}>
                  <input
                    type="checkbox"
                    checked={formData.teamMembers.includes(member)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({
                          ...formData,
                          teamMembers: [...formData.teamMembers, member]
                        });
                      } else {
                        setFormData({
                          ...formData,
                          teamMembers: formData.teamMembers.filter(m => m !== member)
                        });
                      }
                    }}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <span style={{ color: 'var(--tx-1)', fontSize: '14px' }}>{member}</span>
                </label>
              ))}
            </div>
          </div>

          {formData.type === 'Client Onboarding' && (
            <div style={{
              padding: '12px',
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '6px',
              fontSize: '13px',
              color: '#60a5fa'
            }}>
              Auto-generates 16-step onboarding checklist
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <button
              onClick={handleSubmit}
              className="btn-primary"
              style={{ flex: 1 }}
            >
              Create Project
            </button>
            <button
              onClick={onClose}
              className="btn-ghost"
              style={{ flex: 1 }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Projects() {
  const navigate = useNavigate();
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [projects, setProjects] = useState(mockProjects);

  const filters = ['All', 'Campaign Build', 'Client Onboarding', 'Creative Sprint', 'Internal'];

  const filteredProjects = useMemo(() => {
    if (selectedFilter === 'All') return projects;
    return projects.filter(p => p.type === selectedFilter);
  }, [selectedFilter, projects]);

  const handleCreateProject = (formData) => {
    const newProject = {
      id: projects.length + 1,
      ...formData,
      progress: 0,
      tasksComplete: 0,
      tasksTotal: formData.type === 'Client Onboarding' ? 16 : 20,
      status: 'Planning',
      team: formData.teamMembers.map(name => ({
        initials: name.split(' ').map(n => n[0]).join(''),
        name
      }))
    };
    setProjects([...projects, newProject]);
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const daysUntilDue = (dueDate) => {
    const due = new Date(dueDate);
    const today = new Date();
    const days = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
    return days;
  };

  return (
    <div className="page-fill">
      {/* Header */}
      <div style={{
        padding: '20px',
        borderBottom: `1px solid var(--border)`,
        background: 'var(--bg-card)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h1 style={{
          fontSize: '28px',
          fontWeight: '700',
          color: 'var(--tx-1)',
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <FolderKanban size={32} />
          Projects
        </h1>
        <button
          onClick={() => setShowNewProjectModal(true)}
          className="btn-primary"
        >
          <Plus size={16} style={{ marginRight: '6px' }} />
          New Project
        </button>
      </div>

      {/* Filter Tabs */}
      <div style={{
        padding: '16px 20px',
        borderBottom: `1px solid var(--border)`,
        background: 'var(--bg-card)',
        display: 'flex',
        gap: '8px',
        overflowX: 'auto'
      }}>
        {filters.map(filter => (
          <button
            key={filter}
            onClick={() => setSelectedFilter(filter)}
            style={{
              padding: '8px 16px',
              background: selectedFilter === filter ? 'var(--bg-elevated)' : 'transparent',
              border: `1px solid ${selectedFilter === filter ? 'var(--border-hi)' : 'transparent'}`,
              borderRadius: '6px',
              color: selectedFilter === filter ? 'var(--tx-1)' : 'var(--tx-2)',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => {
              if (selectedFilter !== filter) {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.color = 'var(--tx-1)';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedFilter !== filter) {
                e.currentTarget.style.borderColor = 'transparent';
                e.currentTarget.style.color = 'var(--tx-2)';
              }
            }}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Project Grid */}
      <div style={{
        padding: '20px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(520px, 1fr))',
        gap: '20px',
        overflowY: 'auto',
        flex: 1
      }}>
        {filteredProjects.map(project => {
          const config = typeConfig[project.type];
          const statusCfg = statusConfig[project.status];
          const StatusIcon = statusCfg.icon;
          const daysLeft = daysUntilDue(project.dueDate);

          return (
            <div
              key={project.id}
              className="card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                padding: '18px 20px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Header Row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                  <div style={{
                    padding: '6px 10px',
                    background: config.bg,
                    border: `1px solid ${config.color}`,
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: '600',
                    color: config.color,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    {project.type}
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: statusCfg.color,
                    fontSize: '12px',
                    fontWeight: '500'
                  }}>
                    <StatusIcon size={14} />
                    {project.status}
                  </div>
                </div>
                <button
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    color: 'var(--tx-3)',
                    transition: 'color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--tx-1)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--tx-3)'}
                >
                  <MoreHorizontal size={18} />
                </button>
              </div>

              {/* Project Name */}
              <div>
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: '700',
                  color: 'var(--tx-1)',
                  margin: '0 0 4px 0'
                }}>
                  {project.name}
                </h3>
                {project.client && (
                  <div style={{
                    fontSize: '13px',
                    color: 'var(--tx-2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <Folder size={12} />
                    For: <span style={{ color: 'var(--tx-1)', fontWeight: '500' }}>{project.client}</span>
                  </div>
                )}
              </div>

              {/* Progress Bar */}
              <div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '8px'
                }}>
                  <span style={{ fontSize: '13px', color: 'var(--tx-2)' }}>Progress</span>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--tx-1)' }}>
                    {project.progress}%
                  </span>
                </div>
                <div style={{
                  width: '100%',
                  height: '6px',
                  background: 'var(--bg)',
                  borderRadius: '3px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    height: '100%',
                    width: `${project.progress}%`,
                    background: project.progress === 100 ? 'var(--green)' : project.progress >= 75 ? 'var(--blue)' : project.progress >= 50 ? 'var(--purple)' : 'var(--red)',
                    transition: 'width 0.3s'
                  }} />
                </div>
              </div>

              {/* Task Count */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px',
                color: 'var(--tx-2)'
              }}>
                <CheckSquare size={16} />
                <span>
                  <span style={{ color: 'var(--tx-1)', fontWeight: '600' }}>
                    {project.tasksComplete}
                  </span>
                  /{project.tasksTotal} tasks complete
                </span>
              </div>

              {/* Bottom Row: Team + Due Date */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: '12px',
                borderTop: `1px solid var(--border)`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden' }}>
                  {project.team.slice(0, 3).map((member, i) => (
                    <div
                      key={i}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: 'var(--bg-elevated)',
                        border: `2px solid var(--border)`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        fontWeight: '600',
                        color: 'var(--tx-1)',
                        marginLeft: i > 0 ? '-8px' : '0',
                        zIndex: 3 - i,
                        position: 'relative',
                        title: member.name
                      }}
                    >
                      {member.initials}
                    </div>
                  ))}
                  {project.team.length > 3 && (
                    <div style={{
                      fontSize: '11px',
                      color: 'var(--tx-2)',
                      marginLeft: '4px'
                    }}>
                      +{project.team.length - 3}
                    </div>
                  )}
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  color: daysLeft <= 7 ? 'var(--red)' : daysLeft <= 14 ? 'var(--yellow)' : 'var(--tx-2)'
                }}>
                  <Calendar size={14} />
                  {formatDate(project.dueDate)}
                  {daysLeft <= 14 && (
                    <span style={{ fontWeight: '600' }}>({daysLeft}d)</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* New Project Modal */}
      {showNewProjectModal && (
        <ProjectModal
          onClose={() => setShowNewProjectModal(false)}
          onCreate={handleCreateProject}
        />
      )}
    </div>
  );
}
