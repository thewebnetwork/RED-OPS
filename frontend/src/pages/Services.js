import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Services = () => {
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedService, setSelectedService] = useState(null);
  const [requestNotes, setRequestNotes] = useState('');
  const [requestDescription, setRequestDescription] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hoveredId, setHoveredId] = useState(null);

  const categories = [
    'All',
    'Video Production',
    'Design & Creative',
    'Ads & Marketing',
    'Copywriting',
    'Strategy'
  ];

  const services = [
    {
      id: 1,
      name: 'Video Ad Edit (30s)',
      category: 'Video Production',
      description: 'Professional 30-second video ad edit with color grading and effects',
      turnaround: '2-3 days',
      price: '$250',
      icon: '🎬'
    },
    {
      id: 2,
      name: 'Video Ad Edit (60s)',
      category: 'Video Production',
      description: 'Complete 60-second commercial video production and editing',
      turnaround: '3-5 days',
      price: '$450',
      icon: '🎬'
    },
    {
      id: 3,
      name: 'Reel/Short Form Edit',
      category: 'Video Production',
      description: 'Fast-paced social media reel editing with trends and music sync',
      turnaround: '1-2 days',
      price: '$200',
      icon: '📱'
    },
    {
      id: 4,
      name: 'Talking Head Polish',
      category: 'Video Production',
      description: 'Clean up and enhance personal video content with audio mastering',
      turnaround: '1-2 days',
      price: '$180',
      icon: '👤'
    },
    {
      id: 5,
      name: 'Ad Creative Set (5 images)',
      category: 'Design & Creative',
      description: 'High-converting ad creative designs optimized for your platform',
      turnaround: '2-3 days',
      price: '$400',
      icon: '🎨'
    },
    {
      id: 6,
      name: 'Thumbnail Pack (10)',
      category: 'Design & Creative',
      description: 'Professional YouTube thumbnails designed for maximum click-through',
      turnaround: '2-3 days',
      price: '$350',
      icon: '📸'
    },
    {
      id: 7,
      name: 'Logo Refresh',
      category: 'Design & Creative',
      description: 'Modern update to your existing brand logo with multiple formats',
      turnaround: '3-5 days',
      price: '$600',
      icon: '✨'
    },
    {
      id: 8,
      name: 'Landing Page Design',
      category: 'Design & Creative',
      description: 'Custom high-converting landing page design and layout',
      turnaround: '4-7 days',
      price: '$1200',
      icon: '🖥️'
    },
    {
      id: 9,
      name: 'Meta Ads Setup & Launch',
      category: 'Ads & Marketing',
      description: 'Complete Facebook/Instagram ad setup, targeting, and launch',
      turnaround: '2-3 days',
      price: '$500',
      icon: '📊'
    },
    {
      id: 10,
      name: 'Google Ads Campaign Build',
      category: 'Ads & Marketing',
      description: 'Full Google Ads campaign strategy, setup, and optimization',
      turnaround: '3-5 days',
      price: '$750',
      icon: '🔍'
    },
    {
      id: 11,
      name: 'Email Sequence (5 emails)',
      category: 'Copywriting',
      description: 'Compelling 5-email nurture sequence with sales hooks',
      turnaround: '2-3 days',
      price: '$300',
      icon: '✉️'
    },
    {
      id: 12,
      name: 'Ad Copy Pack (10 hooks)',
      category: 'Copywriting',
      description: 'High-performing ad headlines and body copy variations',
      turnaround: '1-2 days',
      price: '$250',
      icon: '✍️'
    },
    {
      id: 13,
      name: '90-min Strategy Call',
      category: 'Strategy',
      description: 'Deep-dive strategy session with expert advisor. Includes notes.',
      turnaround: '1-3 days',
      price: '$400',
      icon: '💡'
    },
    {
      id: 14,
      name: 'Monthly Content Calendar',
      category: 'Strategy',
      description: 'Comprehensive monthly content strategy and posting schedule',
      turnaround: '3-5 days',
      price: '$600',
      icon: '📅'
    }
  ];

  const filteredServices = activeCategory === 'All' 
    ? services 
    : services.filter(s => s.category === activeCategory);

  const handleRequestClick = (service) => {
    setSelectedService(service);
    setRequestNotes('');
    setRequestDescription('');
    setIsModalOpen(true);
  };

  const handleSubmitRequest = async () => {
    if (!requestDescription.trim()) {
      toast.error('Please provide a brief description of your request.');
      return;
    }
    setSubmitting(true);
    try {
      await axios.post(`${API}/orders`, {
        title: selectedService.name,
        description: requestDescription.trim(),
        notes: requestNotes.trim() || undefined,
        service_name: selectedService.name,
        category_name: selectedService.category,
      });
      toast.success(`Request submitted for "${selectedService.name}". We'll follow up within 24 hours.`);
      setIsModalOpen(false);
      setSelectedService(null);
      setRequestNotes('');
      setRequestDescription('');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedService(null);
  };

  const styles = {
    pageContainer: {
      flex: 1,
      overflowY: 'auto',
      overflowX: 'hidden',
      backgroundColor: 'var(--bg)',
      color: 'var(--tx-1)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    },
    banner: {
      backgroundColor: 'var(--bg-card)',
      borderBottom: '1px solid var(--border)',
      padding: '12px 24px',
      textAlign: 'center',
      fontSize: '14px',
      color: 'var(--tx-2)',
      lineHeight: '1.5'
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
    filterTabs: {
      display: 'flex',
      gap: '12px',
      marginBottom: '40px',
      flexWrap: 'wrap',
      borderBottom: '1px solid var(--border)',
      paddingBottom: '16px'
    },
    filterTab: {
      padding: '8px 16px',
      border: 'none',
      backgroundColor: 'transparent',
      color: 'var(--tx-2)',
      fontSize: '14px',
      fontWeight: '500',
      cursor: 'pointer',
      borderBottom: '2px solid transparent',
      transition: 'all 0.2s ease',
      marginBottom: '-1px'
    },
    filterTabActive: {
      color: 'var(--tx-1)',
      borderBottomColor: 'var(--red)'
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
      gap: '24px',
      marginBottom: '40px'
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
    icon: {
      fontSize: '32px',
      marginBottom: '16px'
    },
    serviceName: {
      fontSize: '18px',
      fontWeight: '600',
      marginBottom: '8px',
      color: 'var(--tx-1)'
    },
    description: {
      fontSize: '14px',
      color: 'var(--tx-2)',
      marginBottom: '16px',
      lineHeight: '1.5',
      flex: 1
    },
    badgeRow: {
      display: 'flex',
      gap: '12px',
      marginBottom: '16px',
      flexWrap: 'wrap'
    },
    badge: {
      display: 'inline-block',
      padding: '4px 12px',
      backgroundColor: 'var(--bg-elevated)',
      border: '1px solid var(--border)',
      borderRadius: '20px',
      fontSize: '12px',
      color: 'var(--tx-2)',
      fontWeight: '500'
    },
    price: {
      fontSize: '20px',
      fontWeight: '700',
      color: 'var(--red)',
      marginBottom: '16px'
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
    buttonPrimary: {
      backgroundColor: 'var(--red)',
      color: '#fff'
    },
    buttonPrimaryHover: {
      opacity: 0.9,
      transform: 'translateY(-1px)'
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
      marginBottom: '8px',
      color: 'var(--tx-1)'
    },
    modalSubtitle: {
      fontSize: '14px',
      color: 'var(--tx-2)',
      marginBottom: '24px'
    },
    formGroup: {
      marginBottom: '20px'
    },
    label: {
      display: 'block',
      fontSize: '14px',
      fontWeight: '600',
      marginBottom: '8px',
      color: 'var(--tx-1)'
    },
    textarea: {
      width: '100%',
      padding: '12px',
      backgroundColor: 'var(--bg)',
      border: '1px solid var(--border)',
      borderRadius: '6px',
      color: 'var(--tx-1)',
      fontSize: '14px',
      fontFamily: 'inherit',
      resize: 'vertical',
      minHeight: '100px',
      boxSizing: 'border-box'
    },
    textareaFocus: {
      outline: 'none',
      borderColor: 'var(--red)'
    },
    buttonGroup: {
      display: 'flex',
      gap: '12px',
      marginTop: '28px'
    },
    buttonFull: {
      flex: 1
    },
    buttonSecondary: {
      backgroundColor: 'var(--bg)',
      border: '1px solid var(--border)',
      color: 'var(--tx-1)'
    },
    buttonSecondaryHover: {
      borderColor: 'var(--border-hi)',
      backgroundColor: 'var(--bg-elevated)'
    },
    attachButton: {
      padding: '10px 16px',
      backgroundColor: 'var(--bg)',
      border: '1px solid var(--border)',
      borderRadius: '6px',
      color: 'var(--tx-2)',
      fontSize: '14px',
      cursor: 'pointer',
      transition: 'all 0.2s ease'
    },
    attachButtonHover: {
      borderColor: 'var(--border-hi)',
      color: 'var(--tx-1)'
    }
  };

  return (
    <div style={styles.pageContainer}>
      <div style={styles.banner}>
        ✓ Fulfilled by vetted RRG partners. Quality guaranteed. Billed through your account.
      </div>

      <div style={styles.pageContent}>
        <div style={styles.header}>
          <h1 style={styles.title}>RRG Services</h1>
          <p style={styles.subtitle}>
            Order professional services from our trusted partner network. No Fiverr. No Upwork. Just results.
          </p>
        </div>

        <div style={styles.filterTabs}>
          {categories.map(category => (
            <button
              key={category}
              style={{
                ...styles.filterTab,
                ...(activeCategory === category ? styles.filterTabActive : {})
              }}
              onClick={() => setActiveCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>

        <div style={styles.grid}>
          {filteredServices.map(service => (
            <div
              key={service.id}
              style={{ ...styles.card, borderColor: hoveredId === service.id ? 'var(--border-hi)' : 'var(--border)', backgroundColor: hoveredId === service.id ? 'var(--bg-elevated)' : 'var(--bg-card)' }}
              onMouseEnter={() => setHoveredId(service.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <div style={styles.icon}>{service.icon}</div>
              <h3 style={styles.serviceName}>{service.name}</h3>
              <p style={styles.description}>{service.description}</p>
              
              <div style={styles.badgeRow}>
                <span style={styles.badge}>{service.turnaround}</span>
              </div>

              <div style={styles.price}>{service.price}</div>

              <button
                style={{ ...styles.button, ...styles.buttonPrimary }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.9';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
                onClick={() => handleRequestClick(service)}
              >
                Request Service
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Modal */}
      <div style={styles.modalOverlay} onClick={closeModal}>
        <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
          <h2 style={styles.modalTitle}>{selectedService?.name}</h2>
          <p style={styles.modalSubtitle}>{selectedService?.description}</p>

          <div style={styles.formGroup}>
            <label style={styles.label}>Brief Description *</label>
            <textarea
              style={styles.textarea}
              placeholder="Tell us what you need for this service..."
              value={requestDescription}
              onChange={(e) => setRequestDescription(e.target.value)}
              onFocus={(e) => {
                e.currentTarget.style.outline = 'none';
                e.currentTarget.style.borderColor = 'var(--red)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
              }}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Attach Files</label>
            <button 
              style={styles.attachButton}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-hi)';
                e.currentTarget.style.color = 'var(--tx-1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.color = 'var(--tx-2)';
              }}
            >
              + Choose Files
            </button>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Additional Notes</label>
            <textarea
              style={styles.textarea}
              placeholder="Any other details we should know?"
              value={requestNotes}
              onChange={(e) => setRequestNotes(e.target.value)}
              onFocus={(e) => {
                e.currentTarget.style.outline = 'none';
                e.currentTarget.style.borderColor = 'var(--red)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
              }}
            />
          </div>

          <div style={styles.buttonGroup}>
            <button
              style={{ ...styles.button, ...styles.buttonSecondary, ...styles.buttonFull }}
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
              Cancel
            </button>
            <button
              style={{ ...styles.button, ...styles.buttonPrimary, ...styles.buttonFull, opacity: submitting ? 0.7 : 1, cursor: submitting ? 'not-allowed' : 'pointer' }}
              onMouseEnter={(e) => { if (!submitting) { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = submitting ? '0.7' : '1'; e.currentTarget.style.transform = 'translateY(0)'; }}
              onClick={handleSubmitRequest}
              disabled={submitting}
            >
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Services;
