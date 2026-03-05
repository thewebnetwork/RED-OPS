import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Search,
  Clock,
  ArrowRight,
  Sparkles,
  FileText,
  Image,
  Video,
  PenTool,
  Megaphone,
  Globe,
  Package
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import ServiceRequestForm from '../components/ServiceRequestForm';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SERVICE_ICONS = {
  'content': FileText,
  'design': PenTool,
  'video': Video,
  'image': Image,
  'marketing': Megaphone,
  'web': Globe,
  'default': Package
};

export default function ServiceCatalog() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const preselectedService = searchParams.get('service');

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await axios.get(`${API}/service-templates`);
      setTemplates(res.data);

      // Handle preselected service from URL
      if (preselectedService && res.data.length > 0) {
        const match = res.data.find(t => t.id === preselectedService);
        if (match) setSelectedTemplate(match);
      }
    } catch (error) {
      console.error('Failed to fetch service templates:', error);
      toast.error('Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  const filtered = templates.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.description.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-4 border-[#A2182C] border-t-transparent rounded-full" />
      </div>
    );
  }

  // If a service is selected, show the tailored form
  if (selectedTemplate) {
    return (
      <div className="max-w-2xl mx-auto animate-fade-in" data-testid="service-request-page">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900" data-testid="form-heading">
            {selectedTemplate.name}
          </h1>
          <p className="text-slate-500 mt-1">{selectedTemplate.description}</p>
        </div>
        <Card className="border-slate-200">
          <CardContent className="p-6">
            <ServiceRequestForm
              template={selectedTemplate}
              onBack={() => setSelectedTemplate(null)}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Service catalog grid
  return (
    <div className="space-y-6 animate-fade-in" data-testid="service-catalog-page">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-900">
          {t('catalog.title', 'Request a Service')}
        </h1>
        <p className="text-slate-500 mt-2">
          {t('catalog.subtitle', 'Choose a service below and fill out the tailored form')}
        </p>
      </div>

      {/* Search */}
      <div className="max-w-md mx-auto">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <Input
            placeholder={t('catalog.searchPlaceholder', 'Search services...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            data-testid="catalog-search"
          />
        </div>
      </div>

      {/* Service Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((template) => {
          const IconComponent = SERVICE_ICONS[template.icon] || SERVICE_ICONS.default;
          return (
            <Card
              key={template.id}
              className="group hover:shadow-lg transition-all duration-300 hover:border-[#A2182C]/30 cursor-pointer relative overflow-hidden"
              onClick={() => setSelectedTemplate(template)}
              data-testid={`service-card-${template.id}`}
            >
              <CardContent className="p-5">
                {/* Icon */}
                <div className="w-12 h-12 rounded-xl bg-[#A2182C]/10 flex items-center justify-center mb-4 group-hover:bg-[#A2182C] transition-colors">
                  <IconComponent
                    size={24}
                    className="text-[#A2182C] group-hover:text-white transition-colors"
                  />
                </div>

                {/* Service Name */}
                <h3 className="font-semibold text-slate-900 mb-1 group-hover:text-[#A2182C] transition-colors">
                  {template.name}
                </h3>

                {/* Description */}
                <p className="text-sm text-slate-500 mb-4 line-clamp-2">
                  {template.description}
                </p>

                {/* Meta */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 text-slate-400">
                    <Clock size={14} />
                    <span>{template.turnaround_text}</span>
                  </div>
                  <Badge variant="outline" className="text-slate-500">
                    {template.form_schema?.length || 0} fields
                  </Badge>
                </div>

                {/* CTA */}
                <Button
                  className="w-full mt-4 bg-[#A2182C] hover:bg-[#8B1526] opacity-0 group-hover:opacity-100 transition-opacity"
                  size="sm"
                  data-testid={`start-request-${template.id}`}
                >
                  Start Request
                  <ArrowRight size={16} className="ml-2" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Empty State */}
      {filtered.length === 0 && (
        <div className="text-center py-12">
          <Package size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">No services match your search</p>
          <Button variant="link" onClick={() => setSearch('')} className="text-[#A2182C]">
            Clear search
          </Button>
        </div>
      )}
    </div>
  );
}
