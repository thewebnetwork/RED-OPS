import React, { useState, useMemo } from 'react';
import { toast } from 'sonner';
import {
  BookOpen, Plus, Search, ChevronRight, FileText, Edit2, Clock,
  Globe, Folder, Star, ArrowLeft, Trash2, X, Lock,
} from 'lucide-react';

// ── Seed data ────────────────────────────────────────────────────────────────
const SEED_DOCS = [
  { id:1,  title:'How to Onboard a New RRM Client',       category:'Playbook',   lastUpdated:'2 days ago',   author:'Sarah Chen',        access:'internal', starred:false, body:'<h3>Overview</h3><p>This 16-step playbook guides you through the complete onboarding process for new RRM clients.</p><h4>Key Steps:</h4><ul><li><strong>Week 1:</strong> Initial intake call, contract review, and account setup</li><li><strong>Week 2:</strong> Campaign structure planning, audience definition, and creative brief</li><li><strong>Week 3:</strong> Initial ad deployment, tracking setup, and performance baseline</li><li><strong>Week 4:</strong> First optimization review, reporting setup, and training completion</li></ul>' },
  { id:2,  title:'Meta Ad Campaign Build — Step by Step', category:'Playbook',   lastUpdated:'1 week ago',   author:'Marcus Rodriguez',  access:'shared',   starred:true,  body:'<h3>Meta Ad Campaign Structure</h3><p>Complete guide to building and launching high-performing Meta ad campaigns.</p><h4>Campaign Hierarchy:</h4><ul><li><strong>Campaign Level:</strong> Define objective (Conversions, Lead Gen, Traffic)</li><li><strong>Ad Set Level:</strong> Audience, budget, schedule, placements</li><li><strong>Ad Level:</strong> Creative, copy, CTA, landing page</li></ul><p><strong>Best Practices:</strong> Use 3-5 ad variations per set, test 2-3 audience segments, monitor ROAS daily.</p>' },
  { id:3,  title:'Client Email Scripts — All Stages',     category:'Template',   lastUpdated:'3 days ago',   author:'Jessica Park',      access:'internal', starred:false, body:'<h3>Email Communication Templates</h3><p>Pre-written email templates for every stage of the client lifecycle.</p><h4>Stages Covered:</h4><ul><li>Initial outreach and qualification</li><li>Proposal and contract follow-up</li><li>Welcome and onboarding kickoff</li><li>Weekly performance updates</li><li>End-of-month reporting</li><li>Renewal and expansion conversations</li></ul>' },
  { id:4,  title:'Monthly Report Template',               category:'Template',   lastUpdated:'1 week ago',   author:'David Kim',         access:'shared',   starred:true,  body:'<h3>Standard Monthly Performance Report</h3><p>Template structure for consistent client reporting across all accounts.</p><h4>Report Sections:</h4><ul><li>Executive Summary (1 page)</li><li>Key Performance Metrics Dashboard</li><li>Campaign Performance by Channel</li><li>Budget Allocation &amp; Spend</li><li>Recommendations &amp; Opportunities</li></ul>' },
  { id:5,  title:'ISA Objection Handler Scripts',         category:'Template',   lastUpdated:'2 weeks ago',  author:'Alex Thompson',     access:'internal', starred:false, body:'<h3>Common Objections &amp; Responses</h3><p>Scripted responses to the most common sales objections from prospects.</p>' },
  { id:6,  title:'CASL Compliance Guide',                 category:'Reference',  lastUpdated:'1 month ago',  author:'Legal Team',        access:'shared',   starred:false, body:'<h3>Canadian Anti-Spam Legislation (CASL) Requirements</h3><p>Essential guide to staying compliant with Canadian email marketing laws.</p>' },
  { id:7,  title:'ICP Definition — RRM Target Client',    category:'Reference',  lastUpdated:'3 weeks ago',  author:'Sarah Chen',        access:'internal', starred:false, body:'<h3>Ideal Client Profile for RRM Programs</h3><p>Profile definition for leads most likely to succeed in our Referral Revenue Model.</p>' },
  { id:8,  title:'New Team Member Onboarding',            category:'Training',   lastUpdated:'1 month ago',  author:'HR Department',     access:'shared',   starred:false, body:'<h3>Complete Onboarding Checklist for New Team Members</h3><p>30-day onboarding plan to get new hires up to speed.</p>' },
  { id:9,  title:'Ad Creative Brief Template',            category:'Template',   lastUpdated:'5 days ago',   author:'Marcus Rodriguez',  access:'internal', starred:false, body:'<h3>Creative Brief Outline</h3><p>Standardized brief structure for requesting new creative assets from designers.</p>' },
  { id:10, title:'GHL Pipeline Setup Guide',              category:'Playbook',   lastUpdated:'1 week ago',   author:'David Kim',         access:'shared',   starred:false, body:'<h3>GoHighLevel CRM Setup for Agencies</h3><p>Complete walkthrough of setting up GHL pipeline for managing leads and opportunities.</p>' },
  { id:11, title:'Content Calendar Framework',            category:'Template',   lastUpdated:'4 days ago',   author:'Jessica Park',      access:'internal', starred:false, body:'<h3>Monthly Content Calendar Template</h3><p>Framework for planning and organizing content across all channels.</p>' },
  { id:12, title:'Pricing &amp; Package Reference',       category:'Reference',  lastUpdated:'2 weeks ago',  author:'Sales Team',        access:'shared',   starred:false, body:'<h3>Service Pricing &amp; Package Options</h3><p>Current pricing structure and package details for all service offerings.</p>' },
];

