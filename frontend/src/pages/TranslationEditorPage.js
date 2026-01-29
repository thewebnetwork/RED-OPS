import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { 
  ArrowLeft, 
  Languages, 
  Search,
  Save,
  Loader2,
  RotateCcw
} from 'lucide-react';
import { toast } from 'sonner';

// Import the translation files directly
import enTranslations from '../i18n/locales/en.json';
import esTranslations from '../i18n/locales/es.json';
import ptTranslations from '../i18n/locales/pt.json';

// Helper to flatten nested objects into dot notation keys
const flattenObject = (obj, prefix = '') => {
  return Object.keys(obj).reduce((acc, key) => {
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      Object.assign(acc, flattenObject(obj[key], newKey));
    } else {
      acc[newKey] = obj[key];
    }
    return acc;
  }, {});
};

// Helper to unflatten dot notation back to nested object
const unflattenObject = (obj) => {
  const result = {};
  for (const key in obj) {
    const keys = key.split('.');
    let current = result;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) current[keys[i]] = {};
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = obj[key];
  }
  return result;
};

export default function TranslationEditorPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [selectedLang, setSelectedLang] = useState('es');
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [changes, setChanges] = useState({});
  
  // Flatten translations for editing
  const flatEn = useMemo(() => flattenObject(enTranslations), []);
  const flatEs = useMemo(() => flattenObject(esTranslations), []);
  const flatPt = useMemo(() => flattenObject(ptTranslations), []);
  
  const getTargetTranslations = () => {
    if (selectedLang === 'es') return flatEs;
    if (selectedLang === 'pt') return flatPt;
    return flatEn;
  };
  
  const targetTranslations = getTargetTranslations();
  
  // Filter keys based on search
  const filteredKeys = useMemo(() => {
    const allKeys = Object.keys(flatEn);
    if (!searchQuery) return allKeys;
    const query = searchQuery.toLowerCase();
    return allKeys.filter(key => 
      key.toLowerCase().includes(query) || 
      (flatEn[key] && flatEn[key].toLowerCase().includes(query)) ||
      (targetTranslations[key] && targetTranslations[key].toLowerCase().includes(query))
    );
  }, [searchQuery, flatEn, targetTranslations]);
  
  // Group keys by section
  const groupedKeys = useMemo(() => {
    const groups = {};
    filteredKeys.forEach(key => {
      const section = key.split('.')[0];
      if (!groups[section]) groups[section] = [];
      groups[section].push(key);
    });
    return groups;
  }, [filteredKeys]);
  
  const handleTranslationChange = (key, value) => {
    setChanges(prev => ({
      ...prev,
      [selectedLang]: {
        ...(prev[selectedLang] || {}),
        [key]: value
      }
    }));
  };
  
  const getCurrentValue = (key) => {
    if (changes[selectedLang] && changes[selectedLang][key] !== undefined) {
      return changes[selectedLang][key];
    }
    return targetTranslations[key] || '';
  };
  
  const hasChanges = Object.keys(changes).length > 0 && 
    Object.values(changes).some(langChanges => Object.keys(langChanges).length > 0);
  
  const saveTranslations = async () => {
    if (!hasChanges) {
      toast.info(t('settings.translations.noChanges'));
      return;
    }
    
    setSaving(true);
    try {
      // Note: In a production environment, you would send these changes to a backend API
      // For now, we'll just show a success message and explain how to persist changes
      
      // Create updated translation object
      const langChanges = changes[selectedLang] || {};
      const updatedFlat = { ...targetTranslations, ...langChanges };
      const updatedNested = unflattenObject(updatedFlat);
      
      // Log the changes for manual update
      console.log('Updated translations for', selectedLang, ':', JSON.stringify(updatedNested, null, 2));
      
      toast.success(t('settings.translations.translationsSaved'));
      toast.info('Changes logged to console. In production, these would be saved to the server.');
      
      // Reset changes for this language
      setChanges(prev => {
        const newChanges = { ...prev };
        delete newChanges[selectedLang];
        return newChanges;
      });
    } catch (err) {
      console.error('Error saving translations:', err);
      toast.error('Failed to save translations');
    } finally {
      setSaving(false);
    }
  };
  
  const resetToOriginal = (key) => {
    setChanges(prev => {
      const langChanges = { ...(prev[selectedLang] || {}) };
      delete langChanges[key];
      return {
        ...prev,
        [selectedLang]: langChanges
      };
    });
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="translation-editor-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/settings')}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t('common.back')}
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Languages className="text-[#A2182C]" />
              {t('settings.translations.title')}
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              {t('settings.translations.description')}
            </p>
          </div>
        </div>
        
        <Button
          onClick={saveTranslations}
          disabled={saving || !hasChanges}
          className="bg-[#A2182C] hover:bg-[#8a1526]"
          data-testid="save-translations-btn"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {t('settings.translations.saveTranslations')}
        </Button>
      </div>
      
      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="w-full sm:w-48">
              <Label>{t('settings.translations.selectLanguage')}</Label>
              <Select value={selectedLang} onValueChange={setSelectedLang}>
                <SelectTrigger className="mt-1.5" data-testid="language-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="es">🇪🇸 Español</SelectItem>
                  <SelectItem value="pt">🇧🇷 Português</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex-1">
              <Label>{t('settings.translations.searchKeys')}</Label>
              <div className="relative mt-1.5">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <Input
                  placeholder={t('settings.translations.searchKeys')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="search-translations-input"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Info Banner */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <p className="text-sm text-blue-800">
            <strong>{t('common.tip')}:</strong> Edit translations below. Changes are saved in memory and logged to console. 
            For permanent changes, export the translations and update the JSON files.
          </p>
        </CardContent>
      </Card>
      
      {/* Translation Editor */}
      <div className="space-y-6">
        {Object.entries(groupedKeys).map(([section, keys]) => (
          <Card key={section} data-testid={`section-${section}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg capitalize">{section}</CardTitle>
              <CardDescription>{keys.length} keys</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {keys.map(key => {
                  const englishValue = flatEn[key] || '';
                  const currentValue = getCurrentValue(key);
                  const isModified = changes[selectedLang] && changes[selectedLang][key] !== undefined;
                  
                  return (
                    <div 
                      key={key} 
                      className={`p-3 rounded-lg border ${isModified ? 'border-amber-300 bg-amber-50' : 'border-slate-200'}`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <code className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          {key}
                        </code>
                        {isModified && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 px-2 text-xs"
                            onClick={() => resetToOriginal(key)}
                          >
                            <RotateCcw size={12} className="mr-1" />
                            {t('settings.translations.resetToOriginal')}
                          </Button>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-slate-500">{t('settings.translations.english')}</Label>
                          <div className="mt-1 p-2 bg-slate-50 rounded text-sm text-slate-700 min-h-[38px]">
                            {englishValue}
                          </div>
                        </div>
                        
                        <div>
                          <Label className="text-xs text-slate-500">{t('settings.translations.translation')}</Label>
                          {englishValue.length > 100 ? (
                            <Textarea
                              value={currentValue}
                              onChange={(e) => handleTranslationChange(key, e.target.value)}
                              className="mt-1 text-sm"
                              rows={3}
                            />
                          ) : (
                            <Input
                              value={currentValue}
                              onChange={(e) => handleTranslationChange(key, e.target.value)}
                              className="mt-1 text-sm"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Floating save indicator */}
      {hasChanges && (
        <div className="fixed bottom-4 right-4 bg-amber-100 border border-amber-300 rounded-lg p-4 shadow-lg animate-fade-in">
          <p className="text-amber-800 text-sm font-medium">{t('settings.poolRules.unsavedChanges')}</p>
        </div>
      )}
    </div>
  );
}
