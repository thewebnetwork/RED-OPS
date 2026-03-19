import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Settings,
  FolderTree,
  GitBranch,
  Mail,
  Plug,
  Palette,
  ChevronRight,
  FileText,
  Languages,
  LayoutDashboard,
  Search,
  Sliders,
  Globe,
  Bell,
  Shield,
  Database,
  Zap,
  BarChart3,
  Users,
  Tag,
} from 'lucide-react';
import { Input } from '../components/ui/input';

// ── Settings registry ──────────────────────────────────────────────────────────

const SETTINGS_SECTIONS = [
  {
    id: 'platform',
    label: 'Platform',
    icon: Settings,
    items: [
      {
        id: 'dashboards',
        name: 'Dashboards',
        description: 'Build and assign custom dashboards for each role',
        icon: LayoutDashboard,
        path: '/settings/dashboards',
        accent: '#6366F1',
        bg: 'bg-indigo-50',
        iconColor: 'text-indigo-600',
      },
      {
        id: 'categories',
        name: 'Categories',
        description: 'Manage service and ticket classification structure',
        icon: FolderTree,
        path: '/categories',
        accent: '#3B82F6',
        bg: 'bg-blue-50',
        iconColor: 'text-blue-600',
      },
      {
        id: 'workflows',
        name: 'Workflows',
        description: 'Automate status changes, assignments, and notifications',
        icon: GitBranch,
        path: '/workflows',
        accent: '#10B981',
        bg: 'bg-emerald-50',
        iconColor: 'text-emerald-600',
      },
    ],
  },
  {
    id: 'customization',
    label: 'Customization',
    icon: Palette,
    items: [
      {
        id: 'ui-customizations',
        name: 'UI & Branding',
        description: 'Colors, logo, fonts, and white-label appearance',
        icon: Palette,
        path: '/settings/ui',
        accent: '#8B5CF6',
        bg: 'bg-purple-50',
        iconColor: 'text-purple-600',
      },
      {
        id: 'translations',
        name: 'Translations',
        description: 'Localize labels and content for different languages',
        icon: Languages,
        path: '/settings/translations',
        accent: '#F59E0B',
        bg: 'bg-amber-50',
        iconColor: 'text-amber-600',
      },
      {
        id: 'documentation',
        name: 'Documentation',
        description: 'Manage help articles and knowledge base content',
        icon: FileText,
        path: '/settings/documentation',
        accent: '#64748B',
        bg: 'bg-slate-50',
        iconColor: 'text-slate-600',
      },
    ],
  },
  {
    id: 'integrations',
    label: 'Integrations',
    icon: Plug,
    items: [
      {
        id: 'email-settings',
        name: 'Email',
        description: 'Configure sending domains, SMTP, and notification templates',
        icon: Mail,
        path: '/email-settings',
        accent: '#EF4444',
        bg: 'bg-red-50',
        iconColor: 'text-red-600',
      },
      {
        id: 'integrations',
        name: 'Connected Apps',
        description: 'Manage third-party integrations and API connections',
        icon: Plug,
        path: '/integrations',
        accent: '#06B6D4',
        bg: 'bg-cyan-50',
        iconColor: 'text-cyan-600',
      },
    ],
  },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionNav({ sections, active, onSelect }) {
  return (
    <nav className="space-y-1">
      {sections.map((section) => {
        const Icon = section.icon;
        const isActive = active === section.id;
        return (
          <button
            key={section.id}
            onClick={() => onSelect(section.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              isActive
                ? 'bg-[#A2182C]/10 text-[#A2182C]'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
            data-testid={`settings-nav-${section.id}`}
          >
            <Icon size={16} strokeWidth={1.75} />
            {section.label}
            {isActive && (
              <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#A2182C]" />
            )}
          </button>
        );
      })}
    </nav>
  );
}

function SettingsItem({ item, onClick }) {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      data-testid={`settings-${item.id}`}
      className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 bg-white hover:border-[#A2182C]/30 hover:shadow-md transition-all group text-left"
    >
      <div className={`w-11 h-11 rounded-xl ${item.bg} flex items-center justify-center flex-shrink-0`}>
        <Icon size={20} className={item.iconColor} strokeWidth={1.75} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-slate-900 text-sm group-hover:text-[#A2182C] transition-colors">
          {item.name}
        </p>
        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{item.description}</p>
      </div>
      <ChevronRight
        size={16}
        className="text-slate-300 group-hover:text-[#A2182C] group-hover:translate-x-0.5 transition-all flex-shrink-0"
      />
    </button>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function SettingsHub() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState(SETTINGS_SECTIONS[0].id);
  const [search, setSearch] = useState('');

  // Flatten for search
  const allItems = SETTINGS_SECTIONS.flatMap((s) => s.items);

  const isSearching = search.trim().length > 0;
  const searchResults = isSearching
    ? allItems.filter(
        (item) =>
          item.name.toLowerCase().includes(search.toLowerCase()) ||
          item.description.toLowerCase().includes(search.toLowerCase())
      )
    : [];

  const currentSection = SETTINGS_SECTIONS.find((s) => s.id === activeSection);

  return (
    <div className="animate-fade-in" data-testid="settings-hub-page">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Settings size={22} className="text-[#A2182C]" />
          {t('settings.title', 'Settings')}
        </h1>
        <p className="text-slate-500 mt-1 text-sm">
          {t('settings.subtitle', 'Configure your platform, integrations, and branding')}
        </p>
      </div>

      {/* Search bar */}
      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
        <Input
          placeholder="Search settings..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9 text-sm"
          data-testid="settings-search"
        />
      </div>

      {/* Search results */}
      {isSearching ? (
        <div>
          {searchResults.length > 0 ? (
            <div className="grid md:grid-cols-2 gap-3">
              {searchResults.map((item) => (
                <SettingsItem
                  key={item.id}
                  item={item}
                  onClick={() => navigate(item.path)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400">
              <Settings size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No settings found for "{search}"</p>
            </div>
          )}
        </div>
      ) : (
        /* Two-column layout: nav + content */
        <div className="flex gap-6">
          {/* Left nav */}
          <aside className="w-48 flex-shrink-0">
            <div className="sticky top-0">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">
                Sections
              </p>
              <SectionNav
                sections={SETTINGS_SECTIONS}
                active={activeSection}
                onSelect={setActiveSection}
              />
            </div>
          </aside>

          {/* Right content */}
          <div className="flex-1 min-w-0">
            {currentSection && (
              <>
                <div className="mb-4 flex items-center gap-2">
                  <currentSection.icon size={16} className="text-slate-400" strokeWidth={1.75} />
                  <h2 className="text-base font-semibold text-slate-800">{currentSection.label}</h2>
                  <span className="ml-1 text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                    {currentSection.items.length}
                  </span>
                </div>

                <div className="grid md:grid-cols-2 gap-3">
                  {currentSection.items.map((item) => (
                    <SettingsItem
                      key={item.id}
                      item={item}
                      onClick={() => navigate(item.path)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
