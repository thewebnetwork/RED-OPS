import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Search, 
  Clock, 
  Check, 
  ArrowRight,
  Sparkles,
  FileText,
  Image,
  Video,
  PenTool,
  Megaphone,
  Globe,
  BarChart3,
  Headphones,
  Package
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Icon mapping for service types
const SERVICE_ICONS = {
  'content': FileText,
  'design': PenTool,
  'video': Video,
  'image': Image,
  'marketing': Megaphone,
  'web': Globe,
  'analytics': BarChart3,
  'support': Headphones,
  'default': Package
};

export default function ServiceCatalog() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      // Fetch categories to build service catalog
      const res = await axios.get(`${API}/categories/catalog`);
      setServices(res.data);
    } catch (error) {
      // Fallback to static catalog if endpoint doesn't exist yet
      setServices(getDefaultCatalog());
    } finally {
      setLoading(false);
    }
  };

  // Default catalog for V1 - 8-12 services
  const getDefaultCatalog = () => [
    {
      id: 'content-writing',
      name: t('catalog.services.contentWriting.name', 'Content Writing'),
      description: t('catalog.services.contentWriting.description', 'Blog posts, articles, and web copy crafted for your audience'),
      icon: 'content',
      turnaround: '2-3 days',
      included: true,
      popular: true
    },
    {
      id: 'graphic-design',
      name: t('catalog.services.graphicDesign.name', 'Graphic Design'),
      description: t('catalog.services.graphicDesign.description', 'Social media graphics, banners, and marketing materials'),
      icon: 'design',
      turnaround: '3-5 days',
      included: true,
      popular: true
    },
    {
      id: 'video-editing',
      name: t('catalog.services.videoEditing.name', 'Video Editing'),
      description: t('catalog.services.videoEditing.description', 'Professional video editing for social media and web'),
      icon: 'video',
      turnaround: '5-7 days',
      included: false,
      popular: false
    },
    {
      id: 'social-media',
      name: t('catalog.services.socialMedia.name', 'Social Media Management'),
      description: t('catalog.services.socialMedia.description', 'Content scheduling, posting, and engagement management'),
      icon: 'marketing',
      turnaround: 'Ongoing',
      included: true,
      popular: true
    },
    {
      id: 'seo-optimization',
      name: t('catalog.services.seo.name', 'SEO Optimization'),
      description: t('catalog.services.seo.description', 'On-page SEO, keyword research, and content optimization'),
      icon: 'analytics',
      turnaround: '5-7 days',
      included: false,
      popular: false
    },
    {
      id: 'email-marketing',
      name: t('catalog.services.emailMarketing.name', 'Email Marketing'),
      description: t('catalog.services.emailMarketing.description', 'Email campaigns, newsletters, and automation setup'),
      icon: 'marketing',
      turnaround: '2-4 days',
      included: true,
      popular: false
    },
    {
      id: 'website-updates',
      name: t('catalog.services.websiteUpdates.name', 'Website Updates'),
      description: t('catalog.services.websiteUpdates.description', 'Content updates, minor fixes, and page edits'),
      icon: 'web',
      turnaround: '1-2 days',
      included: true,
      popular: false
    },
    {
      id: 'consultation',
      name: t('catalog.services.consultation.name', 'Strategy Consultation'),
      description: t('catalog.services.consultation.description', '1-on-1 strategy session for your marketing needs'),
      icon: 'support',
      turnaround: 'Scheduled',
      included: false,
      popular: false
    }
  ];

  const filteredServices = services.filter(service => 
    service.name.toLowerCase().includes(search.toLowerCase()) ||
    service.description.toLowerCase().includes(search.toLowerCase())
  );

  const handleStartRequest = (service) => {
    // Navigate to request form with service pre-selected
    navigate(`/request/new?service=${service.id}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-4 border-[#A2182C] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="service-catalog-page">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-900">
          {t('catalog.title', 'Request a Service')}
        </h1>
        <p className="text-slate-500 mt-2">
          {t('catalog.subtitle', 'Browse our services and submit a request in seconds')}
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredServices.map((service) => {
          const IconComponent = SERVICE_ICONS[service.icon] || SERVICE_ICONS.default;
          
          return (
            <Card 
              key={service.id}
              className="group hover:shadow-lg transition-all duration-300 hover:border-[#A2182C]/30 cursor-pointer relative overflow-hidden"
              onClick={() => handleStartRequest(service)}
              data-testid={`service-card-${service.id}`}
            >
              {service.popular && (
                <div className="absolute top-3 right-3">
                  <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                    <Sparkles size={12} className="mr-1" />
                    {t('catalog.popular', 'Popular')}
                  </Badge>
                </div>
              )}
              
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
                  {service.name}
                </h3>
                
                {/* Description */}
                <p className="text-sm text-slate-500 mb-4 line-clamp-2">
                  {service.description}
                </p>
                
                {/* Meta Info */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 text-slate-400">
                    <Clock size={14} />
                    <span>{service.turnaround}</span>
                  </div>
                  
                  {service.included ? (
                    <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">
                      <Check size={12} className="mr-1" />
                      {t('catalog.included', 'Included')}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-slate-500">
                      {t('catalog.addon', 'Add-on')}
                    </Badge>
                  )}
                </div>
                
                {/* CTA */}
                <Button 
                  className="w-full mt-4 bg-[#A2182C] hover:bg-[#8B1526] opacity-0 group-hover:opacity-100 transition-opacity"
                  size="sm"
                  data-testid={`start-request-${service.id}`}
                >
                  {t('catalog.startRequest', 'Start Request')}
                  <ArrowRight size={16} className="ml-2" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredServices.length === 0 && (
        <div className="text-center py-12">
          <Package size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">{t('catalog.noServicesFound', 'No services match your search')}</p>
          <Button 
            variant="link" 
            onClick={() => setSearch('')}
            className="text-[#A2182C]"
          >
            {t('catalog.clearSearch', 'Clear search')}
          </Button>
        </div>
      )}

      {/* Help Text */}
      <div className="text-center text-sm text-slate-400 pt-4">
        {t('catalog.helpText', "Can't find what you need?")}
        {' '}
        <Button 
          variant="link" 
          className="text-[#A2182C] p-0 h-auto"
          onClick={() => navigate('/request/custom')}
        >
          {t('catalog.customRequest', 'Submit a custom request')}
        </Button>
      </div>
    </div>
  );
}
