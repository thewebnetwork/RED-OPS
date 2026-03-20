import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  ChevronRight,
  FileText,
  Edit2,
  Clock,
  Lock,
  Globe,
  Folder,
  Tag,
  Star,
  ArrowLeft
} from 'lucide-react';
;

const mockDocs = [
  {
    id: 1,
    title: 'How to Onboard a New RRM Client',
    category: 'Playbook',
    lastUpdated: '2 days ago',
    author: 'Sarah Chen',
    access: 'internal',
    starred: false,
    steps: 16,
    body: `<h3>Overview</h3>
<p>This 16-step playbook guides you through the complete onboarding process for new RRM (Referral Revenue Model) clients.</p>
<h4>Key Steps:</h4>
<ul>
  <li><strong>Week 1:</strong> Initial intake call, contract review, and account setup</li>
  <li><strong>Week 2:</strong> Campaign structure planning, audience definition, and creative brief</li>
  <li><strong>Week 3:</strong> Initial ad deployment, tracking setup, and performance baseline</li>
  <li><strong>Week 4:</strong> First optimization review, reporting setup, and training completion</li>
</ul>
<p><strong>Success Metrics:</strong> Client email confirmations received, first campaign live, initial reporting dashboard active.</p>`
  },
  {
    id: 2,
    title: 'Meta Ad Campaign Build — Step by Step',
    category: 'Playbook',
    lastUpdated: '1 week ago',
    author: 'Marcus Rodriguez',
    access: 'shared',
    starred: true,
    body: `<h3>Meta Ad Campaign Structure</h3>
<p>Complete guide to building and launching high-performing Meta (Facebook/Instagram) ad campaigns.</p>
<h4>Campaign Hierarchy:</h4>
<ul>
  <li><strong>Campaign Level:</strong> Define objective (Conversions, Lead Gen, Traffic)</li>
  <li><strong>Ad Set Level:</strong> Audience, budget, schedule, placements</li>
  <li><strong>Ad Level:</strong> Creative, copy, CTA, landing page</li>
</ul>
<p><strong>Best Practices:</strong> Use 3-5 ad variations per set, test 2-3 audience segments, monitor ROAS daily.</p>`
  },
  {
    id: 3,
    title: 'Client Email Scripts — All Stages',
    category: 'Template',
    lastUpdated: '3 days ago',
    author: 'Jessica Park',
    access: 'internal',
    starred: false,
    body: `<h3>Email Communication Templates</h3>
<p>Pre-written email templates for every stage of the client lifecycle.</p>
<h4>Stages Covered:</h4>
<ul>
  <li>Initial outreach and qualification</li>
  <li>Proposal and contract follow-up</li>
  <li>Welcome and onboarding kickoff</li>
  <li>Weekly performance updates</li>
  <li>End-of-month reporting</li>
  <li>Renewal and expansion conversations</li>
</ul>`
  },
  {
    id: 4,
    title: 'Monthly Report Template',
    category: 'Template',
    lastUpdated: '1 week ago',
    author: 'David Kim',
    access: 'shared',
    starred: true,
    body: `<h3>Standard Monthly Performance Report</h3>
<p>Template structure for consistent client reporting across all accounts.</p>
<h4>Report Sections:</h4>
<ul>
  <li>Executive Summary (1 page)</li>
  <li>Key Performance Metrics Dashboard</li>
  <li>Campaign Performance by Channel</li>
  <li>Budget Allocation & Spend</li>
  <li>Recommendations & Opportunities</li>
</ul>`
  },
  {
    id: 5,
    title: 'ISA Objection Handler Scripts',
    category: 'Template',
    lastUpdated: '2 weeks ago',
    author: 'Alex Thompson',
    access: 'internal',
    starred: false,
    body: `<h3>Common Objections & Responses</h3>
<p>Scripted responses to the most common sales objections from prospects.</p>
<h4>Objections Covered:</h4>
<ul>
  <li>"We're already using another agency"</li>
  <li>"Your pricing is too high"</li>
  <li>"We don't have budget right now"</li>
  <li>"I need to talk to my team"</li>
  <li>"Can you send me more information?"</li>
</ul>`
  },
  {
    id: 6,
    title: 'CASL Compliance Guide',
    category: 'Reference',
    lastUpdated: '1 month ago',
    author: 'Legal Team',
    access: 'shared',
    starred: false,
    body: `<h3>Canadian Anti-Spam Legislation (CASL) Requirements</h3>
<p>Essential guide to staying compliant with Canadian email marketing laws.</p>
<h4>Key Requirements:</h4>
<ul>
  <li>Explicit opt-in for all commercial emails</li>
  <li>Clear identification of sender</li>
  <li>Valid physical address required</li>
  <li>Simple unsubscribe mechanism</li>
  <li>Honor unsubscribe requests within 10 days</li>
</ul>`
  },
  {
    id: 7,
    title: 'ICP Definition — RRM Target Client',
    category: 'Reference',
    lastUpdated: '3 weeks ago',
    author: 'Sarah Chen',
    access: 'internal',
    starred: false,
    body: `<h3>Ideal Client Profile for RRM Programs</h3>
<p>Profile definition for leads most likely to succeed in our Referral Revenue Model.</p>
<h4>Characteristics:</h4>
<ul>
  <li>Service-based business (real estate, coaching, consulting)</li>
  <li>$50K-$500K annual revenue</li>
  <li>Strong existing client base for referrals</li>
  <li>Digital marketing budget of $2K+/month</li>
  <li>Willing to implement tracking and reporting</li>
</ul>`
  },
  {
    id: 8,
    title: 'New Team Member Onboarding',
    category: 'Training',
    lastUpdated: '1 month ago',
    author: 'HR Department',
    access: 'shared',
    starred: false,
    body: `<h3>Complete Onboarding Checklist for New Team Members</h3>
<p>30-day onboarding plan to get new hires up to speed.</p>
<h4>Week 1 - Systems & Culture:</h4>
<ul>
  <li>Company overview and mission</li>
  <li>Tools setup (Slack, Notion, CRM)</li>
  <li>Team introductions</li>
</ul>`
  },
  {
    id: 9,
    title: 'Ad Creative Brief Template',
    category: 'Template',
    lastUpdated: '5 days ago',
    author: 'Marcus Rodriguez',
    access: 'internal',
    starred: false,
    body: `<h3>Creative Brief Outline</h3>
<p>Standardized brief structure for requesting new creative assets from designers.</p>
<h4>Required Sections:</h4>
<ul>
  <li>Campaign Objective & Goals</li>
  <li>Target Audience Description</li>
  <li>Key Message & Unique Selling Proposition</li>
  <li>Visual Style & Brand Guidelines</li>
  <li>Deliverables & Timeline</li>
</ul>`
  },
  {
    id: 10,
    title: 'GHL Pipeline Setup Guide',
    category: 'Playbook',
    lastUpdated: '1 week ago',
    author: 'David Kim',
    access: 'shared',
    starred: false,
    body: `<h3>GoHighLevel CRM Setup for Agencies</h3>
<p>Complete walkthrough of setting up GHL pipeline for managing leads and opportunities.</p>
<h4>Pipeline Stages:</h4>
<ul>
  <li>Lead (inquiry received)</li>
  <li>Qualified (fit confirmed)</li>
  <li>Proposal Sent</li>
  <li>Negotiation</li>
  <li>Won / Lost</li>
</ul>`
  },
  {
    id: 11,
    title: 'Content Calendar Framework',
    category: 'Template',
    lastUpdated: '4 days ago',
    author: 'Jessica Park',
    access: 'internal',
    starred: false,
    body: `<h3>Monthly Content Calendar Template</h3>
<p>Framework for planning and organizing content across all channels.</p>
<h4>Content Types:</h4>
<ul>
  <li>Educational posts</li>
  <li>Client testimonials</li>
  <li>Industry news commentary</li>
  <li>Promotional content</li>
  <li>Behind-the-scenes</li>
</ul>`
  },
  {
    id: 12,
    title: 'Pricing & Package Reference',
    category: 'Reference',
    lastUpdated: '2 weeks ago',
    author: 'Sales Team',
    access: 'shared',
    starred: false,
    body: `<h3>Service Pricing & Package Options</h3>
<p>Current pricing structure and package details for all service offerings.</p>
<h4>Packages:</h4>
<ul>
  <li><strong>Starter:</strong> $2,000/month - Ad management only</li>
  <li><strong>Growth:</strong> $4,500/month - Ads + strategy + reporting</li>
  <li><strong>Agency:</strong> $7,500/month - Full service + training</li>
  <li><strong>Custom:</strong> Based on requirements</li>
</ul>`
  }
];

