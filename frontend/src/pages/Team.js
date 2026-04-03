/**
 * Team Hub — Full team & capacity management
 *
 * Features:
 *   • Summary KPI bar (total, active, teams, avg capacity)
 *   • Search + filters (role, account type, team, status)
 *   • View toggle: cards / table
 *   • Team grouping with collapsible sections
 *   • Member cards with real task stats & workload bars
 *   • Slide-in detail panel with recent tasks & activity
 *   • Add / Edit member modals with team assignment
 *   • Team CRUD (create, rename, delete teams)
 *   • Capacity heatmap summary
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import {
  Users, Plus, MoreHorizontal, Mail, X, Edit2, Trash2,
  Star, Clock, CheckSquare, BarChart2, UserPlus, Eye,
  Search, Filter, ChevronDown, ChevronRight, Grid3X3,
  List, Shield, FolderKanban, Activity, Circle, Hash,
  Phone, Calendar, ArrowUpRight, Briefcase, Layers,
  AlertCircle, UserCheck, UserX, RefreshCw,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const tok = () => localStorage.getItem('token');
const ax = () => axios.create({ headers: { Authorization: `Bearer ${tok()}` } });

/* ── helpers ── */
const initials = (n) => (n || '?').split(' ').slice(0, 2).map(w => w[0]?.toUpperCase()).join('');
const AVATAR_COLORS = ['#c92a3e','#7c3aed','#2563eb','#059669','#d97706','#0891b2','#db2777','#65a30d'];
const avatarBg = (id) => AVATAR_COLORS[(typeof id === 'string' ? id.charCodeAt(0) + (id.charCodeAt(1) || 0) : id) % AVATAR_COLORS.length];
const pct = (a, b) => b ? Math.round((a / b) * 100) : 0;
const capColor = (p) => p < 50 ? 'var(--green)' : p < 80 ? 'var(--yellow)' : 'var(--red)';
const capLabel = (p) => p < 50 ? 'Available' : p < 80 ? 'Busy' : 'At Capacity';

const ROLES = ['Administrator', 'Operator', 'Standard User'];
const ACCOUNT_TYPES = ['Internal Staff', 'Partner', 'Media Client', 'Vendor/Freelancer'];

const ROLE_ICONS = {
  'Administrator': <Shield size={12} style={{ color: 'var(--red)' }} />,
  'Operator': <Activity size={12} style={{ color: 'var(--accent)' }} />,
  'Standard User': <Circle size={12} style={{ color: 'var(--tx-3)' }} />,
};

/* ═══════════════════════════════════════════════════════════
   MAIN TEAM PAGE
   ═══════════════════════════════════════════════════════════ */
