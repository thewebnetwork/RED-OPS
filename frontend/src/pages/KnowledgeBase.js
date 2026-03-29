/**
 * Knowledge Base — unified entry point for Docs and SOPs
 *
 * Tabs:
 *   • Docs — TipTap rich text editor (from Documents.js)
 *   • SOPs — file browser (from Files.js with knowledge_base context)
 *
 * Tab state is stored in the URL: /knowledge-base?tab=docs or ?tab=sops
 */
import { useSearchParams } from 'react-router-dom';
import Documents from './Documents';
import Files from './Files';
import { BookOpen, FileText } from 'lucide-react';

/**
 * Wrapper that renders Files with ?context=knowledge_base injected into the URL.
 * Files.js reads context from useSearchParams, so we need it in the actual URL.
 */
function SOPsView() {
  // Files component reads searchParams internally — we pass context via a key trick:
  // Render Files and let it read 'context' from the real URL params.
  // The parent KnowledgeBase sets tab=sops, so we append context as well.
  return <Files defaultContext="knowledge_base" />;
}

const TABS = [
  { id: 'docs', label: 'Docs', icon: BookOpen },
  { id: 'sops', label: 'SOPs', icon: FileText },
];

export default function KnowledgeBase() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'docs';

  const setTab = (t) => setSearchParams({ tab: t }, { replace: true });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 0, padding: '0 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px',
                background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
                color: active ? 'var(--accent)' : 'var(--tx-2)',
                fontWeight: active ? 600 : 500, fontSize: 13,
                transition: 'color .15s, border-color .15s',
              }}>
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {tab === 'docs' && <Documents />}
        {tab === 'sops' && <SOPsView />}
      </div>
    </div>
  );
}
