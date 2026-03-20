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
;

const Team = () => {
  const navigate = useNavigate();
  const [selectedMember, setSelectedMember] = useState(null);

  // Mock team members
  const teamMembers = [
    {
      id: 1,
      name: 'Vitto Pessanha',
      role: 'Founder/CEO',
      specialty: ['Strategy', 'Meta Ads', 'Sales'],
      avatar: 'VP',
      color: 'red',
      tasksThisWeek: 3,
      maxTasks: 8,
      tasksCompletedMonth: 18,
      avgDeliveryTime: '1.2 days',
      satisfactionScore: 4.9,
    },
    {
      id: 2,
      name: 'Taryn Pessanha',
      role: 'Creative Director',
      specialty: ['Video Editing', 'Design', 'Creative Strategy'],
      avatar: 'TP',
      color: 'purple',
      tasksThisWeek: 8,
      maxTasks: 12,
      tasksCompletedMonth: 32,
      avgDeliveryTime: '1.8 days',
      satisfactionScore: 4.8,
    },
    {
      id: 3,
      name: 'Lucca Rossini',
      role: 'Media Buyer',
      specialty: ['Meta Ads', 'Google Ads', 'Analytics'],
      avatar: 'LR',
      color: 'blue',
      tasksThisWeek: 11,
      maxTasks: 14,
      tasksCompletedMonth: 28,
      avgDeliveryTime: '1.5 days',
      satisfactionScore: 4.7,
    },
    {
      id: 4,
      name: 'Sarah Chen',
      role: 'Copywriter',
      specialty: ['Copywriting', 'Email Marketing', 'Strategy'],
      avatar: 'SC',
      color: 'green',
      tasksThisWeek: 7,
      maxTasks: 10,
      tasksCompletedMonth: 24,
      avgDeliveryTime: '1.3 days',
      satisfactionScore: 4.9,
    },
    {
      id: 5,
      name: 'Marcus Obi',
      role: 'Video Editor',
      specialty: ['Video Editing', 'Motion Graphics', 'Reels'],
      avatar: 'MO',
      color: 'yellow',
      tasksThisWeek: 9,
      maxTasks: 12,
      tasksCompletedMonth: 31,
      avgDeliveryTime: '2.1 days',
      satisfactionScore: 4.8,
    },
    {
      id: 6,
      name: 'Jordan Kim',
      role: 'Account Manager',
      specialty: ['Client Success', 'Project Management', 'Reporting'],
      avatar: 'JK',
      color: 'red',
      tasksThisWeek: 6,
      maxTasks: 11,
      tasksCompletedMonth: 20,
      avgDeliveryTime: '1.1 days',
      satisfactionScore: 5.0,
    },
  ];

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