function Team() {
  const navigate = useNavigate();
  const [members, setMembers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // View state
  const [view, setView] = useState(() => localStorage.getItem('team_view') || 'cards');
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterTeam, setFilterTeam] = useState('all');
  const [filterStatus, setFilterStatus] = useState('active');
  const [groupBy, setGroupBy] = useState('none'); // none, team, role
  const [collapsedGroups, setCollapsedGroups] = useState({});

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editMember, setEditMember] = useState(null);
  const [viewMember, setViewMember] = useState(null);
  const [showTeamModal, setShowTeamModal] = useState(false);

  // Persistence
  useEffect(() => { localStorage.setItem('team_view', view); }, [view]);

  /* ── Data loading ── */
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, teamsRes, specsRes] = await Promise.allSettled([
        ax().get(`${API}/users`),
        ax().get(`${API}/teams`),
        ax().get(`${API}/specialties`),
      ]);

      // Users
      let users = [];
      if (usersRes.status === 'fulfilled') {
        users = usersRes.value.data?.data || usersRes.value.data || [];
        if (!Array.isArray(users)) users = [];
      }

      // Teams
      let teamList = [];
      if (teamsRes.status === 'fulfilled') {
        teamList = teamsRes.value.data || [];
        if (!Array.isArray(teamList)) teamList = [];
      }

      // Specialties
      let specList = [];
      if (specsRes.status === 'fulfilled') {
        specList = specsRes.value.data || [];
        if (!Array.isArray(specList)) specList = [];
      }

      // Fetch tasks for stats
      let tasksByUser = {};
      try {
        const tasksRes = await ax().get(`${API}/tasks`);
        const tasks = tasksRes.data?.data || tasksRes.data || [];
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 86400000);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        tasks.forEach(t => {
          const aid = t.assignee_id || t.assignedTo?.id;
          if (!aid) return;
          if (!tasksByUser[aid]) tasksByUser[aid] = { week: 0, monthDone: 0, open: 0, recentTasks: [] };
          const created = new Date(t.created_at || t.createdAt || 0);
          const updated = new Date(t.updated_at || t.updatedAt || 0);
          if (created >= weekAgo) tasksByUser[aid].week++;
          const isDone = ['completed', 'done', 'Done', 'delivered'].includes(t.status);
          if (isDone && updated >= monthStart) tasksByUser[aid].monthDone++;
          if (!isDone) tasksByUser[aid].open++;
          tasksByUser[aid].recentTasks.push({
            id: t._id || t.id,
            title: t.title || t.name || 'Untitled',
            status: t.status,
            due: t.due_date,
            priority: t.priority,
          });
        });
        // Sort recent tasks
        Object.values(tasksByUser).forEach(u => {
          u.recentTasks = u.recentTasks.slice(0, 5);
        });
      } catch { /* tasks optional */ }

      setMembers(users.map(u => {
        const ts = tasksByUser[u.id] || { week: 0, monthDone: 0, open: 0, recentTasks: [] };
        const maxTasks = u.maxTasks || u.max_tasks || 15;
        return {
          id: u.id,
          name: u.name || u.username || 'Unknown',
          email: u.email || '',
          role: u.role || 'Standard User',
          account_type: u.account_type || 'Internal Staff',
          specialty: u.specialty ? (Array.isArray(u.specialty) ? u.specialty : [u.specialty]) : [],
          specialty_ids: u.specialty_ids || [],
          team_id: u.team_id || null,
          active: u.active !== false,
          maxTasks,
          tasksThisWeek: ts.week,
          tasksCompletedMonth: ts.monthDone,
          openTasks: ts.open,
          recentTasks: ts.recentTasks,
          utilization: pct(ts.week, maxTasks),
          created_at: u.created_at || u.createdAt,
          last_login: u.last_login,
        };
      }));

      setTeams(teamList.map(t => ({
        id: t.id || t._id,
        name: t.name,
        description: t.description || '',
        color: t.color || '#6366f1',
        active: t.active !== false,
        member_count: users.filter(u => u.team_id === (t.id || t._id)).length,
      })));

      setSpecialties(specList);
    } catch (err) {
      setError('Failed to load team data');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ── Filtering ── */
  const filtered = useMemo(() => {
    let list = members;
    if (filterStatus === 'active') list = list.filter(m => m.active);
    else if (filterStatus === 'inactive') list = list.filter(m => !m.active);
    if (filterRole !== 'all') list = list.filter(m => m.role === filterRole);
    if (filterType !== 'all') list = list.filter(m => m.account_type === filterType);
    if (filterTeam !== 'all') {
      if (filterTeam === 'unassigned') list = list.filter(m => !m.team_id);
      else list = list.filter(m => m.team_id === filterTeam);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(m =>
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.role.toLowerCase().includes(q) ||
        m.specialty.some(s => s.toLowerCase().includes(q))
      );
    }
    return list;
  }, [members, search, filterRole, filterType, filterTeam, filterStatus]);

  /* ── Grouping ── */
  const grouped = useMemo(() => {
    if (groupBy === 'none') return [{ key: 'all', label: null, members: filtered }];
    if (groupBy === 'team') {
      const teamGroups = teams.map(t => ({
        key: t.id,
        label: t.name,
        color: t.color,
        members: filtered.filter(m => m.team_id === t.id),
      }));
      const unassigned = filtered.filter(m => !m.team_id);
      if (unassigned.length) teamGroups.push({ key: 'unassigned', label: 'Unassigned', color: 'var(--tx-3)', members: unassigned });
      return teamGroups.filter(g => g.members.length > 0);
    }
    if (groupBy === 'role') {
      return ROLES.map(r => ({
        key: r, label: r, members: filtered.filter(m => m.role === r),
      })).filter(g => g.members.length > 0);
    }
    return [{ key: 'all', label: null, members: filtered }];
  }, [filtered, groupBy, teams]);

  const toggleGroup = (key) => setCollapsedGroups(p => ({ ...p, [key]: !p[key] }));

  /* ── Summary stats ── */
  const activeCount = members.filter(m => m.active).length;
  const avgUtil = activeCount ? Math.round(members.filter(m => m.active).reduce((s, m) => s + m.utilization, 0) / activeCount) : 0;
  const overloaded = members.filter(m => m.active && m.utilization >= 80).length;

  /* ── Actions ── */
  const handleRemove = async (member) => {
    if (!window.confirm(`Deactivate ${member.name}'s account?`)) return;
    try {
      await ax().patch(`${API}/users/${member.id}`, { active: false });
      toast.success(`${member.name} deactivated`);
      fetchAll();
    } catch { toast.error('Failed to deactivate member'); }
  };

  const handleRestore = async (member) => {
    try {
      await ax().post(`${API}/users/${member.id}/restore`);
      toast.success(`${member.name} restored`);
      fetchAll();
    } catch { toast.error('Failed to restore member'); }
  };

  const handleResetPassword = async (member, mode) => {
    if (mode === 'email') {
      try {
        await ax().post(`${API}/users/${member.id}/send-reset-email`);
        toast.success(`Password reset email sent to ${member.email}`);
      } catch (err) {
        // Email likely failed because SMTP isn't configured — offer manual alternative
        const detail = err.response?.data?.detail || '';
        if (detail.includes('email') || detail.includes('SMTP') || err.response?.status === 500) {
          toast.error('Email service not configured. Use "Set Password" instead to set their password manually.');
        } else {
          toast.error(detail || 'Failed to send reset email');
        }
      }
    } else {
      const newPass = window.prompt(`Set new password for ${member.name} (min 8 chars).\n\nThey will be forced to change it on first login.`);
      if (!newPass) return;
      if (newPass.length < 8) { toast.error('Password must be at least 8 characters'); return; }
      try {
        await ax().post(`${API}/users/${member.id}/set-password`, { password: newPass, force_change: true });
        // Show the credentials so admin can share manually
        const loginUrl = window.location.origin + '/login';
        toast.success(`Password set for ${member.name}`);
        window.prompt(
          `Share these login details with ${member.name}:\n\nLogin: ${loginUrl}\nEmail: ${member.email}\nPassword: ${newPass}\n\n(Copy this text)`,
          `Login: ${loginUrl}\nEmail: ${member.email}\nPassword: ${newPass}`
        );
      } catch (err) {
        toast.error(err.response?.data?.detail || 'Failed to set password');
      }
    }
  };

  const handleDeleteMember = async (member) => {
    if (!window.confirm(`Permanently delete ${member.name}? This removes their account and cannot be undone.`)) return;
    try {
      await ax().delete(`${API}/users/${member.id}/hard-delete`);
      toast.success(`${member.name} permanently deleted`);
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete member');
    }
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: 'none' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--tx-1)', margin: 0 }}>Team</h1>
          <p style={{ fontSize: 13, color: 'var(--tx-3)', margin: '4px 0 0' }}>
            Manage members, assign roles, and monitor capacity
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowTeamModal(true)} style={btnSec}>
            <Layers size={15} /> Manage Teams
          </button>
          <button onClick={() => setShowAddModal(true)} style={btnPri}>
            <UserPlus size={15} /> Add Member
          </button>
        </div>
      </div>

      {/* ── KPI Summary ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Members', value: members.length, icon: <Users size={18} />, color: 'var(--accent)' },
          { label: 'Active', value: activeCount, icon: <UserCheck size={18} />, color: 'var(--green)' },
          { label: 'Teams', value: teams.filter(t => t.active).length, icon: <Layers size={18} />, color: 'var(--purple)' },
          { label: 'Avg Utilization', value: `${avgUtil}%`, icon: <BarChart2 size={18} />, color: capColor(avgUtil) },
          { label: 'At Capacity', value: overloaded, icon: <AlertCircle size={18} />, color: overloaded > 0 ? 'var(--red)' : 'var(--green)' },
        ].map(kpi => (
          <div key={kpi.label} style={{
            background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10,
            padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: `color-mix(in srgb, ${kpi.color} 15%, transparent)`, color: kpi.color,
            }}>
              {kpi.icon}
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--tx-1)', lineHeight: 1 }}>{kpi.value}</div>
              <div style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 2 }}>{kpi.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap',
        padding: '10px 14px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10,
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 160 }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx-3)' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, specialty…"
            style={{ ...inp, paddingLeft: 32, width: '100%' }}
          />
        </div>

        {/* Filters */}
        <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} style={sel}>
          <option value="all">All Roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={sel}>
          <option value="all">All Types</option>
          {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterTeam} onChange={(e) => setFilterTeam(e.target.value)} style={sel}>
          <option value="all">All Teams</option>
          <option value="unassigned">Unassigned</option>
          {teams.filter(t => t.active).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={sel}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="all">All</option>
        </select>

        <div style={{ height: 20, width: 1, background: 'var(--border)' }} />

        {/* Group By */}
        <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} style={sel}>
          <option value="none">No Grouping</option>
          <option value="team">Group by Team</option>
          <option value="role">Group by Role</option>
        </select>

        {/* View toggle */}
        <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          <button onClick={() => setView('cards')} style={{ ...viewBtn, background: view === 'cards' ? 'var(--accent)' : 'var(--bg)', color: view === 'cards' ? '#fff' : 'var(--tx-3)' }}>
            <Grid3X3 size={15} />
          </button>
          <button onClick={() => setView('table')} style={{ ...viewBtn, background: view === 'table' ? 'var(--accent)' : 'var(--bg)', color: view === 'table' ? '#fff' : 'var(--tx-3)' }}>
            <List size={15} />
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--tx-2)' }}>
          <div className="spinner-ring" style={{ margin: '0 auto 16px' }} />
          <p style={{ fontSize: 14 }}>Loading team…</p>
        </div>
      ) : error ? (
        <div style={{ padding: 20, background: 'rgba(201,42,62,.08)', borderRadius: 10, border: '1px solid rgba(201,42,62,.15)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <AlertCircle size={20} style={{ color: 'var(--red)', flexShrink: 0 }} />
          <div>
            <p style={{ color: 'var(--red)', fontWeight: 500, margin: 0 }}>{error}</p>
            <button onClick={fetchAll} style={{ ...btnSec, marginTop: 8, padding: '4px 12px', fontSize: 12 }}>
              <RefreshCw size={12} /> Retry
            </button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          hasMembers={members.length > 0}
          onAdd={() => setShowAddModal(true)}
          onClearFilters={() => { setSearch(''); setFilterRole('all'); setFilterType('all'); setFilterTeam('all'); setFilterStatus('active'); }}
        />
      ) : (
        <div>
          {grouped.map(group => (
            <div key={group.key} style={{ marginBottom: group.label ? 20 : 0 }}>
              {group.label && (
                <button
                  onClick={() => toggleGroup(group.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                    padding: '8px 0', background: 'none', border: 'none', cursor: 'pointer',
                    marginBottom: 10,
                  }}
                >
                  {collapsedGroups[group.key] ? <ChevronRight size={16} style={{ color: 'var(--tx-3)' }} /> : <ChevronDown size={16} style={{ color: 'var(--tx-3)' }} />}
                  {group.color && <div style={{ width: 10, height: 10, borderRadius: '50%', background: group.color, flexShrink: 0 }} />}
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx-1)' }}>{group.label}</span>
                  <span style={{ fontSize: 12, color: 'var(--tx-3)', fontWeight: 400 }}>({group.members.length})</span>
                </button>
              )}
              {!collapsedGroups[group.key] && (
                view === 'cards' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                    {group.members.map(m => (
                      <MemberCard
                        key={m.id}
                        member={m}
                        teams={teams}
                        onClick={() => navigate(`/team/${m.id}`)}
                        onEdit={() => setEditMember(m)}
                        onRemove={() => handleRemove(m)}
                        onRestore={() => handleRestore(m)}
                        onResetPassword={handleResetPassword}
                        onDelete={handleDeleteMember}
                      />
                    ))}
                  </div>
                ) : (
                  <MemberTable
                    members={group.members}
                    teams={teams}
                    onView={(m) => navigate(`/team/${m.id}`)}
                    onEdit={setEditMember}
                    onRemove={handleRemove}
                    onRestore={handleRestore}
                    onResetPassword={handleResetPassword}
                    onDelete={handleDeleteMember}
                  />
                )
              )}
            </div>
          ))}

          {/* ── Capacity Heatmap ── */}
          <CapacitySummary members={filtered} />
        </div>
      )}

      {/* ── Modals ── */}
      {showAddModal && (
        <AddMemberModal
          teams={teams}
          specialties={specialties}
          onClose={() => setShowAddModal(false)}
          onCreated={fetchAll}
        />
      )}
      {editMember && (
        <EditMemberModal
          member={editMember}
          teams={teams}
          specialties={specialties}
          onClose={() => setEditMember(null)}
          onUpdated={fetchAll}
        />
      )}
      {viewMember && (
        <MemberDetailPanel
          member={viewMember}
          teams={teams}
          onClose={() => setViewMember(null)}
          onEdit={(m) => { setViewMember(null); setEditMember(m); }}
          onResetPassword={handleResetPassword}
          onDelete={(m) => { setViewMember(null); handleDeleteMember(m); }}
        />
      )}
      {showTeamModal && (
        <ManageTeamsModal
          teams={teams}
          members={members}
          onClose={() => setShowTeamModal(false)}
          onUpdated={fetchAll}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MEMBER CARD (grid view)
   ═══════════════════════════════════════════════════════════ */
function MemberCard({ member, teams, onClick, onEdit, onRemove, onRestore, onResetPassword, onDelete }) {
  const m = member;
  const team = teams.find(t => t.id === m.team_id);
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12,
        padding: '18px', cursor: 'pointer', transition: 'all 0.15s',
        opacity: m.active ? 1 : 0.6,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none'; }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div style={{
          width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
          background: avatarBg(m.id), display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 700, fontSize: 16,
        }}>
          {initials(m.name)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--tx-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {m.name}
            </span>
            {!m.active && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(201,42,62,.12)', color: 'var(--red)', fontWeight: 600 }}>Inactive</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            {ROLE_ICONS[m.role] || null}
            <span style={{ fontSize: 12, color: 'var(--tx-2)' }}>{m.role}</span>
            {team && (
              <>
                <span style={{ color: 'var(--tx-3)' }}>·</span>
                <span style={{ fontSize: 11, color: team.color || 'var(--tx-3)' }}>{team.name}</span>
              </>
            )}
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            style={iconBtn}
          >
            <MoreHorizontal size={16} />
          </button>
          {showMenu && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 50 }} onClick={(e) => { e.stopPropagation(); setShowMenu(false); }} />
              <div style={{
                position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 51,
                background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8,
                boxShadow: '0 8px 24px rgba(0,0,0,.3)', minWidth: 160, padding: '4px 0',
              }}>
                <DropItem icon={<Eye size={14} />} label="View Profile" onClick={() => { setShowMenu(false); onClick(); }} />
                <DropItem icon={<Edit2 size={14} />} label="Edit" onClick={() => { setShowMenu(false); onEdit(); }} />
                <DropItem icon={<Mail size={14} />} label="Send Reset Email" onClick={() => { setShowMenu(false); onResetPassword(m, 'email'); }} />
                <DropItem icon={<Shield size={14} />} label="Set Password" onClick={() => { setShowMenu(false); onResetPassword(m, 'set'); }} />
                {m.active ? (
                  <DropItem icon={<UserX size={14} />} label="Deactivate" danger onClick={() => { setShowMenu(false); onRemove(); }} />
                ) : (
                  <DropItem icon={<UserCheck size={14} />} label="Restore" onClick={() => { setShowMenu(false); onRestore(); }} />
                )}
                <DropItem icon={<Trash2 size={14} />} label="Delete Permanently" danger onClick={() => { setShowMenu(false); onDelete(m); }} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Specialties */}
      {m.specialty.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
          {m.specialty.slice(0, 3).map((s, i) => (
            <span key={i} style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 4,
              background: 'var(--bg)', color: 'var(--tx-2)', border: '1px solid var(--border)',
            }}>{s}</span>
          ))}
          {m.specialty.length > 3 && (
            <span style={{ fontSize: 11, color: 'var(--tx-3)', padding: '2px 4px' }}>+{m.specialty.length - 3}</span>
          )}
        </div>
      )}

      {/* Workload bar */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>{m.tasksThisWeek} / {m.maxTasks} tasks this week</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: capColor(m.utilization) }}>{capLabel(m.utilization)}</span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: 'var(--bg)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 3,
            width: `${Math.min(m.utilization, 100)}%`,
            background: capColor(m.utilization),
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {[
          { icon: <CheckSquare size={13} />, value: m.tasksCompletedMonth, label: 'Done/mo' },
          { icon: <FolderKanban size={13} />, value: m.openTasks, label: 'Open' },
          { icon: <Activity size={13} />, value: `${m.utilization}%`, label: 'Capacity' },
        ].map(s => (
          <div key={s.label} style={{
            textAlign: 'center', padding: '8px 4px', borderRadius: 6, background: 'var(--bg)',
          }}>
            <div style={{ color: 'var(--tx-3)', marginBottom: 2 }}>{s.icon}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--tx-1)' }}>{s.value}</div>
            <div style={{ fontSize: 10, color: 'var(--tx-3)' }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MEMBER TABLE (list view)
   ═══════════════════════════════════════════════════════════ */
function MemberTable({ members, teams, onView, onEdit, onRemove, onRestore, onResetPassword, onDelete }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
            <th style={th}>Member</th>
            <th style={{ ...th, width: 120 }}>Role</th>
            <th style={{ ...th, width: 120 }}>Team</th>
            <th style={{ ...th, width: 90 }}>Tasks/wk</th>
            <th style={{ ...th, width: 110 }}>Capacity</th>
            <th style={{ ...th, width: 90 }}>Done/mo</th>
            <th style={{ ...th, width: 80 }}>Status</th>
            <th style={{ ...th, width: 50 }}></th>
          </tr>
        </thead>
        <tbody>
          {members.map(m => {
            const team = teams.find(t => t.id === m.team_id);
            return (
              <tr
                key={m.id}
                onClick={() => onView(m)}
                style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', opacity: m.active ? 1 : 0.5 }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <td style={td}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                      background: avatarBg(m.id), display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontWeight: 600, fontSize: 12,
                    }}>{initials(m.name)}</div>
                    <div>
                      <div style={{ fontWeight: 500, color: 'var(--tx-1)', fontSize: 13 }}>{m.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--tx-3)' }}>{m.email}</div>
                    </div>
                  </div>
                </td>
                <td style={td}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {ROLE_ICONS[m.role]} <span style={{ fontSize: 12 }}>{m.role}</span>
                  </div>
                </td>
                <td style={td}>
                  {team ? (
                    <span style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: team.color }} />
                      {team.name}
                    </span>
                  ) : <span style={{ fontSize: 12, color: 'var(--tx-3)' }}>—</span>}
                </td>
                <td style={{ ...td, textAlign: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{m.tasksThisWeek}</span>
                  <span style={{ fontSize: 11, color: 'var(--tx-3)' }}> / {m.maxTasks}</span>
                </td>
                <td style={td}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'var(--bg)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 3, width: `${Math.min(m.utilization, 100)}%`, background: capColor(m.utilization) }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: capColor(m.utilization), minWidth: 28, textAlign: 'right' }}>{m.utilization}%</span>
                  </div>
                </td>
                <td style={{ ...td, textAlign: 'center', fontSize: 13, fontWeight: 500 }}>{m.tasksCompletedMonth}</td>
                <td style={td}>
                  <span style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 500,
                    background: m.active ? 'rgba(5,150,105,.1)' : 'rgba(201,42,62,.1)',
                    color: m.active ? 'var(--green)' : 'var(--red)',
                  }}>
                    {m.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={td}>
                  <button onClick={(e) => { e.stopPropagation(); onEdit(m); }} style={iconBtn} title="Edit">
                    <Edit2 size={14} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   CAPACITY SUMMARY
   ═══════════════════════════════════════════════════════════ */
function CapacitySummary({ members }) {
  const active = members.filter(m => m.active);
  if (active.length === 0) return null;
  const buckets = [
    { label: 'Available', color: 'var(--green)', count: active.filter(m => m.utilization < 50).length },
    { label: 'Busy', color: 'var(--yellow)', count: active.filter(m => m.utilization >= 50 && m.utilization < 80).length },
    { label: 'At Capacity', color: 'var(--red)', count: active.filter(m => m.utilization >= 80).length },
  ];
  const total = active.length;

  return (
    <div style={{
      marginTop: 20, padding: '16px 20px', background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 10, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
    }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-1)' }}>Capacity Overview</span>
      {/* Bar */}
      <div style={{ flex: 1, minWidth: 200, height: 10, borderRadius: 5, background: 'var(--bg)', overflow: 'hidden', display: 'flex' }}>
        {buckets.map(b => b.count > 0 && (
          <div key={b.label} style={{ width: `${(b.count / total) * 100}%`, height: '100%', background: b.color, transition: 'width 0.3s' }} />
        ))}
      </div>
      {/* Legend */}
      <div style={{ display: 'flex', gap: 16 }}>
        {buckets.map(b => (
          <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--tx-2)' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: b.color }} />
            <strong>{b.count}</strong> {b.label}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   EMPTY STATE
   ═══════════════════════════════════════════════════════════ */
function EmptyState({ hasMembers, onAdd, onClearFilters }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--tx-3)' }}>
      <Users size={48} style={{ marginBottom: 12, opacity: 0.3 }} />
      {hasMembers ? (
        <>
          <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--tx-2)', marginBottom: 4 }}>No members match your filters</p>
          <p style={{ fontSize: 13, marginBottom: 16 }}>Try adjusting your search or filter criteria</p>
          <button onClick={onClearFilters} style={btnSec}>Clear Filters</button>
        </>
      ) : (
        <>
          <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--tx-2)', marginBottom: 4 }}>No team members yet</p>
          <p style={{ fontSize: 13, marginBottom: 16 }}>Add your first team member to start managing your team</p>
          <button onClick={onAdd} style={btnPri}><UserPlus size={15} /> Add Your First Member</button>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ADD MEMBER MODAL
   ═══════════════════════════════════════════════════════════ */
function AddMemberModal({ teams, specialties, onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '', email: '', password: '', role: 'Operator',
    account_type: 'Internal Staff', team_id: '', specialty_ids: [],
    send_email: true,
  });
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(null); // { email, password, loginUrl }
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return toast.error('Name and email required');
    if (!form.password || form.password.length < 6) return toast.error('Password must be at least 6 characters');
    setSaving(true);
    try {
      const payload = {
        ...form,
        team_id: form.team_id || undefined,
        force_password_change: true,
        force_otp_setup: false,
        send_welcome_email: form.send_email,
      };
      await ax().post(`${API}/users`, payload);
      toast.success(`${form.name} added`);
      onCreated();
      // Show credentials so admin can share manually
      setCreated({
        name: form.name,
        email: form.email,
        password: form.password,
        loginUrl: window.location.origin + '/login',
      });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add member');
    } finally { setSaving(false); }
  };

  if (created) {
    return (
      <Modal onClose={onClose} title="Member Created" icon={<CheckSquare size={18} />}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#22c55e18', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <CheckSquare size={24} style={{ color: '#22c55e' }} />
          </div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--tx-1)' }}>{created.name} has been added</h3>
          <p style={{ fontSize: 12, color: 'var(--tx-3)', margin: '4px 0 0' }}>Share these login details with them:</p>
        </div>

        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 14, marginBottom: 16, fontFamily: 'monospace', fontSize: 12, lineHeight: 1.8, color: 'var(--tx-1)' }}>
          <div><strong>Login:</strong> {created.loginUrl}</div>
          <div><strong>Email:</strong> {created.email}</div>
          <div><strong>Password:</strong> {created.password}</div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => {
            navigator.clipboard?.writeText(`Login: ${created.loginUrl}\nEmail: ${created.email}\nPassword: ${created.password}`);
            toast.success('Copied to clipboard');
          }} style={{ ...btnSec, flex: 1, justifyContent: 'center' }}>
            Copy Details
          </button>
          <button onClick={onClose} style={{ ...btnPri, flex: 1, justifyContent: 'center' }}>
            Done
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} title="Add Team Member" icon={<UserPlus size={18} />}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Full Name *">
          <input autoFocus style={inp} placeholder="e.g. Taryn Pessanha" value={form.name} onChange={e => set('name', e.target.value)} />
        </Field>
        <Field label="Email *">
          <input style={inp} type="email" placeholder="taryn@company.com" value={form.email} onChange={e => set('email', e.target.value)} />
        </Field>
        <Field label="Temporary Password *">
          <input style={inp} type="password" placeholder="Min 6 characters" value={form.password} onChange={e => set('password', e.target.value)} />
          <p style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 4 }}>They'll change this on first login</p>
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Role">
            <select style={inp} value={form.role} onChange={e => set('role', e.target.value)}>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Account Type">
            <select style={inp} value={form.account_type} onChange={e => set('account_type', e.target.value)}>
              {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Team">
          <select style={inp} value={form.team_id} onChange={e => set('team_id', e.target.value)}>
            <option value="">No Team</option>
            {teams.filter(t => t.active !== false).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
        {specialties.length > 0 && (
          <Field label="Specialties">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {specialties.map(s => {
                const id = s.id || s._id;
                const selected = form.specialty_ids.includes(id);
                return (
                  <button key={id} type="button" onClick={() => {
                    set('specialty_ids', selected ? form.specialty_ids.filter(x => x !== id) : [...form.specialty_ids, id]);
                  }} style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 12, border: '1px solid var(--border)',
                    background: selected ? 'var(--accent)' : 'var(--bg)', color: selected ? '#fff' : 'var(--tx-2)',
                    cursor: 'pointer', transition: 'all .15s',
                  }}>
                    {s.name}
                  </button>
                );
              })}
            </div>
          </Field>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
          <input type="checkbox" id="send-email" checked={form.send_email} onChange={e => set('send_email', e.target.checked)}
            style={{ width: 15, height: 15, accentColor: 'var(--accent)' }} />
          <label htmlFor="send-email" style={{ fontSize: 12, color: 'var(--tx-2)' }}>Send welcome email with login details</label>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8 }}>
          <button type="button" onClick={onClose} style={btnSec}>Cancel</button>
          <button type="submit" style={btnPri} disabled={saving}>{saving ? 'Adding…' : 'Add Member'}</button>
        </div>
      </form>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════
   EDIT MEMBER MODAL
   ═══════════════════════════════════════════════════════════ */
function EditMemberModal({ member, teams, specialties, onClose, onUpdated }) {
  const [form, setForm] = useState({
    name: member.name,
    email: member.email || '',
    role: member.role,
    account_type: member.account_type || 'Internal Staff',
    team_id: member.team_id || '',
    specialty_ids: member.specialty_ids || [],
    active: member.active !== false,
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, team_id: form.team_id || null };
      await ax().patch(`${API}/users/${member.id}`, payload);
      toast.success(`${form.name} updated`);
      onUpdated();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update');
    } finally { setSaving(false); }
  };

  return (
    <Modal onClose={onClose} title="Edit Member" icon={<Edit2 size={18} />}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Name">
          <input style={inp} value={form.name} onChange={e => set('name', e.target.value)} />
        </Field>
        <Field label="Email">
          <input style={inp} type="email" value={form.email} onChange={e => set('email', e.target.value)} />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Role">
            <select style={inp} value={form.role} onChange={e => set('role', e.target.value)}>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Account Type">
            <select style={inp} value={form.account_type} onChange={e => set('account_type', e.target.value)}>
              {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Team">
          <select style={inp} value={form.team_id} onChange={e => set('team_id', e.target.value)}>
            <option value="">No Team</option>
            {teams.filter(t => t.active !== false).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
        {specialties.length > 0 && (
          <Field label="Specialties">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {specialties.map(s => {
                const id = s.id || s._id;
                const selected = form.specialty_ids.includes(id);
                return (
                  <button key={id} type="button" onClick={() => {
                    set('specialty_ids', selected ? form.specialty_ids.filter(x => x !== id) : [...form.specialty_ids, id]);
                  }} style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 12, border: '1px solid var(--border)',
                    background: selected ? 'var(--accent)' : 'var(--bg)', color: selected ? '#fff' : 'var(--tx-2)',
                    cursor: 'pointer', transition: 'all .15s',
                  }}>
                    {s.name}
                  </button>
                );
              })}
            </div>
          </Field>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
          <input type="checkbox" id="edit-active" checked={form.active} onChange={e => set('active', e.target.checked)}
            style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
          <label htmlFor="edit-active" style={{ fontSize: 13, color: 'var(--tx-1)' }}>Active account</label>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8 }}>
          <button type="button" onClick={onClose} style={btnSec}>Cancel</button>
          <button type="submit" style={btnPri} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
        </div>
      </form>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════
   MEMBER DETAIL PANEL (slide-in)
   ═══════════════════════════════════════════════════════════ */
function MemberDetailPanel({ member, teams, onClose, onEdit, onResetPassword, onDelete }) {
  const m = member;
  const team = teams.find(t => t.id === m.team_id);

  const STATUS_COLORS = {
    open: 'var(--blue)', todo: 'var(--blue)', assigned: 'var(--blue)',
    doing: 'var(--yellow)', review: 'var(--purple)', revision: 'var(--yellow)',
    done: 'var(--green)', completed: 'var(--green)', delivered: 'var(--green)',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100 }} onClick={onClose}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.4)', backdropFilter: 'blur(2px)' }} />
      <div onClick={e => e.stopPropagation()} style={{
        position: 'absolute', right: 0, top: 0, bottom: 0, width: 420, maxWidth: '90vw',
        background: 'var(--card)', borderLeft: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', overflow: 'auto',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--tx-1)' }}>Member Profile</span>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>

        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
          {/* Avatar + Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
              background: avatarBg(m.id), display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 700, fontSize: 20,
            }}>{initials(m.name)}</div>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, color: 'var(--tx-1)' }}>{m.name}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                {ROLE_ICONS[m.role]} <span style={{ fontSize: 13, color: 'var(--tx-2)' }}>{m.role}</span>
                {team && (
                  <>
                    <span style={{ color: 'var(--tx-3)' }}>·</span>
                    <span style={{ fontSize: 12, color: team.color }}>{team.name}</span>
                  </>
                )}
              </div>
              {m.email && (
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--tx-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Mail size={11} /> {m.email}
                </p>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 20 }}>
            {[
              { icon: <CheckSquare size={14} />, value: m.tasksCompletedMonth, label: 'Done/mo', color: 'var(--green)' },
              { icon: <FolderKanban size={14} />, value: m.openTasks, label: 'Open Tasks', color: 'var(--blue)' },
              { icon: <Activity size={14} />, value: `${m.utilization}%`, label: 'Capacity', color: capColor(m.utilization) },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center', padding: '12px 8px', borderRadius: 8, background: 'var(--bg)' }}>
                <div style={{ color: s.color, marginBottom: 4 }}>{s.icon}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--tx-1)' }}>{s.value}</div>
                <div style={{ fontSize: 10, color: 'var(--tx-3)', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Workload Bar */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--tx-2)' }}>Weekly Workload</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: capColor(m.utilization) }}>{m.tasksThisWeek} / {m.maxTasks}</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: 'var(--bg)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 4,
                width: `${Math.min(m.utilization, 100)}%`,
                background: capColor(m.utilization),
              }} />
            </div>
          </div>

          {/* Details */}
          <div style={{ marginBottom: 20 }}>
            <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Details</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {[
                { label: 'Account Type', value: m.account_type || '—' },
                { label: 'Status', value: m.active ? 'Active' : 'Inactive', color: m.active ? 'var(--green)' : 'var(--red)' },
                { label: 'Team', value: team?.name || 'Unassigned' },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 13, color: 'var(--tx-3)' }}>{row.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: row.color || 'var(--tx-1)' }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Specialties */}
          {m.specialty.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Specialties</h4>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {m.specialty.map((s, i) => (
                  <span key={i} style={{
                    fontSize: 12, padding: '4px 10px', borderRadius: 6,
                    background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--tx-1)',
                  }}>{s}</span>
                ))}
              </div>
            </div>
          )}

          {/* Recent Tasks */}
          {m.recentTasks?.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Recent Tasks</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {m.recentTasks.map((t, i) => (
                  <div key={i} style={{
                    padding: '8px 10px', borderRadius: 6, background: 'var(--bg)',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                      background: STATUS_COLORS[t.status?.toLowerCase()] || 'var(--tx-3)',
                    }} />
                    <span style={{ fontSize: 12, color: 'var(--tx-1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.title}
                    </span>
                    <span style={{
                      fontSize: 10, padding: '1px 6px', borderRadius: 3,
                      background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--tx-2)',
                    }}>{t.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={() => onEdit(m)} style={{ ...btnPri, width: '100%', justifyContent: 'center' }}>
              <Edit2 size={14} /> Edit Member
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => onResetPassword(m, 'set')} style={{ ...btnSec, flex: 1, justifyContent: 'center', fontSize: 12 }}>
                <Shield size={12} /> Set Password
              </button>
              <button onClick={() => onResetPassword(m, 'email')} style={{ ...btnSec, flex: 1, justifyContent: 'center', fontSize: 12 }}>
                <Mail size={12} /> Reset Email
              </button>
            </div>
            <button onClick={() => onDelete(m)} style={{ ...btnSec, width: '100%', justifyContent: 'center', color: '#ef4444', borderColor: '#ef444440' }}>
              <Trash2 size={13} /> Delete Permanently
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MANAGE TEAMS MODAL
   ═══════════════════════════════════════════════════════════ */
function ManageTeamsModal({ teams, members, onClose, onUpdated }) {
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#6366f1');
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');

  const createTeam = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await ax().post(`${API}/teams`, { name: newName.trim(), color: newColor });
      toast.success(`Team "${newName}" created`);
      setNewName('');
      onUpdated();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create team');
    } finally { setSaving(false); }
  };

  const updateTeam = async (id) => {
    if (!editName.trim()) return;
    try {
      await ax().patch(`${API}/teams/${id}`, { name: editName.trim() });
      toast.success('Team updated');
      setEditId(null);
      onUpdated();
    } catch { toast.error('Failed to update'); }
  };

  const deleteTeam = async (id, name) => {
    if (!window.confirm(`Delete team "${name}"? Members will be unassigned.`)) return;
    try {
      await ax().delete(`${API}/teams/${id}`);
      toast.success(`Team "${name}" deleted`);
      onUpdated();
    } catch { toast.error('Failed to delete'); }
  };

  const COLORS = ['#c92a3e','#7c3aed','#2563eb','#059669','#d97706','#0891b2','#db2777','#65a30d','#6366f1','#f97316'];

  return (
    <Modal onClose={onClose} title="Manage Teams" icon={<Layers size={18} />} wide>
      {/* Create new team */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>New Team Name</label>
          <input style={inp} value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Design Team"
            onKeyDown={e => e.key === 'Enter' && createTeam()} />
        </div>
        <div>
          <label style={labelStyle}>Color</label>
          <div style={{ display: 'flex', gap: 4 }}>
            {COLORS.map(c => (
              <button key={c} onClick={() => setNewColor(c)} style={{
                width: 24, height: 24, borderRadius: 6, background: c, border: newColor === c ? '2px solid #fff' : '2px solid transparent',
                cursor: 'pointer', boxShadow: newColor === c ? `0 0 0 2px ${c}` : 'none',
              }} />
            ))}
          </div>
        </div>
        <button onClick={createTeam} style={{ ...btnPri, whiteSpace: 'nowrap' }} disabled={saving}>
          <Plus size={14} /> Create
        </button>
      </div>

      {/* Existing teams */}
      {teams.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--tx-3)', padding: 20, fontSize: 13 }}>No teams yet. Create one above.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {teams.map(t => {
            const count = members.filter(m => m.team_id === t.id && m.active).length;
            const isEditing = editId === t.id;
            return (
              <div key={t.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)',
              }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
                {isEditing ? (
                  <input autoFocus style={{ ...inp, flex: 1 }} value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') updateTeam(t.id); if (e.key === 'Escape') setEditId(null); }}
                    onBlur={() => updateTeam(t.id)}
                  />
                ) : (
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--tx-1)', flex: 1 }}>{t.name}</span>
                )}
                <span style={{ fontSize: 12, color: 'var(--tx-3)' }}>{count} member{count !== 1 ? 's' : ''}</span>
                <button onClick={() => { setEditId(t.id); setEditName(t.name); }} style={iconBtn}><Edit2 size={13} /></button>
                <button onClick={() => deleteTeam(t.id, t.name)} style={{ ...iconBtn, color: 'var(--red)' }}><Trash2 size={13} /></button>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════
   ADMIN TEAM HUB — AGENCY CAPACITY CONSOLE
   ═══════════════════════════════════════════════════════════ */
function AdminTeamHub() {
  const navigate = useNavigate();
  const [members, setMembers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState('workload'); // 'workload', 'name'
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [editMember, setEditMember] = useState(null);

  /* ── Data loading ── */
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, teamsRes, ordersRes, specsRes] = await Promise.allSettled([
        ax().get(`${API}/users`),
        ax().get(`${API}/teams`),
        ax().get(`${API}/orders`),
        ax().get(`${API}/specialties`),
      ]);

      let users = [];
      if (usersRes.status === 'fulfilled') {
        users = usersRes.value.data?.data || usersRes.value.data || [];
        if (!Array.isArray(users)) users = [];
      }

      let teamList = [];
      if (teamsRes.status === 'fulfilled') {
        teamList = teamsRes.value.data || [];
        if (!Array.isArray(teamList)) teamList = [];
      }

      let orderList = [];
      if (ordersRes.status === 'fulfilled') {
        orderList = ordersRes.value.data?.data || ordersRes.value.data || [];
        if (!Array.isArray(orderList)) orderList = [];
      }

      let specList = [];
      if (specsRes.status === 'fulfilled') {
        specList = specsRes.value.data?.data || specsRes.value.data || [];
        if (!Array.isArray(specList)) specList = [];
      }

      setMembers(users);
      setTeams(teamList);
      setOrders(orderList);
      setSpecialties(specList);
    } catch (err) {
      console.error('Failed to fetch admin data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ── Compute stats ── */
  const memberStats = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);

    const stats = {};
    members.forEach(m => {
      if (m.account_type === 'Media Client') return; // Exclude Media Client

      const memberOrders = orders.filter(o => o.editor_id === m.id);
      const openOrders = memberOrders.filter(o => !['Closed', 'Canceled', 'Delivered'].includes(o.status));
      const completedWeek = memberOrders.filter(o => {
        const closed = new Date(o.picked_at || o.created_at || 0);
        return ['Closed', 'Delivered'].includes(o.status) && closed >= weekAgo;
      });
      const slaIssues = memberOrders.filter(o => o.is_sla_breached).length;

      const clients = [...new Set(openOrders.map(o => o.requester_name).filter(Boolean))];
      const maxTasks = m.maxTasks || m.max_tasks || 10;
      const workloadPct = pct(openOrders.length, maxTasks);

      stats[m.id] = {
        openOrders: openOrders.length,
        completedWeek: completedWeek.length,
        slaIssues,
        clients: clients.slice(0, 3),
        workloadPct,
        maxTasks,
      };
    });
    return stats;
  }, [members, orders]);

  /* ── KPI metrics ── */
  const kpis = useMemo(() => {
    const activeMembers = members.filter(m => m.active && m.account_type !== 'Media Client').length;
    const unassignedOrders = orders.filter(o => !o.editor_id && o.status === 'Open').length;
    const totalOpen = orders.filter(o => !['Closed', 'Canceled', 'Delivered'].includes(o.status)).length;
    const avgWorkload = activeMembers > 0 ? Math.round(totalOpen / activeMembers) : 0;
    const atCapacity = Object.values(memberStats).filter(s => s.workloadPct >= 80).length;
    const slaBreached = orders.filter(o => o.is_sla_breached).length;

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    const completedWeek = orders.filter(o => {
      const closed = new Date(o.picked_at || o.created_at || 0);
      return ['Closed', 'Delivered'].includes(o.status) && closed >= weekAgo;
    }).length;

    return { activeMembers, unassignedOrders, totalOpen, avgWorkload, atCapacity, slaBreached, completedWeek };
  }, [members, orders, memberStats]);

  /* ── Sorted members ── */
  const sortedMembers = useMemo(() => {
    const filtered = members.filter(m => m.active && m.account_type !== 'Media Client');
    return filtered.sort((a, b) => {
      if (sortBy === 'workload') {
        return (memberStats[b.id]?.workloadPct || 0) - (memberStats[a.id]?.workloadPct || 0);
      }
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [members, sortBy, memberStats]);

  /* ── Team breakdown ── */
  const teamBreakdown = useMemo(() => {
    return teams.filter(t => t.active).map(t => {
      const teamMembers = members.filter(m => m.team_id === t.id && m.active);
      const teamOrders = orders.filter(o => teamMembers.some(m => m.id === o.editor_id));
      const openOrders = teamOrders.filter(o => !['Closed', 'Canceled', 'Delivered'].includes(o.status));

      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 86400000);
      const completed = teamOrders.filter(o => {
        const closed = new Date(o.picked_at || o.created_at || 0);
        return ['Closed', 'Delivered'].includes(o.status) && closed >= weekAgo;
      }).length;

      const avgWorkloadPct = teamMembers.length > 0
        ? Math.round(teamMembers.reduce((sum, m) => sum + (memberStats[m.id]?.workloadPct || 0), 0) / teamMembers.length)
        : 0;

      return {
        id: t.id,
        name: t.name,
        memberCount: teamMembers.length,
        openOrders: openOrders.length,
        completedWeek: completed,
        avgWorkloadPct,
      };
    });
  }, [teams, members, orders, memberStats]);

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx-2)' }}>Loading capacity data...</div>;
  }

  return (
    <div style={{ padding: 24, maxWidth: 'none' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <Users size={28} style={{ color: 'var(--accent)' }} />
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--tx-1)', margin: 0 }}>Team Capacity</h1>
        </div>
        <p style={{ fontSize: 14, color: 'var(--tx-2)', margin: '0 0 16px 0' }}>Agency workload overview & assignment intelligence</p>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => setShowAddModal(true)} style={btnPri}><UserPlus size={16} />Add Member</button>
          <button onClick={() => setShowTeamModal(true)} style={btnSec}><FolderKanban size={16} />Manage Teams</button>
        </div>
      </div>

      {/* KPI Strip */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 28,
      }}>
        <KpiCard label="Team Members" value={kpis.activeMembers} icon={<Users size={16} />} />
        <KpiCard label="Open Orders" value={kpis.totalOpen} icon={<CheckSquare size={16} />} />
        <KpiCard label="Avg Workload" value={kpis.avgWorkload} unit="orders/person" icon={<BarChart2 size={16} />} />
        <KpiCard label="At Capacity" value={kpis.atCapacity} color={kpis.atCapacity > 0 ? 'var(--red)' : 'var(--green)'} icon={<AlertCircle size={16} />} />
        <KpiCard label="SLA Breached" value={kpis.slaBreached} color={kpis.slaBreached > 0 ? 'var(--red)' : 'var(--green)'} icon={<Clock size={16} />} />
        <KpiCard label="Completed (7d)" value={kpis.completedWeek} icon={<CheckSquare size={16} />} />
      </div>

      {/* Unassigned Orders Banner */}
      {kpis.unassignedOrders > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: 16, background: 'rgba(217, 119, 6, .1)',
          border: '1px solid var(--yellow)', borderRadius: 10, marginBottom: 24,
        }}>
          <AlertCircle size={20} style={{ color: 'var(--yellow)' }} />
          <span style={{ fontSize: 14, color: 'var(--yellow)', flex: 1 }}>{kpis.unassignedOrders} orders are unassigned</span>
          <button onClick={() => navigate('/requests')} style={{ ...btnSec, fontSize: 12 }}>View in Requests</button>
        </div>
      )}

      {/* Workload Cards */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--tx-1)', margin: 0 }}>Team Workload</h2>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={sel}>
            <option value="workload">Busiest First</option>
            <option value="name">Alphabetical</option>
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {sortedMembers.map(m => {
            const stats = memberStats[m.id] || {};
            return (
              <div key={m.id} style={{
                background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: 16,
              }}>
                {/* Member header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%', background: avatarBg(m.id),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 600, color: '#fff',
                  }}>
                    {initials(m.name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-1)' }}>{m.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--tx-3)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      {ROLE_ICONS[m.role]} {m.role}
                    </div>
                  </div>
                </div>

                {/* Workload bar */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--tx-2)', marginBottom: 6 }}>
                    <span>Workload</span>
                    <span>{stats.openOrders}/{stats.maxTasks}</span>
                  </div>
                  <div style={{
                    width: '100%', height: 8, background: 'var(--bg)', borderRadius: 4, overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${Math.min(stats.workloadPct, 100)}%`, height: '100%',
                      background: capColor(stats.workloadPct), transition: 'width .2s',
                    }} />
                  </div>
                </div>

                {/* Stats row */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 12, marginBottom: 12,
                  paddingBottom: 12, borderBottom: '1px solid var(--border)',
                }}>
                  <div>
                    <div style={{ color: 'var(--tx-3)', fontSize: 10 }}>Open</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx-1)' }}>{stats.openOrders}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--tx-3)', fontSize: 10 }}>Completed (7d)</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx-1)' }}>{stats.completedWeek}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--tx-3)', fontSize: 10 }}>SLA Issues</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: stats.slaIssues > 0 ? 'var(--red)' : 'var(--tx-1)' }}>{stats.slaIssues}</div>
                  </div>
                </div>

                {/* Client chips */}
                {stats.clients && stats.clients.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                    {stats.clients.map(c => (
                      <span key={c} style={{
                        fontSize: 11, padding: '4px 8px', background: 'var(--bg)', color: 'var(--tx-2)',
                        borderRadius: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {c}
                      </span>
                    ))}
                    {(memberStats[m.id]?.clients?.length || 0) > 3 && (
                      <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>+{(memberStats[m.id]?.clients?.length || 0) - 3}</span>
                    )}
                  </div>
                )}

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setEditMember(m)} style={{ ...btnSec, flex: 1, justifyContent: 'center' }}>
                    <Edit2 size={14} />Edit
                  </button>
                  <button onClick={() => navigate(`/team/${m.id}`)} style={{ ...btnSec, flex: 1, justifyContent: 'center' }}>
                    <Eye size={14} />View
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Team Breakdown */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--tx-1)', margin: '0 0 14px 0' }}>Team Breakdown</h2>
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                <th style={th}>Team</th>
                <th style={th}>Members</th>
                <th style={th}>Open Orders</th>
                <th style={th}>Completed (7d)</th>
                <th style={th}>Avg Workload</th>
              </tr>
            </thead>
            <tbody>
              {teamBreakdown.map(t => (
                <tr key={t.id} style={{ borderBottom: '1px solid var(--border)', '&:last-child': { borderBottom: 'none' } }}>
                  <td style={td}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: avatarBg(t.id), marginRight: 8 }} />{t.name}</td>
                  <td style={td}>{t.memberCount}</td>
                  <td style={td}>{t.openOrders}</td>
                  <td style={td}>{t.completedWeek}</td>
                  <td style={td}>
                    <span style={{ color: capColor(t.avgWorkloadPct) }}>{t.avgWorkloadPct}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {showAddModal && <AddMemberModal teams={teams} specialties={specialties} onClose={() => setShowAddModal(false)} onCreated={fetchAll} />}
      {showTeamModal && <ManageTeamsModal teams={teams} members={members} onClose={() => setShowTeamModal(false)} onUpdated={fetchAll} />}
      {editMember && <EditMemberModal member={editMember} teams={teams} specialties={specialties} onClose={() => setEditMember(null)} onUpdated={fetchAll} />}
    </div>
  );
}

/* ── KPI Card ── */
function KpiCard({ label, value, unit, icon, color }) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: color || 'var(--accent)' }}>
        {icon}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--tx-1)', marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--tx-3)' }}>{label}</div>
      {unit && <div style={{ fontSize: 10, color: 'var(--tx-3)', marginTop: 4 }}>{unit}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SHARED UI COMPONENTS
   ═══════════════════════════════════════════════════════════ */
function Modal({ children, onClose, title, icon, wide }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div
        style={{
          background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14,
          padding: 0, width: wide ? 560 : 440, maxWidth: '92vw', maxHeight: '85vh',
          boxShadow: '0 12px 40px rgba(0,0,0,.4)', display: 'flex', flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 600, color: 'var(--tx-1)' }}>
            {icon} {title}
          </div>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>
        <div style={{ padding: '16px 20px', overflowY: 'auto' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function DropItem({ icon, label, onClick, danger }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 14px',
      background: 'none', border: 'none', cursor: 'pointer', fontSize: 13,
      color: danger ? 'var(--red)' : 'var(--tx-1)', textAlign: 'left',
    }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
      onMouseLeave={e => e.currentTarget.style.background = 'none'}
    >{icon} {label}</button>
  );
}

/* ═══════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════ */
const btnPri = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
  background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8,
  fontSize: 13, fontWeight: 600, cursor: 'pointer',
};
const btnSec = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
  background: 'var(--card)', color: 'var(--tx-1)', border: '1px solid var(--border)', borderRadius: 8,
  fontSize: 13, fontWeight: 500, cursor: 'pointer',
};
const inp = {
  width: '100%', padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)',
  borderRadius: 8, color: 'var(--tx-1)', fontSize: 13, outline: 'none',
  boxSizing: 'border-box',
};
const sel = {
  padding: '6px 10px', background: 'var(--bg)', border: '1px solid var(--border)',
  borderRadius: 6, color: 'var(--tx-1)', fontSize: 12, outline: 'none', cursor: 'pointer',
};
const viewBtn = {
  padding: '6px 10px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
};
const iconBtn = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6,
  background: 'none', border: 'none', cursor: 'pointer', borderRadius: 6,
  color: 'var(--tx-3)',
};
const th = {
  padding: '10px 12px', fontSize: 11, fontWeight: 600, color: 'var(--tx-3)',
  textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'left',
};
const td = {
  padding: '10px 12px', fontSize: 13, color: 'var(--tx-2)',
};
const labelStyle = {
  display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx-2)', marginBottom: 4,
};

/* ═══════════════════════════════════════════════════════════
   ROUTER WRAPPER — SELECT VIEW BASED ON ROLE
   ═══════════════════════════════════════════════════════════ */
export default function TeamPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Administrator' || user?.role === 'Admin';
  const isPreview = typeof window !== 'undefined' && localStorage.getItem('preview_as_client') === 'true';

  if (isAdmin && !isPreview) {
    return <AdminTeamHub />;
  }
  return <Team />;
}
