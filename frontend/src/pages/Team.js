import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Plus,
  MoreHorizontal,
  Mail,
  Phone,
  Star,
  TrendingUp,
  Clock,
  CheckSquare,
  BarChart2,
  Briefcase,
} from 'lucide-react';
import axios from 'axios';

const Team = () => {
  const navigate = useNavigate();
  const [selectedMember, setSelectedMember] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize API
  const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

  // Generate initials from name
  const getInitials = (name) => {
    return name
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0].toUpperCase())
      .join('');
  };

  // Get avatar color based on user ID
  const getColorForUserId = (userId) => {
    const colors = ['red', 'blue', 'green', 'purple', 'yellow'];
    return colors[userId % colors.length];
  };

  // Fetch team members from API
  useEffect(() => {
    const fetchTeamMembers = async () => {
      try {
        setLoading(true);
        setError(null);

        const token = localStorage.getItem('token');
        if (!token) {
          setError('Authentication required. Please log in.');
          setLoading(false);
          return;
        }

        // Fetch users
        const usersResponse = await axios.get(`${API}/users`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        let users = usersResponse.data.data || usersResponse.data || [];
        if (!Array.isArray(users)) {
          users = [];
        }

        // Fetch tasks to calculate stats
        let taskStats = {};
        try {
          const tasksResponse = await axios.get(`${API}/tasks`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          const tasks = tasksResponse.data.data || tasksResponse.data || [];

          // Calculate tasks this week and completed this month per user
          const now = new Date();
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);

          taskStats = users.reduce((acc, user) => {
            acc[user.id] = {
              tasksThisWeek: 0,
              tasksCompletedMonth: 0,
              avgDeliveryTime: '—',
              satisfactionScore: '—',
            };
            return acc;
          }, {});

          // Count tasks
          tasks.forEach((task) => {
            const assigneeId = task.assignee_id || task.assignedTo?.id;
            if (assigneeId && taskStats[assigneeId]) {
              // Tasks this week
              const createdDate = new Date(task.created_at || task.createdAt);
              if (createdDate >= weekAgo) {
                taskStats[assigneeId].tasksThisWeek += 1;
              }

              // Completed this month
              if (task.status === 'completed' || task.status === 'done') {
                const completedDate = new Date(task.completed_at || task.completedAt || task.updated_at || task.updatedAt);
                if (completedDate >= monthAgo) {
                  taskStats[assigneeId].tasksCompletedMonth += 1;
                }
              }
            }
          });
        } catch (taskError) {
          console.warn('Could not fetch task stats:', taskError);
        }

        // Transform users to match component format
        const transformedMembers = users.map((user) => ({
          id: user.id,
          name: user.name || user.username || 'Unknown User',
          role: user.role || user.title || 'Team Member',
          specialty: user.specialty ? (Array.isArray(user.specialty) ? user.specialty : [user.specialty]) : [],
          avatar: getInitials(user.name || user.username || 'User'),
          color: getColorForUserId(user.id),
          tasksThisWeek: taskStats[user.id]?.tasksThisWeek || 0,
          maxTasks: user.maxTasks || 15,
          tasksCompletedMonth: taskStats[user.id]?.tasksCompletedMonth || 0,
          avgDeliveryTime: taskStats[user.id]?.avgDeliveryTime || '—',
          satisfactionScore: taskStats[user.id]?.satisfactionScore || '—',
        }));

        setTeamMembers(transformedMembers);
      } catch (err) {
        console.error('Error fetching team members:', err);
        setError(err.response?.data?.message || 'Failed to load team members');
      } finally {
        setLoading(false);
      }
    };

    fetchTeamMembers();
  }, [API]);

  // Calculate workload percentage
  const getWorkloadPercentage = (current, max) => {
    return Math.round((current / max) * 100);
  };

  // Get workload color
  const getWorkloadColor = (percentage) => {
    if (percentage < 50) return 'var(--green)';
    if (percentage < 80) return 'var(--yellow)';
    return 'var(--red)';
  };

  // Get avatar background color
  const getAvatarColor = (color) => {
    const colorMap = {
      red: 'var(--red)',
      blue: 'var(--blue)',
      green: 'var(--green)',
      purple: 'var(--purple)',
      yellow: 'var(--yellow)',
    };
    return colorMap[color] || 'var(--purple)';
  };

  // Show loading state
  if (loading) {
    return (
      <div className="page-content">
        <div className="team-header">
          <div>
            <h1>Team Hub</h1>
            <p className="text-secondary">Manage and monitor team capacity</p>
          </div>
        </div>
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--tx-2)' }}>
          <p>Loading team members...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="page-content">
        <div className="team-header">
          <div>
            <h1>Team Hub</h1>
            <p className="text-secondary">Manage and monitor team capacity</p>
          </div>
        </div>
        <div style={{ padding: '20px', backgroundColor: 'var(--error-bg)', borderRadius: '6px', color: 'var(--error)' }}>
          <p>Error: {error}</p>
        </div>
      </div>
    );
  }

  // Show empty state
  if (teamMembers.length === 0) {
    return (
      <div className="page-content">
        <div className="team-header">
          <div>
            <h1>Team Hub</h1>
            <p className="text-secondary">Manage and monitor team capacity</p>
          </div>
          <button className="btn-primary btn-sm">
            <Plus size={16} style={{ marginRight: '6px' }} />
            Add Member
          </button>
        </div>
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--tx-2)' }}>
          <Users size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
          <p>No team members found. Start by adding a member.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      {/* Header */}
      <div className="team-header">
        <div>
          <h1>Team Hub</h1>
          <p className="text-secondary">Manage and monitor team capacity</p>
        </div>
        <button className="btn-primary btn-sm">
          <Plus size={16} style={{ marginRight: '6px' }} />
          Add Member
        </button>
      </div>

      {/* Team Members Grid */}
      <div className="team-grid">
        {teamMembers.map((member) => {
          const workloadPercentage = getWorkloadPercentage(member.tasksThisWeek, member.maxTasks);
          const workloadColor = getWorkloadColor(workloadPercentage);

          return (
            <div className="card team-card" key={member.id}>
              {/* Card Header with Avatar and Name */}
              <div className="team-card-header">
                <div className="avatar" style={{ backgroundColor: getAvatarColor(member.color) }}>
                  {member.avatar}
                </div>
                <div className="team-member-info">
                  <h3 className="team-member-name">{member.name}</h3>
                  <p className="team-member-role">{member.role}</p>
                </div>
                <button className="btn-ghost btn-sm" style={{ padding: '4px' }}>
                  <MoreHorizontal size={16} />
                </button>
              </div>

              {/* Specialties */}
              <div className="specialties">
                {member.specialty.map((spec, idx) => (
                  <span key={idx} className="pill pill-gray">
                    {spec}
                  </span>
                ))}
              </div>

              {/* Workload Bar */}
              <div className="workload-section">
                <div className="workload-label">
                  <span className="text-secondary">{member.tasksThisWeek} tasks this week</span>
                  <span className="workload-percentage">{workloadPercentage}%</span>
                </div>
                <div className="workload-bar">
                  <div
                    className="workload-fill"
                    style={{
                      width: `${Math.min(workloadPercentage, 100)}%`,
                      backgroundColor: workloadColor,
                    }}
                  ></div>
                </div>
              </div>

              {/* Stats Row */}
              <div className="stats-grid">
                <div className="stat">
                  <div className="stat-icon">
                    <CheckSquare size={16} />
                  </div>
                  <div className="stat-content">
                    <div className="stat-value">{member.tasksCompletedMonth}</div>
                    <div className="stat-label">Completed/mo</div>
                  </div>
                </div>
                <div className="stat">
                  <div className="stat-icon">
                    <Clock size={16} />
                  </div>
                  <div className="stat-content">
                    <div className="stat-value">{member.avgDeliveryTime}</div>
                    <div className="stat-label">Avg delivery</div>
                  </div>
                </div>
                <div className="stat">
                  <div className="stat-icon">
                    <Star size={16} />
                  </div>
                  <div className="stat-content">
                    <div className="stat-value">{member.satisfactionScore}</div>
                    <div className="stat-label">Satisfaction</div>
                  </div>
                </div>
              </div>

              {/* View Profile Button */}
              <button className="btn-ghost btn-sm" style={{ width: '100%', marginTop: '12px' }}>
                View Profile
              </button>
            </div>
          );
        })}
      </div>

      {/* Workload Overview Section */}
      <div className="card" style={{ marginTop: '24px' }}>
        <div className="card-header">
          <h2>Workload Overview</h2>
          <BarChart2 size={18} style={{ color: 'var(--tx-2)' }} />
        </div>

        <div className="workload-overview-table">
          <table className="data-table">
            <thead>
              <tr>
                <th>Team Member</th>
                <th>Role</th>
                <th>Tasks This Week</th>
                <th>Capacity</th>
                <th>Utilization</th>
              </tr>
            </thead>
            <tbody>
              {teamMembers.map((member) => {
                const workloadPercentage = getWorkloadPercentage(member.tasksThisWeek, member.maxTasks);
                const workloadColor = getWorkloadColor(workloadPercentage);

                return (
                  <tr key={member.id}>
                    <td>
                      <div className="table-member-info">
                        <div
                          className="small-avatar"
                          style={{ backgroundColor: getAvatarColor(member.color) }}
                        >
                          {member.avatar}
                        </div>
                        <span className="font-medium">{member.name}</span>
                      </div>
                    </td>
                    <td className="text-secondary">{member.role}</td>
                    <td className="text-center">
                      {member.tasksThisWeek} / {member.maxTasks}
                    </td>
                    <td>
                      <div className="mini-workload-bar">
                        <div
                          className="mini-workload-fill"
                          style={{
                            width: `${Math.min(workloadPercentage, 100)}%`,
                            backgroundColor: workloadColor,
                          }}
                        ></div>
                      </div>
                    </td>
                    <td className="text-right">
                      <span
                        style={{
                          color: workloadColor,
                          fontWeight: '500',
                        }}
                      >
                        {workloadPercentage}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Capacity Summary */}
        <div className="capacity-summary">
          <div className="capacity-item">
            <div className="capacity-dot" style={{ backgroundColor: 'var(--green)' }}></div>
            <span>
              <strong>{teamMembers.filter((m) => getWorkloadPercentage(m.tasksThisWeek, m.maxTasks) < 50).length}</strong> members
              under 50% capacity
            </span>
          </div>
          <div className="capacity-item">
            <div className="capacity-dot" style={{ backgroundColor: 'var(--yellow)' }}></div>
            <span>
              <strong>{teamMembers.filter((m) => {
                const pct = getWorkloadPercentage(m.tasksThisWeek, m.maxTasks);
                return pct >= 50 && pct < 80;
              }).length}</strong> members
              at 50-80% capacity
            </span>
          </div>
          <div className="capacity-item">
            <div className="capacity-dot" style={{ backgroundColor: 'var(--red)' }}></div>
            <span>
              <strong>{teamMembers.filter((m) => getWorkloadPercentage(m.tasksThisWeek, m.maxTasks) >= 80).length}</strong> members
              over 80% capacity
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Team;
