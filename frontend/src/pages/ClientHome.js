import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  ChevronRight,
  Phone,
  MessageSquare,
  FolderOpen,
  BookOpen,
  LifeBuoy,
  DollarSign,
  Upload,
  Star,
} from 'lucide-react';

const mockRequests = [
  {
    id: 'RRG-000001',
    service: 'Graphic Design',
    status: 'In Progress',
    date: '2026-03-15',
  },
  {
    id: 'RRG-000002',
    service: 'Video Editing',
    status: 'Delivered',
    date: '2026-03-10',
  },
  {
    id: 'RRG-000003',
    service: 'Social Media Pack',
    status: 'Submitted',
    date: '2026-03-18',
  },
  {
    id: 'RRG-000004',
    service: 'Email Sequence',
    status: 'Pending Review',
    date: '2026-03-19',
  },
  {
    id: 'RRG-000005',
    service: 'Meta Ads Setup',
    status: 'Closed',
    date: '2026-03-05',
  },
];

function ClientHome() {
  const { user } = useAuth();
  const [requests, setRequests] = useState(mockRequests);
  const [loading, setLoading] = useState(false);

  const firstName = user?.name?.split(' ')[0] || 'there';

  useEffect(() => {
    const fetchRequests = async () => {
      setLoading(true);
      try {
        const response = await axios.get('/api/orders/my-requests');
        setRequests(response.data);
      } catch (error) {
        console.error('Failed to fetch requests:', error);
        setRequests(mockRequests);
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();
  }, []);

  const getStatusPill = (status) => {
    const pillMap = {
      'In Progress': 'pill-blue',
      Delivered: 'pill-green',
      'Pending Review': 'pill-yellow',
      Submitted: 'pill-blue',
      Closed: 'pill-gray',
    };
    return pillMap[status] || 'pill-gray';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="page-content">
      {/* Header Section */}
      <div style={styles.headerSection}>
        <div>
          <h1 style={styles.greeting}>Welcome back, {firstName}</h1>
          <p style={styles.subtitle}>Here's what's happening with your account</p>
        </div>
      </div>

      {/* Metrics Grid */}
      <div style={styles.metricsGrid}>
        <div className="metric-card">
          <div style={{ ...styles.iconWrapper, backgroundColor: 'var(--blue)', opacity: 0.2 }}>
            <Clock size={20} style={{ color: 'var(--blue)' }} />
          </div>
          <div style={styles.metricContent}>
            <p style={styles.metricLabel}>Active Requests</p>
            <p className="metric-value">3</p>
          </div>
        </div>

        <div className="metric-card">
          <div style={{ ...styles.iconWrapper, backgroundColor: 'var(--yellow)', opacity: 0.2 }}>
            <AlertCircle size={20} style={{ color: 'var(--yellow)' }} />
          </div>
          <div style={styles.metricContent}>
            <p style={styles.metricLabel}>In Review</p>
            <p className="metric-value">1</p>
          </div>
        </div>

        <div className="metric-card">
          <div style={{ ...styles.iconWrapper, backgroundColor: 'var(--green)', opacity: 0.2 }}>
            <CheckCircle2 size={20} style={{ color: 'var(--green)' }} />
          </div>
          <div style={styles.metricContent}>
            <p style={styles.metricLabel}>Delivered This Month</p>
            <p className="metric-value">5</p>
          </div>
        </div>

        <div className="metric-card">
          <div style={{ ...styles.iconWrapper, backgroundColor: 'var(--purple)', opacity: 0.2 }}>
            <FileText size={20} style={{ color: 'var(--purple)' }} />
          </div>
          <div style={styles.metricContent}>
            <p style={styles.metricLabel}>Open Tasks</p>
            <p className="metric-value">2</p>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div style={styles.layoutContainer}>
        {/* Left Column */}
        <div style={styles.leftColumn}>
          {/* My Requests Card */}
          <div className="card" style={styles.cardContainer}>
            <div style={styles.cardHeader}>
              <h2 style={styles.cardTitle}>My Requests</h2>
            </div>

            <table className="data-table" style={styles.table}>
              <thead>
                <tr>
                  <th>Request ID</th>
                  <th>Service</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => (
                  <tr key={req.id}>
                    <td>
                      <span style={styles.requestId}>{req.id}</span>
                    </td>
                    <td>{req.service}</td>
                    <td>
                      <span className={`pill ${getStatusPill(req.status)}`}>
                        {req.status}
                      </span>
                    </td>
                    <td style={{ color: 'var(--tx-2)' }}>{formatDate(req.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={styles.cardFooter}>
              <a href="/requests" className="btn btn-ghost btn-sm" style={styles.viewAllBtn}>
                View All Requests
                <ChevronRight size={16} />
              </a>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div style={styles.rightColumn}>
          {/* Account Manager Card */}
          <div className="card" style={styles.cardContainer}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>Your Account Manager</h3>
            </div>
            <div style={styles.managerContent}>
              <div style={styles.managerAvatar}>JK</div>
              <div style={styles.managerInfo}>
                <p style={styles.managerName}>Jordan Kim</p>
                <p style={styles.managerRole}>Account Manager</p>
              </div>
            </div>
            <div style={styles.managerActions}>
              <button className="btn btn-primary btn-sm" style={styles.actionBtn}>
                <Phone size={16} />
                Schedule a Call
              </button>
              <button className="btn btn-ghost btn-sm" style={styles.actionBtn}>
                <MessageSquare size={16} />
                Send Message
              </button>
            </div>
          </div>

          {/* Quick Actions Card */}
          <div className="card" style={styles.cardContainer}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>Quick Actions</h3>
            </div>
            <div style={styles.quickActionsGrid}>
              <a href="/services" className="btn" style={styles.quickActionBtn}>
                <Plus size={18} />
                <span>New Request</span>
              </a>
              <button className="btn" style={styles.quickActionBtn}>
                <Upload size={18} />
                <span>Upload Files</span>
              </button>
              <button className="btn" style={styles.quickActionBtn}>
                <BookOpen size={18} />
                <span>View SOPs</span>
              </button>
              <button className="btn" style={styles.quickActionBtn}>
                <LifeBuoy size={18} />
                <span>Contact Support</span>
              </button>
            </div>
          </div>

          {/* Upcoming Renewals Card */}
          <div className="card" style={styles.cardContainer}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>Upcoming Renewals</h3>
            </div>
            <div style={styles.renewalsList}>
              <div style={styles.renewalItem}>
                <div style={styles.renewalIcon}>
                  <DollarSign size={16} />
                </div>
                <div style={styles.renewalInfo}>
                  <p style={styles.renewalLabel}>Monthly Service Plan</p>
                  <p style={styles.renewalDate}>Renews on Apr 15, 2026</p>
                </div>
              </div>
              <div style={styles.renewalItem}>
                <div style={styles.renewalIcon}>
                  <Star size={16} />
                </div>
                <div style={styles.renewalInfo}>
                  <p style={styles.renewalLabel}>Premium Support Add-on</p>
                  <p style={styles.renewalDate}>Renews on May 1, 2026</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div style={styles.ctaCard}>
        <div style={styles.ctaContent}>
          <h2 style={styles.ctaTitle}>Need something done?</h2>
          <p style={styles.ctaSubtitle}>
            Browse our services and submit a new request in minutes
          </p>
        </div>
        <a href="/services" className="btn btn-primary">
          Browse Services
          <ChevronRight size={18} />
        </a>
      </div>
    </div>
  );
}

const styles = {
  headerSection: {
    marginBottom: '32px',
  },
  greeting: {
    fontSize: '28px',
    fontWeight: '600',
    color: 'var(--tx-1)',
    margin: '0 0 8px 0',
  },
  subtitle: {
    fontSize: '14px',
    color: 'var(--tx-2)',
    margin: '0',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '16px',
    marginBottom: '32px',
  },
  iconWrapper: {
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '12px',
  },
  metricContent: {
    display: 'flex',
    flexDirection: 'column',
  },
  metricLabel: {
    fontSize: '12px',
    color: 'var(--tx-2)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    margin: '0 0 4px 0',
  },
  layoutContainer: {
    display: 'flex',
    gap: '24px',
    marginBottom: '32px',
  },
  leftColumn: {
    flex: 1,
  },
  rightColumn: {
    width: '300px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  cardContainer: {
    display: 'flex',
    flexDirection: 'column',
  },
  cardHeader: {
    paddingBottom: '12px',
    borderBottom: '1px solid var(--border)',
    marginBottom: '16px',
  },
  cardTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: 'var(--tx-1)',
    margin: '0',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    marginBottom: '16px',
  },
  requestId: {
    color: 'var(--red)',
    fontWeight: '600',
  },
  cardFooter: {
    paddingTop: '12px',
    borderTop: '1px solid var(--border)',
    display: 'flex',
  },
  viewAllBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  managerContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px',
  },
  managerAvatar: {
    width: '48px',
    height: '48px',
    borderRadius: '8px',
    backgroundColor: 'var(--green)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '600',
    color: 'var(--bg)',
    fontSize: '16px',
  },
  managerInfo: {
    display: 'flex',
    flexDirection: 'column',
  },
  managerName: {
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--tx-1)',
    margin: '0',
  },
  managerRole: {
    fontSize: '12px',
    color: 'var(--tx-2)',
    margin: '0',
  },
  managerActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  actionBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  quickActionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px',
  },
  quickActionBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '12px',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    cursor: 'pointer',
    color: 'var(--tx-2)',
    fontSize: '12px',
    transition: 'all 0.2s',
  },
  renewalsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  renewalItem: {
    display: 'flex',
    gap: '12px',
    padding: '12px',
    backgroundColor: 'var(--bg)',
    borderRadius: '8px',
  },
  renewalIcon: {
    width: '32px',
    height: '32px',
    borderRadius: '6px',
    backgroundColor: 'var(--bg-elevated)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--yellow)',
    flexShrink: 0,
  },
  renewalInfo: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
  },
  renewalLabel: {
    fontSize: '13px',
    fontWeight: '500',
    color: 'var(--tx-1)',
    margin: '0',
  },
  renewalDate: {
    fontSize: '12px',
    color: 'var(--tx-3)',
    margin: '0',
  },
  ctaCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '24px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #c92a3e22, #c92a3e08)',
    border: '1px solid var(--border)',
    marginTop: '16px',
  },
  ctaContent: {
    flex: 1,
  },
  ctaTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: 'var(--tx-1)',
    margin: '0 0 6px 0',
  },
  ctaSubtitle: {
    fontSize: '14px',
    color: 'var(--tx-2)',
    margin: '0',
  },
};

export default ClientHome;