const SEED_FOLDERS = ['Playbook', 'Template', 'Reference', 'Training'];

const FOLDER_ICONS = { Playbook: BookOpen, Template: FileText, Reference: Folder, Training: Globe };
const ACCESS_STYLES = {
  internal: { background: '#a855f718', color: '#a855f7' },
  shared:   { background: '#3b82f618', color: '#3b82f6' },
};

const now = () => new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// ── Component ────────────────────────────────────────────────────────────────
export default function SOPs() {
  const [docs,            setDocs]            = useState(SEED_DOCS);
  const [folders,         setFolders]         = useState(SEED_FOLDERS);
  const [activeFolder,    setActiveFolder]    = useState(null);
  const [searchQuery,     setSearchQuery]     = useState('');
  const [selectedDoc,     setSelectedDoc]     = useState(null);
  const [showEditor,      setShowEditor]      = useState(false);
  const [editingDoc,      setEditingDoc]      = useState(null);
  const [showNewFolder,   setShowNewFolder]   = useState(false);
  const [newFolderName,   setNewFolderName]   = useState('');
  const [form,            setForm]            = useState({ title: '', category: 'Playbook', access: 'internal', body: '' });

  const filtered = useMemo(() => docs.filter(doc => {
    const q = searchQuery.toLowerCase();
    return (!activeFolder || doc.category === activeFolder)
        && (!q || doc.title.toLowerCase().includes(q) || doc.author.toLowerCase().includes(q));
  }), [docs, activeFolder, searchQuery]);

  const starred = docs.filter(d => d.starred);

  const folderCount = folder => docs.filter(d => d.category === folder).length;

  // ── Handlers ──
  const openCreate = () => {
    setEditingDoc(null);
    setForm({ title: '', category: folders[0] || 'Playbook', access: 'internal', body: '' });
    setShowEditor(true);
  };

  const openEdit = (doc, e) => {
    e?.stopPropagation();
    setEditingDoc(doc);
    setForm({ title: doc.title, category: doc.category, access: doc.access, body: doc.body });
    setShowEditor(true);
    setSelectedDoc(null);
  };

  const saveDoc = () => {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    if (!form.body.trim())  { toast.error('Body cannot be empty'); return; }
    if (editingDoc) {
      setDocs(prev => prev.map(d => d.id === editingDoc.id ? { ...d, ...form, lastUpdated: 'just now', author: d.author } : d));
      toast.success('Document updated');
    } else {
      const newDoc = { ...form, id: Date.now(), lastUpdated: now(), author: 'You', starred: false };
      setDocs(prev => [...prev, newDoc]);
      toast.success('Document created');
    }
    setShowEditor(false);
  };

  const deleteDoc = (doc, e) => {
    e?.stopPropagation();
    toast(`Delete "${doc.title}"?`, {
      action: {
        label: 'Delete',
        onClick: () => {
          setDocs(prev => prev.filter(d => d.id !== doc.id));
          if (selectedDoc?.id === doc.id) setSelectedDoc(null);
          toast.success('Document deleted');
        },
      },
      cancel: { label: 'Cancel' },
    });
  };

  const toggleStar = (docId, e) => {
    e?.stopPropagation();
    setDocs(prev => prev.map(d => d.id === docId ? { ...d, starred: !d.starred } : d));
  };

  const addFolder = () => {
    const name = newFolderName.trim();
    if (!name) return;
    if (folders.includes(name)) { toast.error('Folder already exists'); return; }
    setFolders(prev => [...prev, name]);
    setNewFolderName('');
    setShowNewFolder(false);
    toast.success(`Folder "${name}" created`);
  };

  const deleteFolder = (folder, e) => {
    e.stopPropagation();
    const count = folderCount(folder);
    toast(`Delete folder "${folder}"?${count > 0 ? ` ${count} doc(s) will be moved to Uncategorised.` : ''}`, {
      action: {
        label: 'Delete',
        onClick: () => {
          setFolders(prev => prev.filter(f => f !== folder));
          if (activeFolder === folder) setActiveFolder(null);
          if (count > 0) setDocs(prev => prev.map(d => d.category === folder ? { ...d, category: 'Uncategorised' } : d));
          toast.success(`Folder "${folder}" deleted`);
        },
      },
      cancel: { label: 'Cancel' },
    });
  };

  // ── Render ──
  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', background: 'var(--bg)' }}>

      {/* ── Left Sidebar ── */}
      <div style={{ width: 220, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', padding: '16px 12px', gap: 20, overflowY: 'auto', flexShrink: 0, background: 'var(--bg-card)' }}>
        <button className="btn-primary btn-sm" style={{ width: '100%' }} onClick={openCreate}>
          <Plus size={14} /> New Document
        </button>

        {/* Folders */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Folders</span>
            <button onClick={() => setShowNewFolder(!showNewFolder)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', padding: 2 }} title="New folder">
              <Plus size={13} />
            </button>
          </div>

          {showNewFolder && (
            <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>
              <input className="input-field" placeholder="Folder name..." value={newFolderName} onChange={e => setNewFolderName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addFolder()} style={{ flex: 1, height: 28, fontSize: 12 }} autoFocus />
              <button className="btn-primary" onClick={addFolder} style={{ height: 28, padding: '0 8px', fontSize: 12 }}>Add</button>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* All */}
            <button
              onClick={() => setActiveFolder(null)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', background: !activeFolder ? 'var(--bg-elevated)' : 'transparent', color: !activeFolder ? 'var(--tx-1)' : 'var(--tx-2)', fontSize: 13, fontWeight: !activeFolder ? 600 : 400, transition: 'all .12s', width: '100%', textAlign: 'left' }}>
              <Folder size={14} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1 }}>All Documents</span>
              <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>{docs.length}</span>
            </button>

            {folders.map(folder => {
              const Icon = FOLDER_ICONS[folder] || Folder;
              const active = activeFolder === folder;
              return (
                <div key={folder} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <button
                    onClick={() => setActiveFolder(active ? null : folder)}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', background: active ? 'var(--bg-elevated)' : 'transparent', color: active ? 'var(--tx-1)' : 'var(--tx-2)', fontSize: 13, fontWeight: active ? 600 : 400, transition: 'all .12s', textAlign: 'left' }}>
                    <Icon size={14} style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{folder}</span>
                    <span style={{ fontSize: 11, color: 'var(--tx-3)', flexShrink: 0 }}>{folderCount(folder)}</span>
                  </button>
                  <button onClick={(e) => deleteFolder(folder, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', padding: '4px', borderRadius: 4, opacity: 0 }}
                    onMouseEnter={e => e.currentTarget.style.opacity = 1}
                    onMouseLeave={e => e.currentTarget.style.opacity = 0}
                    title="Delete folder">
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Starred */}
        {starred.length > 0 && (
          <div>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 10 }}>Starred</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {starred.slice(0, 5).map(doc => (
                <button key={doc.id} onClick={() => setSelectedDoc(doc)}
                  style={{ padding: '7px 10px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 5, cursor: 'pointer', textAlign: 'left', fontSize: 12, color: 'var(--tx-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', transition: 'all .12s' }}
                  title={doc.title}>
                  <Star size={11} style={{ marginRight: 5, display: 'inline', color: '#f59e0b' }} />
                  {doc.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Main Area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!selectedDoc ? (
          <>
            {/* Search bar */}
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
                <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx-3)', pointerEvents: 'none' }} />
                <input className="input-field" placeholder="Search documents..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ paddingLeft: 30, height: 32, fontSize: 12 }} />
              </div>
              <span style={{ fontSize: 12, color: 'var(--tx-3)' }}>{filtered.length} doc{filtered.length !== 1 ? 's' : ''}{activeFolder ? ` in ${activeFolder}` : ''}</span>
            </div>

            {/* Doc list */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--tx-3)' }}>
                  <FileText size={36} style={{ marginBottom: 12, opacity: 0.4 }} />
                  <p style={{ margin: 0, fontSize: 13 }}>No documents found</p>
                  <button className="btn-primary btn-sm" style={{ marginTop: 14 }} onClick={openCreate}><Plus size={13} /> New Document</button>
                </div>
              ) : (
                filtered.map(doc => (
                  <div key={doc.id}
                    onClick={() => setSelectedDoc(doc)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background .12s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <FileText size={16} style={{ color: 'var(--tx-2)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--tx-1)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</span>
                      <div style={{ display: 'flex', gap: 10, marginTop: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: 'var(--bg-elevated)', color: 'var(--tx-2)', border: '1px solid var(--border)' }}>{doc.category}</span>
                        <span style={{ fontSize: 11, color: 'var(--tx-3)', display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={11} />{doc.lastUpdated}</span>
                        <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>{doc.author}</span>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, ...ACCESS_STYLES[doc.access] }}>{doc.access === 'internal' ? <><Lock size={9} style={{ marginRight: 3, display: 'inline' }} />Internal</> : <><Globe size={9} style={{ marginRight: 3, display: 'inline' }} />Shared</>}</span>
                      </div>
                    </div>
                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button onClick={e => toggleStar(doc.id, e)} style={{ background: 'none', border: 'none', padding: 5, cursor: 'pointer', color: doc.starred ? '#f59e0b' : 'var(--tx-3)' }} title="Star">
                        <Star size={14} fill={doc.starred ? 'currentColor' : 'none'} />
                      </button>
                      <button onClick={e => openEdit(doc, e)} style={{ background: 'none', border: 'none', padding: 5, cursor: 'pointer', color: 'var(--tx-3)' }} title="Edit">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={e => deleteDoc(doc, e)} style={{ background: 'none', border: 'none', padding: 5, cursor: 'pointer', color: 'var(--tx-3)' }} title="Delete">
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <ChevronRight size={14} style={{ color: 'var(--tx-3)', flexShrink: 0 }} />
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          // ── Doc Viewer ──
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => setSelectedDoc(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--tx-2)' }}><ArrowLeft size={18} /></button>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedDoc.title}</h2>
              <button onClick={e => toggleStar(selectedDoc.id, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: selectedDoc.starred ? '#f59e0b' : 'var(--tx-3)', padding: 4 }}>
                <Star size={16} fill={selectedDoc.starred ? 'currentColor' : 'none'} />
              </button>
              <button className="btn-ghost btn-sm" onClick={e => openEdit(selectedDoc, e)}><Edit2 size={13} /> Edit</button>
              <button className="btn-ghost btn-sm" onClick={e => deleteDoc(selectedDoc, e)} style={{ color: '#ef4444' }}><Trash2 size={13} /> Delete</button>
            </div>

            {/* Meta */}
            <div style={{ padding: '12px 20px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)', display: 'flex', gap: 24 }}>
              {[['Author', selectedDoc.author], ['Updated', selectedDoc.lastUpdated], ['Folder', selectedDoc.category]].map(([lbl, val]) => (
                <div key={lbl}>
                  <span style={{ fontSize: 10, color: 'var(--tx-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 2 }}>{lbl}</span>
                  <span style={{ fontSize: 13, color: 'var(--tx-1)', fontWeight: 500 }}>{val}</span>
                </div>
              ))}
              <div>
                <span style={{ fontSize: 10, color: 'var(--tx-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 2 }}>Access</span>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4, ...ACCESS_STYLES[selectedDoc.access] }}>{selectedDoc.access}</span>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
              <div style={{ color: 'var(--tx-1)', lineHeight: 1.75, fontSize: 14, maxWidth: 740 }} dangerouslySetInnerHTML={{ __html: selectedDoc.body }} />
            </div>
          </div>
        )}
      </div>

      {/* ── Create / Edit Modal ── */}
      {showEditor && (
        <div className="modal-overlay" onClick={() => setShowEditor(false)}>
          <div className="modal-box" style={{ width: 620, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{editingDoc ? 'Edit Document' : 'New Document'}</h3>
              <button onClick={() => setShowEditor(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-2)' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', flex: 1 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Title *</label>
                <input className="input-field" placeholder="Document title..." value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} autoFocus />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Folder</label>
                  <select className="input-field" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                    {folders.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Access</label>
                  <select className="input-field" value={form.access} onChange={e => setForm(p => ({ ...p, access: e.target.value }))}>
                    <option value="internal">Internal</option>
                    <option value="shared">Shared (clients can see)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Body * <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(HTML supported)</span></label>
                <textarea
                  className="input-field"
                  rows={12}
                  placeholder="Write the document content here... HTML tags like <h3>, <p>, <ul>, <li>, <strong> are supported."
                  value={form.body}
                  onChange={e => setForm(p => ({ ...p, body: e.target.value }))}
                  style={{ fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
                <button className="btn-ghost" onClick={() => setShowEditor(false)}>Cancel</button>
                <button className="btn-primary" onClick={saveDoc}>{editingDoc ? 'Save Changes' : 'Create Document'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
