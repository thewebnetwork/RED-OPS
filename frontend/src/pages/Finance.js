import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  AlertCircle,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  BarChart2,
  RefreshCw,
} from 'lucide-react';
import {
  LineChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import axios from 'axios';
;

const Finance = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // Mock MRR data for 12 months
  const mrrChartData = [
    { month: 'Jan', value: 12400 },
    { month: 'Feb', value: 13100 },
    { month: 'Mar', value: 13800 },
    { month: 'Apr', value: 14200 },
    { month: 'May', value: 15100 },
    { month: 'Jun', value: 15800 },
    { month: 'Jul', value: 16400 },
    { month: 'Aug', value: 17100 },
    { month: 'Sep', value: 17800 },
    { month: 'Oct', value: 18100 },
    { month: 'Nov', value: 18200 },
    { month: 'Dec', value: 18400 },
  ];

  // Mock renewal data
  const renewalData = [
    {
      id: 1,
      client: 'TechStartup Inc',
      plan: 'Premium',
      mrr: 4200,
      renewalDate: '2026-04-05',
      daysUntil: 17,
      status: 'on-track',
    },
    {
      id: 2,
      client: 'Creative Agency Co',
      plan: 'Standard',
      mrr: 2800,
      renewalDate: '2026-04-12',
      daysUntil: 24,
      status: 'on-track',
    },
    {
      id: 3,
      client: 'E-Commerce Plus',
      plan: 'Premium',
      mrr: 3600,
      renewalDate: '2026-04-18',
      daysUntil: 30,
      status: 'at-risk',
    },
    {
      id: 4,
      client: 'Local Services',
      plan: 'Basic',
      mrr: 1200,
      renewalDate: '2026-03-28',
      daysUntil: 9,
      status: 'critical',
    },
    {
      id: 5,
      client: 'Growth Marketing',
      plan: 'Enterprise',
      mrr: 5200,
      renewalDate: '2026-05-02',
      daysUntil: 44,
      status: 'on-track',
    },
  ];

  // Mock revenue by service
  const revenueByService = [
    { name: 'Meta Ads', value: 8200 },
    { name: 'Content', value: 4800 },
    { name: 'Copywriting', value: 2600 },
    { name: 'Video', value: 1900 },
    { name: 'Strategy', value: 900 },
  ];

  // Mock client data
  const clientData = [
    {
      id: 1,
      name: 'TechStartup Inc',
      plan: 'Premium',
      mrr: 4200,
      requestsUsed: '112/150',
      deliveries: 8,
      lastDelivery: '2 days ago',
      health: 'good',
    },
    {
      id: 2,
      name: 'Creative Agency Co',
      plan: 'Standard',
      mrr: 2800,
      requestsUsed: '85/100',
      deliveries: 6,
      lastDelivery: '1 day ago',
      health: 'good',
    },
    {
      id: 3,
      name: 'E-Commerce Plus',
      plan: 'Premium',
      mrr: 3600,
      requestsUsed: '142/150',
      deliveries: 5,
      lastDelivery: '5 days ago',
      health: 'warn',
    },
    {
      id: 4,
      name: 'Local Services',
      plan: 'Basic',
      mrr: 1200,
      requestsUsed: '48/50',
      deliveries: 2,
      lastDelivery: '12 days ago',
      health: 'danger',
    },
    {
      id: 5,
      name: 'Growth Marketing',
      plan: 'Enterprise',
      mrr: 5200,
      requestsUsed: '187/200',
      deliveries: 12,
      lastDelivery: 'Today',
      health: 'good',
    },
    {
      id: 6,
      name: 'Design Studio Hub',
      plan: 'Standard',
      mrr: 2100,
      requestsUsed: '72/100',
      deliveries: 4,
      lastDelivery: '3 days ago',
      health: 'good',
    },
    {
      id: 7,
      name: 'Social Media Co',
      plan: 'Premium',
      mrr: 3400,
      requestsUsed: '131/150',
      deliveries: 7,
      lastDelivery: '1 day ago',
      health: 'good',
    },
    {
      id: 8,
      name: 'Brand Academy',
      plan: 'Standard',
      mrr: 1900,
      requestsUsed: '91/100',
      deliveries: 3,
      lastDelivery: '4 days ago',
      health: 'warn',
    },
  ];

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 1000);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'on-track':
        return '#22c55e';
      case 'at-risk':
        return '#f59e0b';
      case 'critical':
        return '#c92a3e';
      default:
        return '#606060';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'on-track':
        return 'On track';
      case 'at-risk':
        return 'At risk';
      case 'critical':
        return 'Critical';
      default:
        return status;
    }
  };

  return (
    <div className="page-content">
      {/* Header */}
      <div className="finance-header">
        <div>
          <h1>Financial Overview</h1>
          <p className="text-secondary">Retainer business health monitor</p>
        </div>
        <button className="btn-primary btn-sm" onClick={handleRefresh} disabled={loading}>
          <RefreshCw size={16} style={{ marginRight: '6px' }} />
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Top Metrics Row */}
      <div className="metrics-grid">
        {/* MRR Card */}
        <div className="metric-card">
          <div className="metric-label">Monthly Recurring Revenue</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '8px' }}>
            <div className="metric-value">$18,400</div>
            <div className="metric-change positive">
              <TrendingUp size={16} />
              <span>+8%</span>
            </div>
          </div>
          <div className="metric-subtext">vs last month</div>
        </div>

        {/* ARR Card */}
        <div className="metric-card">
          <div className="metric-label">Annual Recurring Revenue</div>
          <div className="metric-value">$220,800</div>
          <div className="metric-subtext">Annualized from MRR</div>
        </div>

        {/* Active Clients Card */}
        <div className="metric-card">
          <div className="metric-label">Active Clients</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '8px' }}>
            <div className="metric-value">14</div>
            <Users size={20} style={{ color: 'var(--blue)' }} />
          </div>
          <div className="metric-subtext">All paying, healthy portfolio</div>
        </div>

        {/* Churn Card */}
        <div className="metric-card">
          <div className="metric-label">90-Day Churn</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '8px' }}>
            <div className="metric-value">1</div>
            <div className="metric-change negative">
              <TrendingDown size={16} />
              <span>-$1.2K MRR</span>
            </div>
          </div>
          <div className="metric-subtext">1 client lost</div>
        </div>
      </div>

      {/* MRR Chart */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <h2>MRR Trend (12 Months)</h2>
          <BarChart2 size={18} style={{ color: 'var(--tx-2)' }} />
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={mrrChartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid stroke="var(--border)" />
            <XAxis dataKey="month" tick={{ fill: 'var(--tx-3)', fontSize: 12 }} />
            <YAxis tick={{ fill: 'var(--tx-3)', fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                color: 'var(--tx-1)',
              }}
              formatter={(value) => `$${value.toLocaleString()}`}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--red)"
              dot={{ fill: 'var(--red)', r: 4 }}
              activeDot={{ r: 6 }}
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Two Column Section */}
      <div className="two-column-section">
        {/* Left: Upcoming Renewals */}
        <div className="card">
          <div className="card-header">
            <h2>Upcoming Renewals</h2>
            <Calendar size={18} style={{ color: 'var(--tx-2)' }} />
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Plan</th>
                <th>MRR</th>
                <th>Renewal Date</th>
                <th>Days</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {renewalData.map((renewal) => (
                <tr key={renewal.id}>
                  <td className="font-medium">{renewal.client}</td>
                  <td>{renewal.plan}</td>
                  <td className="font-medium">${renewal.mrr.toLocaleString()}</td>
                  <td>{renewal.renewalDate}</td>
                  <td>
                    <span className="metric-subtext">{renewal.daysUntil}d</span>
                  </td>
                  <td>
                    <span
                      className={`pill pill-${renewal.status === 'on-track' ? 'green' : renewal.status === 'at-risk' ? 'yellow' : 'red'}`}
                    >
                      {getStatusLabel(renewal.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Right: Revenue by Service */}
        <div className="card">
          <div className="card-header">
            <h2>Revenue by Service</h2>
            <DollarSign size={18} style={{ color: 'var(--tx-2)' }} />
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={revenueByService} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fill: 'var(--tx-3)', fontSize: 11 }} angle={-15} textAnchor="end" height={60} />
              <YAxis tick={{ fill: 'var(--tx-3)', fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  color: 'var(--tx-1)',
                }}
                formatter={(value) => `$${value.toLocaleString()}`}
              />
              <Bar dataKey="value" fill="var(--red)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Client Breakdown Table */}
      <div className="card">
        <div className="card-header">
          <h2>Client Portfolio</h2>
          <Users size={18} style={{ color: 'var(--tx-2)' }} />
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Plan</th>
              <th>MRR</th>
              <th>Requests Used</th>
              <th>Deliveries</th>
              <th>Last Delivery</th>
              <th>Health</th>
            </tr>
          </thead>
          <tbody>
            {clientData.map((client) => (
              <tr key={client.id}>
                <td className="font-medium">{client.name}</td>
                <td>{client.plan}</td>
                <td className="font-medium">${client.mrr.toLocaleString()}</td>
                <td className="text-secondary">{client.requestsUsed}</td>
                <td>{client.deliveries}</td>
                <td className="text-secondary">{client.lastDelivery}</td>
                <td>
                  <div className="health-indicator">
                    <span
                      className="health-dot"
                      style={{
                        backgroundColor:
                          client.health === 'good'
                            ? 'var(--green)'
                            : client.health === 'warn'
                              ? 'var(--yellow)'
                              : 'var(--red)',
                      }}
                    ></span>
                    <span className="capitalize">{client.health}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Finance;
