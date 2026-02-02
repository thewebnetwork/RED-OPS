import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { 
  Plus, 
  Edit,
  Trash2,
  FolderTree,
  Tag,
  Video,
  Lightbulb,
  Bug,
  FileText
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const iconOptions = [
  { value: 'video', label: 'Video', icon: Video },
  { value: 'lightbulb', label: 'Lightbulb', icon: Lightbulb },
  { value: 'bug', label: 'Bug', icon: Bug },
  { value: 'file', label: 'File', icon: FileText },
];

const getIcon = (iconName) => {
  const found = iconOptions.find(i => i.value === iconName);
  return found ? found.icon : FileText;
};

export default function Categories() {
  const { t, i18n } = useTranslation();
  const [categoriesL1, setCategoriesL1] = useState([]);
  const [categoriesL2, setCategoriesL2] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedL1, setSelectedL1] = useState(null);
  const [hasFormChanges, setHasFormChanges] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const initialFormRef = useRef(null);
  
  // Helper function to get translated category name
  const getCategoryName = (category) => {
    const lang = i18n.language || 'en';
    // Check if category has language-specific name
    if (category[`name_${lang}`]) {
      return category[`name_${lang}`];
    }
    // Fallback to default name
    return category.name;
  };
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState('l1'); // 'l1' or 'l2'
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    name_en: '',
    name_pt: '',
    name_es: '',
    description: '',
    icon: 'file',
    category_l1_id: '',
    triggers_editor_workflow: false
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  // Track form changes
  useEffect(() => {
    if (initialFormRef.current) {
      const changed = JSON.stringify(formData) !== JSON.stringify(initialFormRef.current);
      setHasFormChanges(changed);
    }
  }, [formData]);

  // Browser beforeunload warning
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasFormChanges && dialogOpen) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes.';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasFormChanges, dialogOpen]);

  const handleDialogClose = (open) => {
    if (!open && hasFormChanges) {
      setShowUnsavedWarning(true);
      return;
    }
    setDialogOpen(open);
    if (!open) {
      setHasFormChanges(false);
      initialFormRef.current = null;
    }
  };

  const confirmCloseDialog = () => {
    setShowUnsavedWarning(false);
    setDialogOpen(false);
    setHasFormChanges(false);
    initialFormRef.current = null;
  };

  useEffect(() => {
    if (selectedL1) {
      fetchCategoriesL2(selectedL1);
    } else {
      setCategoriesL2([]);
    }
  }, [selectedL1]);

  const fetchCategories = async () => {
    try {
      const res = await axios.get(`${API}/categories/l1`);
      setCategoriesL1(res.data);
      if (res.data.length > 0 && !selectedL1) {
        setSelectedL1(res.data[0].id);
      }
    } catch (error) {
      toast.error(t('errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  const fetchCategoriesL2 = async (l1Id) => {
    try {
      const res = await axios.get(`${API}/categories/l2?category_l1_id=${l1Id}`);
      setCategoriesL2(res.data);
    } catch (error) {
      console.error('Failed to load L2 categories');
    }
  };

  const openDialog = (type, category = null) => {
    setDialogType(type);
    setEditingCategory(category);
    
    let initialData;
    if (category) {
      initialData = {
        name: category.name,
        name_en: category.name_en || '',
        name_pt: category.name_pt || '',
        name_es: category.name_es || '',
        description: category.description || '',
        icon: category.icon || 'file',
        category_l1_id: category.category_l1_id || '',
        triggers_editor_workflow: category.triggers_editor_workflow || false
      };
    } else {
      initialData = {
        name: '',
        name_en: '',
        name_pt: '',
        name_es: '',
        description: '',
        icon: 'file',
        category_l1_id: selectedL1 || '',
        triggers_editor_workflow: false
      };
    }
    setFormData(initialData);
    initialFormRef.current = initialData;
    setHasFormChanges(false);
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) {
      toast.error(t('errors.validation'));
      return;
    }

    try {
      if (dialogType === 'l1') {
        const payload = {
          name: formData.name,
          name_en: formData.name_en || null,
          name_pt: formData.name_pt || null,
          name_es: formData.name_es || null,
          description: formData.description || null,
          icon: formData.icon
        };
        
        if (editingCategory) {
          await axios.patch(`${API}/categories/l1/${editingCategory.id}`, payload);
          toast.success(t('success.updated'));
        } else {
          await axios.post(`${API}/categories/l1`, payload);
          toast.success(t('success.created'));
        }
        fetchCategories();
      } else {
        if (!formData.category_l1_id) {
          toast.error(t('errors.validation'));
          return;
        }
        
        const payload = {
          name: formData.name,
          name_en: formData.name_en || null,
          name_pt: formData.name_pt || null,
          name_es: formData.name_es || null,
          category_l1_id: formData.category_l1_id,
          description: formData.description || null,
          triggers_editor_workflow: formData.triggers_editor_workflow
        };
        
        if (editingCategory) {
          await axios.patch(`${API}/categories/l2/${editingCategory.id}`, payload);
          toast.success(t('success.updated'));
        } else {
          await axios.post(`${API}/categories/l2`, payload);
          toast.success(t('success.created'));
        }
        fetchCategoriesL2(selectedL1);
      }
      setHasFormChanges(false);
      initialFormRef.current = null;
      setDialogOpen(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || t('errors.generic'));
    }
  };

  const handleDelete = async (type, id) => {
    if (!window.confirm(t('categories.confirmDeactivate'))) return;
    
    try {
      if (type === 'l1') {
        await axios.delete(`${API}/categories/l1/${id}`);
        fetchCategories();
      } else {
        await axios.delete(`${API}/categories/l2/${id}`);
        fetchCategoriesL2(selectedL1);
      }
      toast.success(t('categories.categoryDeactivated'));
    } catch (error) {
      toast.error(t('categories.failedToDelete'));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-rose-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="categories-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('categories.title')}</h1>
          <p className="text-slate-500 mt-1">{t('categories.description')}</p>
        </div>
        <Button 
          className="bg-rose-600 hover:bg-rose-700"
          onClick={() => openDialog('l1')}
          data-testid="add-category-l1-btn"
        >
          <Plus size={18} className="mr-2" />
          {t('categories.addCategory')}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Level 1 Categories */}
        <Card className="border-slate-200">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <FolderTree size={18} className="text-rose-600" />
              {t('categories.level1Categories')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {categoriesL1.length === 0 ? (
              <div className="p-6 text-center text-slate-500">
                {t('categories.noCategoriesYet')}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {categoriesL1.map(cat => {
                  const Icon = getIcon(cat.icon);
                  return (
                    <div 
                      key={cat.id}
                      className={`flex items-center gap-3 p-4 cursor-pointer transition-colors ${
                        selectedL1 === cat.id ? 'bg-rose-50 border-l-2 border-rose-600' : 'hover:bg-slate-50'
                      }`}
                      onClick={() => setSelectedL1(cat.id)}
                      data-testid={`category-l1-${cat.id}`}
                    >
                      <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                        <Icon size={16} className="text-slate-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 truncate">{cat.name}</p>
                        {cat.description && (
                          <p className="text-xs text-slate-500 truncate">{cat.description}</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => { e.stopPropagation(); openDialog('l1', cat); }}
                        >
                          <Edit size={14} />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-7 w-7 text-red-500"
                          onClick={(e) => { e.stopPropagation(); handleDelete('l1', cat.id); }}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Level 2 Categories */}
        <div className="lg:col-span-2">
          <Card className="border-slate-200">
            <CardHeader className="border-b border-slate-100 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Tag size={18} className="text-rose-600" />
                  {t('categories.subcategories')}
                  {selectedL1 && (
                    <Badge variant="outline" className="ml-2">
                      {categoriesL1.find(c => c.id === selectedL1)?.name}
                    </Badge>
                  )}
                </CardTitle>
                {selectedL1 && (
                  <Button 
                    size="sm"
                    variant="outline"
                    onClick={() => openDialog('l2')}
                    data-testid="add-category-l2-btn"
                  >
                    <Plus size={14} className="mr-1" />
                    {t('categories.addSubcategory')}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {!selectedL1 ? (
                <div className="p-12 text-center text-slate-500">
                  {t('categories.selectCategoryToViewSub')}
                </div>
              ) : categoriesL2.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  {t('categories.noSubcategoriesYet')}
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {categoriesL2.map(cat => (
                    <div 
                      key={cat.id}
                      className="flex items-center gap-3 p-4 hover:bg-slate-50"
                      data-testid={`category-l2-${cat.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-900">{cat.name}</p>
                        </div>
                        {cat.description && (
                          <p className="text-sm text-slate-500 mt-1">{cat.description}</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openDialog('l2', cat)}
                        >
                          <Edit size={14} />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-7 w-7 text-red-500"
                          onClick={() => handleDelete('l2', cat.id)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? t('common.edit') : t('common.create')} {dialogType === 'l1' ? t('categories.title') : t('categories.subcategory')}
            </DialogTitle>
            <DialogDescription>
              {dialogType === 'l1' 
                ? t('categories.level1Description') 
                : t('categories.level2Description')
              }
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>{t('common.name')} * ({t('categories.defaultName')})</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder={t('categories.categoryName')}
                className="mt-1.5"
                data-testid="category-name-input"
              />
            </div>
            
            {/* Multi-language name fields */}
            <div className="border rounded-lg p-3 space-y-3 bg-slate-50">
              <p className="text-xs font-semibold text-slate-600 uppercase">{t('categories.translations')}</p>
              <div>
                <Label className="flex items-center gap-2">
                  <span>🇺🇸</span> English
                </Label>
                <Input
                  value={formData.name_en}
                  onChange={(e) => setFormData(prev => ({ ...prev, name_en: e.target.value }))}
                  placeholder="English name"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="flex items-center gap-2">
                  <span>🇧🇷</span> Português
                </Label>
                <Input
                  value={formData.name_pt}
                  onChange={(e) => setFormData(prev => ({ ...prev, name_pt: e.target.value }))}
                  placeholder="Nome em português"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="flex items-center gap-2">
                  <span>🇪🇸</span> Español
                </Label>
                <Input
                  value={formData.name_es}
                  onChange={(e) => setFormData(prev => ({ ...prev, name_es: e.target.value }))}
                  placeholder="Nombre en español"
                  className="mt-1"
                />
              </div>
            </div>
            
            <div>
              <Label>{t('common.description')}</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder={t('common.optional')}
                className="mt-1.5"
              />
            </div>

            {dialogType === 'l1' && (
              <div>
                <Label>{t('categories.icon')}</Label>
                <Select 
                  value={formData.icon} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, icon: v }))}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {iconOptions.map(opt => {
                      const Icon = opt.icon;
                      return (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="flex items-center gap-2">
                            <Icon size={14} />
                            {opt.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}

            {dialogType === 'l2' && (
              <>
                <div>
                  <Label>{t('categories.parentCategory')} {editingCategory && <span className="text-xs text-slate-500 ml-1">({t('categories.changeToMove')})</span>}</Label>
                  <Select 
                    value={formData.category_l1_id} 
                    onValueChange={(v) => setFormData(prev => ({ ...prev, category_l1_id: v }))}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder={t('categories.selectParent')} />
                    </SelectTrigger>
                    <SelectContent>
                      {categoriesL1.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{getCategoryName(cat)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {editingCategory && formData.category_l1_id !== editingCategory.category_l1_id && (
                    <p className="text-xs text-amber-600 mt-1">
                      {t('categories.subcategoryWillBeMoved')}
                    </p>
                  )}
                </div>
              </>
            )}

            <Button type="submit" className="w-full bg-rose-600 hover:bg-rose-700" data-testid="save-category-btn">
              {editingCategory ? t('common.save') : t('common.create')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Unsaved Changes Warning Dialog */}
      <AlertDialog open={showUnsavedWarning} onOpenChange={setShowUnsavedWarning}>
        <AlertDialogContent data-testid="unsaved-changes-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('categories.unsavedChanges')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('categories.unsavedChangesDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowUnsavedWarning(false)} data-testid="stay-btn">
              {t('categories.stay')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmCloseDialog}
              className="bg-slate-600 hover:bg-slate-700"
              data-testid="leave-btn"
            >
              {t('categories.leaveWithoutSaving')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
