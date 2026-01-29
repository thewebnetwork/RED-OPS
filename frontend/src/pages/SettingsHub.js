import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Users
} from 'lucide-react';

const settingsModules = [
  {
    id: 'documentation',
    name: 'System Documentation',
    description: 'View and download system logic snapshot for UAT reference',
    icon: FileText,
    path: '/settings/documentation',
    color: 'bg-slate-100 text-slate-600'
  },
  {
    id: 'pool-picker-rules',
    name: 'Pool Picker Rules',
    description: 'Configure which account types can pick from Pool 1 and Pool 2',
    icon: Users,
    path: '/settings/pool-picker-rules',
    color: 'bg-rose-100 text-rose-600'
  },
  {
    id: 'ui-customizations',
    name: 'UI Customizations',
    description: 'Customize field labels, display names, and branding across the platform',
    icon: Palette,
    path: '/settings/ui',
    color: 'bg-purple-100 text-purple-600'
  },
  {
    id: 'categories',
    name: 'Categories',
    description: 'Manage service categories and subcategories for requests',
    icon: FolderTree,
    path: '/categories',
    color: 'bg-blue-100 text-blue-600'
  },
  {
    id: 'workflows',
    name: 'Workflows',
    description: 'Configure automation workflows and routing rules',
    icon: GitBranch,
    path: '/workflows',
    color: 'bg-emerald-100 text-emerald-600'
  },
  {
    id: 'email-settings',
    name: 'Email Settings',
    description: 'Configure SMTP and email notification templates',
    icon: Mail,
    path: '/email-settings',
    color: 'bg-amber-100 text-amber-600'
  },
  {
    id: 'sla-escalation',
    name: 'SLA & Escalation',
    description: 'Set up service level agreements and escalation policies',
    icon: Shield,
    path: '/sla-policies',
    color: 'bg-rose-100 text-rose-600'
  },
  {
    id: 'integrations',
    name: 'Integrations',
    description: 'Manage API keys, webhooks, and external integrations',
    icon: Plug,
    path: '/integrations',
    color: 'bg-cyan-100 text-cyan-600'
  }
];

export default function SettingsHub() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 animate-fade-in" data-testid="settings-hub-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Settings className="text-[#A2182C]" />
          Settings
        </h1>
        <p className="text-slate-500 mt-1">Configure system settings, workflows, and integrations</p>
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
            <strong>Tip:</strong> Changes to settings may require users to refresh their browser to see updates.
            Some configurations like email templates and webhook URLs take effect immediately.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
