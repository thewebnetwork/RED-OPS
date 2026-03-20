import React, { useState } from 'react';

const Integrations = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedIntegration, setSelectedIntegration] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [connectedIntegrations, setConnectedIntegrations] = useState([
    'GoHighLevel',
    'Google Drive',
    'Nextcloud',
    'OpenAI'
  ]);

  const allIntegrations = [
    {
      id: 1,
      name: 'GoHighLevel',
      category: 'CRM',
      description: 'Your primary acquisition & nurture CRM. Syncs contact status and pipeline stages.',
      icon: 'G',
      color: '#3b82f6',
      lastSync: '5 mins ago'
    },
    {
      id: 2,
      name: 'Google Drive',
      category: 'Storage',
      description: 'Access and deliver files directly from Drive within requests and projects.',
      icon: 'D',
      color: '#4285f4',
      lastSync: '12 mins ago'
    },
    {
      id: 3,
      name: 'Slack',
      category: 'Communication',
      description: 'Get notified in Slack when requests are submitted, assigned, or completed.',
      icon: 'S',
      color: '#36c5f0'
    },
    {
      id: 4,
      name: 'Gmail/Google Workspace',
      category: 'Communication',
      description: 'Send automated client emails and monthly reports directly from Red Ops.',
      icon: 'G',
      color: '#ea4335'
    },
    {
      id: 5,
      name: 'Stripe',
      category: 'Payments',
      description: 'Sync client MRR, track renewals, and flag missed payments automatically.',
      icon: 'S',
      color: '#625bdb'
    },
    {
      id: 6,
      name: 'Calendly',
      category: 'Scheduling',
      description: 'Auto-create tasks when strategy calls are booked.',
      icon: 'C',
      color: '#006fee'
    },
    {
      id: 7,
      name: 'Zapier',
      category: 'Automation',
      description: 'Trigger Red Ops actions from 5,000+ apps.',
      icon: 'Z',
      color: '#ff4f00'
    },
    {
      id: 8,
      name: 'Notion',
      category: 'Knowledge',
      description: 'Migrate Notion docs to Red Ops SOPs with one click.',
      icon: 'N',
      color: '#000000'
    },
    {
      id: 9,
      name: 'Meta Ads',
      category: 'Marketing',
      description: 'Pull live ad performance into client dashboards.',
      icon: 'M',
      color: '#1877f2'
    },
    {
      id: 10,
      name: 'Google Ads',
      category: 'Marketing',
      description: 'Monitor campaign performance alongside client health scores.',
      icon: 'A',
      color: '#4285f4'
    },
    {
      id: 11,
      name: 'Nextcloud',
      category: 'Storage',
      description: 'Primary file storage for all deliverables and client assets.',
      icon: 'N',
      color: '#0082c9',
      lastSync: '8 mins ago'
    },
    {
      id: 12,
      name: 'OpenAI',
      category: 'AI',
      description: 'Powers the AI Brief Generator, Status Summary, and internal search.',
      icon: 'O',
      color: '#10a37f',
      lastSync: '2 mins ago'
    }
  ];

  const comingSoon = [
    { name: 'HubSpot', category: 'CRM' },
    { name: 'Salesforce', category: 'CRM' },
    { name: 'Monday.com', category: 'Project Management' },
    { name: 'QuickBooks', category: 'Accounting' }
  ];

  const getIntegrationStatus = (name) => {
    return connectedIntegrations.includes(name) ? 'Connected' : 'Available';
  };

  const filteredIntegrations = allIntegrations.filter(integration => {
    const matchesSearch = integration.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         integration.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         integration.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const status = getIntegrationStatus(integration.name);
    const matchesFilter = statusFilter === 'All' || status === statusFilter;

    return matchesSearch && matchesFilter;
  });

  const handleConnect = (integration) => {
    setSelectedIntegration(integration);
    setIsModalOpen(true);
  };

  const handleDisconnect = (name) => {
    const confirmed = window.confirm(`Are you sure you want to disconnect ${name}?`);
    if (confirmed) {
      setConnectedIntegrations(connectedIntegrations.filter(i => i !== name));
      window.alert(`${name} has been disconnected.`);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedIntegration(null);
  };

  const handleModalConnect = () => {
    window.alert(`To connect ${selectedIntegration.name}, contact your Red Ops admin or email support@redribbongroup.ca`);
    closeModal();
  };

  const styles = {
    pageContainer: {
      backgroundColor: 'var(--bg)',
      minHeight: '100vh',
      color: 'var(--tx-1)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    },
    pageContent: {
      maxWidth: '1400px',
      margin: '0 auto',
      padding: '40px 24px'
    },
    header: {
      marginBottom: '40px'
    },
    title: {
      fontSize: '32px',
      fontWeight: '700',
      marginBottom: '8px',
      color: 'var(--tx-1)'
    },
    subtitle: {
      fontSize: '16px',
      color: 'var(--tx-2)',
      lineHeight: '1.5'
    },
    controls: {
      display: 'flex',
      gap: '24px',
      marginBottom: '32px',
      flexWrap: 'wrap',
      alignItems: 'center'
    },
    searchBox: {
      flex: 1,
      minWidth: '250px',
      display: 'flex',
      alignItems: 'center',
      backgroundColor: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: '6px',
      padding: '0 12px',
      transition: 'all 0.2s ease'
    },
    searchInput: {
      flex: 1,
      backgroundColor: 'transparent',
      border: 'none',
      color: 'var(--tx-1)',
      padding: '12px 12px',
      fontSize: '14px',
      outline: 'none'
    },
    searchInputPlaceholder: {
      color: 'var(--tx-3)'
    },
    filterGroup: {
      display: 'flex',
      gap: '12px'
    },
    filterButton: {
      padding: '10px 16px',
      backgroundColor: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: '6px',
      color: 'var(--tx-2)',
      fontSize: '14px',
      fontWeight: '500',
      cursor: 'pointer',
      transition: 'all 0.2s ease'
    },
    filterButtonActive: {
      backgroundColor: 'var(--red)',
      borderColor: 'var(--red)',
      color: '#fff'
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
      gap: '24px',
      marginBottom: '48px'
    },
    card: {
      backgroundColor: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: '8px',
      padding: '24px',
      transition: 'all 0.2s ease',
      display: 'flex',
      flexDirection: 'column'
    },
    cardHover: {
      borderColor: 'var(--border-hi)',
      backgroundColor: 'var(--bg-elevated)'
    },
    iconCircle: {
      width: '48px',
      height: '48px',
      borderRadius: '8px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      fontSize: '20px',
      fontWeight: '600',
      marginBottom: '16px'
    },
    integrationName: {
      fontSize: '18px',
      fontWeight: '600',
      marginBottom: '8px',
      color: 'var(--tx-1)'
    },
    category: {
      display: 'inline-block',
      padding: '4px 12px',
      backgroundColor: 'var(--bg-elevated)',
      border: '1px solid var(--border)',
      borderRadius: '20px',
      fontSize: '12px',
      color: 'var(--tx-2)',
      fontWeight: '500',
      marginBottom: '12px'
    },
    description: {
      fontSize: '14px',
      color: 'var(--tx-2)',
      marginBottom: '16px',
      lineHeight: '1.5',
      flex: 1
    },
    statusRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '16px'
    },
    statusBadge: {
      display: 'inline-block',
      padding: '6px 12px',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: '600'
    },
    statusGreen: {
      backgroundColor: 'rgba(34, 197, 94, 0.1)',
      color: 'var(--green)',
      border: '1px solid rgba(34, 197, 94, 0.2)'
    },
    statusGray: {
      backgroundColor: 'rgba(160, 160, 160, 0.1)',
      color: 'var(--tx-2)',
      border: '1px solid rgba(160, 160, 160, 0.2)'
    },
    lastSync: {
      fontSize: '12px',
      color: 'var(--tx-3)'
    },
    button: {
      padding: '10px 20px',
      border: 'none',
      borderRadius: '6px',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      width: '100%'
    },
    buttonConnect: {
      backgroundColor: 'var(--blue)',
      color: '#fff'
    },
    buttonDisconnect: {
      backgroundColor: 'var(--bg)',
      border: '1px solid var(--border)',
      color: 'var(--tx-2)'
    },
    buttonHover: {
      transform: 'translateY(-1px)',
      opacity: 0.9
    },
    section: {
      marginBottom: '48px'
    },
    sectionTitle: {
      fontSize: '20px',
      fontWeight: '600',
      marginBottom: '24px',
      color: 'var(--tx-1)',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    comingSoonGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
      gap: '24px'
    },
    comingSoonCard: {
      backgroundColor: 'var(--bg-card)',
      border: '2px dashed var(--border)',
      borderRadius: '8px',
      padding: '32px 24px',
      textAlign: 'center',
      opacity: 0.6
    },
    comingSoonName: {
      fontSize: '18px',
      fontWeight: '600',
      color: 'var(--tx-1)',
      marginBottom: '8px'
    },
    comingSoonCategory: {
      fontSize: '12px',
      color: 'var(--tx-2)'
    },
    modalOverlay: {
      display: isModalOpen ? 'flex' : 'none',
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      zIndex: 1000,
      alignItems: 'center',
      justifyContent: 'center'
    },
    modalBox: {
      backgroundColor: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: '8px',
      padding: '32px',
      maxWidth: '500px',
      width: '90%',
      boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)'
    },
    modalTitle: {
      fontSize: '24px',
      fontWeight: '700',
      marginBottom: '12px',
      color: 'var(--tx-1)'
    },
    modalDescription: {
      fontSize: '14px',
      color: 'var(--tx-2)',
      lineHeight: '1.6',
      marginBottom: '24px'
    },
    modalButtons: {
      display: 'flex',
      gap: '12px',
      marginTop: '24px'
    },
    modalButton: {
      flex: 1,
      padding: '12px 20px',
      border: 'none',
      borderRadius: '6px',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.2s ease'
    },
    modalButtonPrimary: {
      backgroundColor: 'var(--blue)',
      color: '#fff'
    },
    modalButtonSecondary: {
      backgroundColor: 'var(--bg)',
      border: '1px solid var(--border)',
      color: 'var(--tx-1)'
    }
  };

  return (
    <div style={styles.pageContainer}>
      <div style={styles.pageContent}>
        <div style={styles.header}>
          <h1 style={styles.title}>Integrations</h1>
          <p style={styles.subtitle}>
            Connect Red Ops to your existing stack. One hub, all your tools.
          </p>
        </div>

        <div style={styles.controls}>
          <div style={styles.searchBox}>
            <span style={{ color: 'var(--tx-3)', marginRight: '8px' }}>🔍</span>
            <input
              type="text"
              placeholder="Search integrations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                ...styles.searchInput,
                color: searchQuery ? 'var(--tx-1)' : 'var(--tx-3)'
              }}
            />
          </div>

          <div style={styles.filterGroup}>
            {['All', 'Connected', 'Available'].map(filter => (
              <button
                key={filter}
                style={{
                  ...styles.filterButton,
                  ...(statusFilter === filter ? styles.filterButtonActive : {})
                }}
                onClick={() => setStatusFilter(filter)}
                onMouseEnter={(e) => {
                  if (statusFilter !== filter) {
                    e.currentTarget.style.borderColor = 'var(--border-hi)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (statusFilter !== filter) {
                    e.currentTarget.style.borderColor = 'var(--border)';
                  }
                }}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        <div style={styles.section}>
          <div style={styles.grid}>
            {filteredIntegrations.map(integration => {
              const status = getIntegrationStatus(integration.name);
              const isConnected = status === 'Connected';

              return (
                <div
                  key={integration.id}
                  style={styles.card}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-hi)';
                    e.currentTarget.style.backgroundColor = 'var(--bg-elevated)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.backgroundColor = 'var(--bg-card)';
                  }}
                >
                  <div
                    style={{
                      ...styles.iconCircle,
                      backgroundColor: integration.color
                    }}
                  >
                    {integration.icon}
                  </div>

                  <h3 style={styles.integrationName}>{integration.name}</h3>
                  <span style={styles.category}>{integration.category}</span>
                  <p style={styles.description}>{integration.description}</p>

                  <div style={styles.statusRow}>
                    <span
                      style={{
                        ...styles.statusBadge,
                        ...(isConnected ? styles.statusGreen : styles.statusGray)
                      }}
                    >
                      {status}
                    </span>
                    {isConnected && integration.lastSync && (
                      <span style={styles.lastSync}>Last sync: {integration.lastSync}</span>
                    )}
                  </div>

                  <button
                    style={{
                      ...styles.button,
                      ...(isConnected ? styles.buttonDisconnect : styles.buttonConnect)
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.opacity = '0.9';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.opacity = '1';
                    }}
                    onClick={() => {
                      if (isConnected) {
                        handleDisconnect(integration.name);
                      } else {
                        handleConnect(integration);
                      }
                    }}
                  >
                    {isConnected ? 'Disconnect' : 'Connect'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>
            🔜 Coming Soon
          </h2>
          <div style={styles.comingSoonGrid}>
            {comingSoon.map((item, idx) => (
              <div key={idx} style={styles.comingSoonCard}>
                <div style={styles.comingSoonName}>{item.name}</div>
                <div style={styles.comingSoonCategory}>{item.category}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal */}
      <div style={styles.modalOverlay} onClick={closeModal}>
        <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
          <h2 style={styles.modalTitle}>Connect {selectedIntegration?.name}</h2>
          <p style={styles.modalDescription}>
            To connect {selectedIntegration?.name} to Red Ops, contact your Red Ops admin or email{' '}
            <strong>support@redribbongroup.ca</strong>
          </p>
          <p style={styles.modalDescription}>
            Our team will help you set up the integration securely and configure it for your needs.
          </p>

          <div style={styles.modalButtons}>
            <button
              style={{
                ...styles.modalButton,
                ...styles.modalButtonSecondary
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-hi)';
                e.currentTarget.style.backgroundColor = 'var(--bg-elevated)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.backgroundColor = 'var(--bg)';
              }}
              onClick={closeModal}
            >
              Close
            </button>
            <button
              style={{
                ...styles.modalButton,
                ...styles.modalButtonPrimary
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.9';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
              onClick={handleModalConnect}
            >
              Contact Support
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Integrations;