const categories = [
  { name: 'Playbooks', count: 6, icon: BookOpen },
  { name: 'Templates', count: 8, icon: FileText },
  { name: 'Reference', count: 4, icon: Folder },
  { name: 'Training', count: 3, icon: Globe }
];

export default function SOPs() {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [starredDocs, setStarredDocs] = useState(new Set([2, 4]));

  const filteredDocs = useMemo(() => {
    return mockDocs.filter(doc => {
      const matchesCategory = !selectedCategory || doc.category === selectedCategory;
      const matchesSearch =
        !searchQuery ||
        doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.author.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  const toggleStar = (docId) => {
    const newStarred = new Set(starredDocs);
    if (newStarred.has(docId)) {
      newStarred.delete(docId);
    } else {
      newStarred.add(docId);
    }
    setStarredDocs(newStarred);
  };

  const starredDocsList = mockDocs.filter(doc => starredDocs.has(doc.id)).slice(0, 3);

  return (
    <div className="page-fill" style={{ display: 'flex', gap: '0' }}>
      {/* Left Sidebar */}
      <div style={{
        width: '220px',
        borderRight: `1px solid var(--border)`,
        display: 'flex',
        flexDirection: 'column',
        padding: '20px',
        gap: '24px',
        overflowY: 'auto'
      }}>
        <button className="btn-primary btn-sm" style={{ width: '100%' }}>
          <Plus size={16} style={{ marginRight: '6px' }} />
          New Doc
        </button>

        {/* Categories */}
        <div>
          <div style={{
            fontSize: '12px',
            fontWeight: '600',
            color: 'var(--tx-3)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '12px'
          }}>
            Categories
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {categories.map(cat => {
              const IconComponent = cat.icon;
              const isActive = selectedCategory === cat.name;
              return (
                <button
                  key={cat.name}
                  onClick={() => setSelectedCategory(isActive ? null : cat.name)}
                  style={{
                    padding: '10px 12px',
                    background: isActive ? 'var(--bg-elevated)' : 'transparent',
                    border: `1px solid ${isActive ? 'var(--border-hi)' : 'transparent'}`,
                    borderRadius: '6px',
                    color: isActive ? 'var(--tx-1)' : 'var(--tx-2)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.2s'
                  }}
                >
                  <IconComponent size={16} />
                  <span style={{ flex: 1 }}>{cat.name}</span>
                  <span style={{
                    fontSize: '12px',
                    color: 'var(--tx-3)',
                    background: 'var(--bg-card)',
                    padding: '2px 6px',
                    borderRadius: '3px'
                  }}>
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Starred Section */}
        {starredDocsList.length > 0 && (
          <div>
            <div style={{
              fontSize: '12px',
              fontWeight: '600',
              color: 'var(--tx-3)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '12px'
            }}>
              Starred
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {starredDocsList.map(doc => (
                <button
                  key={doc.id}
                  onClick={() => setSelectedDoc(doc)}
                  style={{
                    padding: '8px 10px',
                    background: 'transparent',
                    border: `1px solid var(--border)`,
                    borderRadius: '4px',
                    color: 'var(--tx-1)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '13px',
                    transition: 'all 0.2s',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                  title={doc.title}
                >
                  <Star size={12} style={{ marginRight: '6px', display: 'inline' }} />
                  {doc.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {!selectedDoc ? (
          <>
            {/* Search Bar */}
            <div style={{
              padding: '20px',
              borderBottom: `1px solid var(--border)`,
              background: 'var(--bg-card)'
            }}>
              <div style={{ position: 'relative' }}>
                <Search size={18} style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--tx-3)'
                }} />
                <input
                  type="text"
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-field"
                  style={{ paddingLeft: '40px', width: '100%' }}
                />
              </div>
            </div>

            {/* Doc List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
              {filteredDocs.length === 0 ? (
                <div className="empty-state">
                  <FileText size={48} style={{ opacity: 0.5, marginBottom: '16px' }} />
                  <p>No documents found</p>
                </div>
              ) : (
                <div>
                  {filteredDocs.map(doc => (
                    <button
                      key={doc.id}
                      onClick={() => setSelectedDoc(doc)}
                      style={{
                        width: '100%',
                        padding: '16px 20px',
                        background: 'transparent',
                        border: 'none',
                        borderBottom: `1px solid var(--border)`,
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <FileText size={18} style={{ color: 'var(--tx-2)', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontWeight: '500',
                          color: 'var(--tx-1)',
                          marginBottom: '4px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {doc.title}
                        </div>
                        <div style={{
                          fontSize: '12px',
                          color: 'var(--tx-3)',
                          display: 'flex',
                          gap: '12px'
                        }}>
                          <span className="pill" style={{ padding: '2px 8px' }}>
                            {doc.category}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={12} />
                            {doc.lastUpdated}
                          </span>
                          <span>{doc.author}</span>
                          <span className="pill" style={{
                            padding: '2px 8px',
                            background: doc.access === 'internal' ? 'rgba(169, 85, 247, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                            color: doc.access === 'internal' ? '#c4a4ff' : '#60a5fa'
                          }}>
                            {doc.access}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleStar(doc.id);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: '4px',
                          cursor: 'pointer',
                          color: starredDocs.has(doc.id) ? 'var(--yellow)' : 'var(--tx-3)',
                          transition: 'color 0.2s'
                        }}
                      >
                        <Star size={16} fill={starredDocs.has(doc.id) ? 'currentColor' : 'none'} />
                      </button>
                      <ChevronRight size={16} style={{ color: 'var(--tx-3)' }} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          // Detail Panel
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{
              padding: '20px',
              borderBottom: `1px solid var(--border)`,
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <button
                onClick={() => setSelectedDoc(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  color: 'var(--tx-2)',
                  transition: 'color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--tx-1)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--tx-2)'}
              >
                <ArrowLeft size={20} />
              </button>
              <h1 style={{
                fontSize: '24px',
                fontWeight: '700',
                color: 'var(--tx-1)',
                margin: 0,
                flex: 1
              }}>
                {selectedDoc.title}
              </h1>
              <button
                onClick={() => toggleStar(selectedDoc.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '4px',
                  cursor: 'pointer',
                  color: starredDocs.has(selectedDoc.id) ? 'var(--yellow)' : 'var(--tx-3)',
                  transition: 'color 0.2s'
                }}
              >
                <Star size={20} fill={starredDocs.has(selectedDoc.id) ? 'currentColor' : 'none'} />
              </button>
            </div>

            {/* Metadata */}
            <div style={{
              padding: '20px',
              background: 'var(--bg-elevated)',
              borderBottom: `1px solid var(--border)`,
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '20px'
            }}>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--tx-3)', marginBottom: '4px' }}>Author</div>
                <div style={{ color: 'var(--tx-1)', fontWeight: '500' }}>{selectedDoc.author}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--tx-3)', marginBottom: '4px' }}>Last Updated</div>
                <div style={{ color: 'var(--tx-1)', fontWeight: '500' }}>{selectedDoc.lastUpdated}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--tx-3)', marginBottom: '4px' }}>Category</div>
                <div style={{ color: 'var(--tx-1)', fontWeight: '500' }}>{selectedDoc.category}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--tx-3)', marginBottom: '4px' }}>Access</div>
                <div style={{
                  color: selectedDoc.access === 'internal' ? '#c4a4ff' : '#60a5fa',
                  fontWeight: '500',
                  textTransform: 'capitalize'
                }}>
                  {selectedDoc.access}
                </div>
              </div>
            </div>

            {/* Content */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '30px'
            }}>
              <div
                style={{
                  color: 'var(--tx-1)',
                  lineHeight: '1.7',
                  fontSize: '15px'
                }}
                dangerouslySetInnerHTML={{ __html: selectedDoc.body }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
