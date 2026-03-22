import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Search, Clock, ArrowRight, ArrowLeft, FileText, Image, Video,
  PenTool, Megaphone, Globe, Package, Phone, Layers,
} from 'lucide-react';
import ServiceRequestForm from '../components/ServiceRequestForm';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SERVICE_ICONS = {
  content: FileText, design: PenTool, video: Video, image: Image,
  marketing: Megaphone, web: Globe, default: Package,
};

const TRACK_LABELS = { DFY_CORE: 'DFY Core', ONE_OFF: 'One-off Services' };

export default function ServiceCatalog() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedService = searchParams.get('service');
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  useEffect(() => { fetchTemplates(); }, []); // eslint-disable-line

  const fetchTemplates = async () => {
    try {
      const res = await axios.get(`${API}/service-templates`);
      const data = Array.isArray(res.data) ? res.data : [];
      setTemplates(data);
      if (preselectedService && data.length > 0) {
        const match = data.find(t => t.id === preselectedService);
        if (match) setSelectedTemplate(match);
      }
    } catch {
      toast.error('Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  const categories = ['All', ...Array.from(
    new Set(templates.map(t => t.category || t.hidden_category_l1).filter(Boolean))
  )];

  const q = search.toLowerCase();
  const filtered = templates.filter(t => {
    const matchSearch = !q || t.name?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q);
    const cat = t.category || t.hidden_category_l1;
    const matchCat = selectedCategory === 'All' || cat === selectedCategory;
    return matchSearch && matchCat;
  });

  const dfyCore = filtered.filter(t => t.offer_track === 'DFY_CORE');
  const oneOff  = filtered.filter(t => t.offer_track === 'ONE_OFF');
  const other   = filtered.filter(t => !t.offer_track || !['DFY_CORE','ONE_OFF'].includes(t.offer_track));

  const groups = [];
  if (oneOff.length)  groups.push({ key:'ONE_OFF',  label: TRACK_LABELS.ONE_OFF, items: oneOff });
  if (other.length)   groups.push({ key:'other',    label: 'Services', items: other });
  if (dfyCore.length) groups.push({ key:'DFY_CORE', label: 'Need more help?', items: dfyCore, secondary: true });

  /* ── Selected template → show request form ── */
  if (selectedTemplate) {
    return (
      <div className="page-content" style={{ maxWidth: 680, margin: '0 auto' }}>
        <button onClick={() => setSelectedTemplate(null)}
          style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color:'var(--tx-3)', background:'none', border:'none', cursor:'pointer', marginBottom:16, padding:0 }}>
          <ArrowLeft size={14}/> Back to services
        </button>
        <h1 style={{ fontSize:22, fontWeight:800, letterSpacing:'-.04em', color:'var(--tx-1)', marginBottom:4 }}>
          {selectedTemplate.name}
        </h1>
        <p style={{ fontSize:13.5, color:'var(--tx-3)', margin:'0 0 20px' }}>{selectedTemplate.description}</p>
        <div className="card" style={{ padding:'24px' }}>
          <ServiceRequestForm template={selectedTemplate} onBack={() => setSelectedTemplate(null)} />
        </div>
      </div>
    );
  }

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="page-content" style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:300 }}>
        <div className="spinner-ring" />
      </div>
    );
  }

  return (
    <div className="page-content">
      {/* Header */}
      <div style={{ textAlign:'center', marginBottom:24 }}>
        <h1 style={{ fontSize:24, fontWeight:800, letterSpacing:'-.04em', color:'var(--tx-1)', marginBottom:6 }}>
          Request a Service
        </h1>
        <p style={{ fontSize:14, color:'var(--tx-3)', margin:0 }}>
          Choose a service below and fill out the tailored form
        </p>
      </div>

      {/* Search */}
      <div style={{ maxWidth:420, margin:'0 auto 20px', position:'relative' }}>
        <Search size={14} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--tx-3)', pointerEvents:'none' }} />
        <input
          type="text"
          placeholder="Search services..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width:'100%', padding:'9px 14px 9px 34px', background:'var(--bg-elevated)',
            border:'1px solid var(--border)', borderRadius:8, color:'var(--tx-1)',
            fontSize:13, outline:'none', boxSizing:'border-box',
          }}
        />
      </div>

      {/* Category pills */}
      {categories.length > 2 && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, justifyContent:'center', marginBottom:24 }}>
          {categories.map(cat => (
            <button key={cat} onClick={() => setSelectedCategory(cat)}
              style={{
                padding:'5px 14px', borderRadius:20, fontSize:12, fontWeight:600, cursor:'pointer',
                border: selectedCategory === cat ? '1px solid var(--red)' : '1px solid var(--border)',
                background: selectedCategory === cat ? 'var(--red)' : 'var(--bg-card)',
                color: selectedCategory === cat ? '#fff' : 'var(--tx-2)',
                transition:'all .12s',
              }}>
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Service groups */}
      {groups.map(group => (
        <div key={group.key} style={{ marginBottom:28 }}>
          {group.secondary ? (
            <div style={{ borderTop:'1px solid var(--border)', paddingTop:20, marginTop:8 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--tx-2)', marginBottom:12 }}>{group.label}</div>
            </div>
          ) : (
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
              <div style={{ width:6, height:6, borderRadius:3, background:'var(--red)' }} />
              <span style={{ fontSize:14, fontWeight:700, color:'var(--tx-1)' }}>{group.label}</span>
            </div>
          )}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:12 }}>
            {group.items.map(template => (
              <ServiceCard key={template.id} template={template} onClick={() => setSelectedTemplate(template)} />
            ))}
          </div>
        </div>
      ))}

      {/* Empty */}
      {filtered.length === 0 && (
        <div style={{ textAlign:'center', padding:'48px 20px' }}>
          <Package size={36} color="var(--tx-3)" style={{ marginBottom:10 }} />
          <p style={{ fontSize:14, color:'var(--tx-3)', margin:'0 0 12px' }}>No services match your search</p>
          <button onClick={() => { setSearch(''); setSelectedCategory('All'); }}
            style={{ fontSize:13, color:'var(--red)', background:'none', border:'none', cursor:'pointer', fontWeight:600 }}>
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}

function ServiceCard({ template, onClick }) {
  const [hov, setHov] = useState(false);
  const Icon = SERVICE_ICONS[template.icon] || SERVICE_ICONS.default;
  const isCall = template.flow_type === 'BOOK_CALL';

  return (
    <div onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        background:'var(--bg-card)', border:`1px solid ${hov ? 'var(--border-hi)' : 'var(--border)'}`,
        borderRadius:10, padding:'18px', cursor:'pointer', transition:'all .15s',
        display:'flex', flexDirection:'column', gap:12,
      }}>
      <div style={{
        width:40, height:40, borderRadius:10,
        background: hov ? 'var(--red)' : '#c92a3e18',
        display:'flex', alignItems:'center', justifyContent:'center', transition:'all .15s',
      }}>
        {isCall
          ? <Phone size={18} style={{ color: hov ? '#fff' : 'var(--red)', transition:'color .15s' }} />
          : <Icon  size={18} style={{ color: hov ? '#fff' : 'var(--red)', transition:'color .15s' }} />
        }
      </div>

      <div>
        <div style={{ fontSize:14, fontWeight:700, color:'var(--tx-1)', marginBottom:3 }}>{template.name}</div>
        <div style={{ fontSize:12, color:'var(--tx-3)', lineHeight:1.5, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
          {template.description}
        </div>
      </div>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:'auto' }}>
        <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'var(--tx-3)' }}>
          <Clock size={12} /> {template.turnaround_text}
        </div>
        <span style={{
          fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:4,
          background: isCall ? '#c92a3e18' : 'var(--bg-elevated)',
          color: isCall ? 'var(--red)' : 'var(--tx-3)',
        }}>
          {isCall ? 'Book a Call' : `${template.form_schema?.length || 0} fields`}
        </span>
      </div>

      <button style={{
        width:'100%', padding:'8px 0', borderRadius:7, fontSize:12, fontWeight:600,
        background: hov ? 'var(--red)' : 'transparent', color: hov ? '#fff' : 'var(--tx-3)',
        border: hov ? 'none' : '1px solid var(--border)',
        cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6,
        transition:'all .15s',
      }}>
        {isCall ? 'Get Started' : 'Start Request'} <ArrowRight size={13} />
      </button>
    </div>
  );
}
