import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { 
  Settings, 
  FolderTree, 
  GitBranch, 
  Mail, 
  Shield, 
  Plug, 
  Palette,
  ChevronRight,
  FileText,
  Users,
  Languages,
  LayoutDashboard
} from 'lucide-react';

const getSettingsModules = (t) => [
  {
    id: 'dashboards',
    name: t('settings.modules.dashboards.name'),
    description: t('settings.modules.dashboards.description'),
    icon: LayoutDashboard,
    path: '/settings/dashboards',
    color: 'bg-rose-100 text-rose-600'
  },
  {
    id: 'documentation',
    name: t('settings.modules.documentation.name'),
    description: t('settings.modules.documentation.description'),
    icon: FileText,
    path: '/settings/documentation',
    color: 'bg-slate-100 text-slate-600'
  },
  {
    id: 'pool-picker-rules',
    name: t('settings.modules.poolPickerRules.name'),
    description: t('settings.modules.poolPickerRules.description'),
    icon: Users,
    path: '/settings/pool-picker-rules',
    color: 'bg-rose-100 text-rose-600'
  },
  {
    id: 'translations',
    name: t('settings.modules.translations.name'),
    description: t('settings.modules.translations.description'),
    icon: Languages,
    path: '/settings/translations',
    color: 'bg-indigo-100 text-indigo-600'
  },
  {
    id: 'ui-customizations',
    name: t('settings.modules.uiCustomizations.name'),
    description: t('settings.modules.uiCustomizations.description'),
    icon: Palette,
    path: '/settings/ui',
    color: 'bg-purple-100 text-purple-600'
  },
  {
    id: 'categories',
    name: t('settings.modules.categories.name'),
    description: t('settings.modules.categories.description'),
    icon: FolderTree,
    path: '/categories',
    color: 'bg-blue-100 text-blue-600'
  },
  {
    id: 'workflows',
    name: t('settings.modules.workflows.name'),
    description: t('settings.modules.workflows.description'),
    icon: GitBranch,
    path: '/workflows',
    color: 'bg-emerald-100 text-emerald-600'
  },
  {
    id: 'email-settings',
    name: t('settings.modules.emailSettings.name'),
    description: t('settings.modules.emailSettings.description'),
    icon: Mail,
    path: '/email-settings',
    color: 'bg-amber-100 text-amber-600'
  },
  {
    id: 'sla-escalation',
    name: t('settings.modules.slaEscalation.name'),
    description: t('settings.modules.slaEscalation.description'),
    icon: Shield,
    path: '/sla-policies',
    color: 'bg-rose-100 text-rose-600'
  },
  {
    id: 'integrations',
    name: t('settings.modules.integrations.name'),
    description: t('settings.modules.integrations.description'),
    icon: Plug,
    path: '/integrations',
    color: 'bg-cyan-100 text-cyan-600'
  }
];

export default function SettingsHub() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const settingsModules = getSettingsModules(t);

  return (
    <div className="space-y-6 animate-fade-in" data-testid="settings-hub-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Settings className="text-[#A2182C]" />
          {t('settings.title')}
        </h1>
        <p className="text-slate-500 mt-1">{t('settings.subtitle')}</p>
      </div>

      {/* Settings Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {settingsModules.map((module) => {
          const Icon = module.icon;
          return (
            <Card 
              key={module.id} 
              className="hover:shadow-md transition-all cursor-pointer group"
              onClick={() => navigate(module.path)}
              data-testid={`settings-${module.id}`}
            >
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${module.color}`}>
                    <Icon size={24} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900 group-hover:text-[#A2182C] transition-colors flex items-center gap-2">
                      {module.name}
                      <ChevronRight size={16} className="text-slate-400 group-hover:translate-x-1 transition-transform" />
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">{module.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Info */}
      <Card className="bg-slate-50 border-slate-200">
        <CardContent className="p-4">
          <p className="text-sm text-slate-600">
            <strong>{t('common.tip')}:</strong> {t('settings.tip')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
