import { useState, useEffect } from 'react';
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
  const [categoriesL1, setCategoriesL1] = useState([]);
  const [categoriesL2, setCategoriesL2] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedL1, setSelectedL1] = useState(null);
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState('l1'); // 'l1' or 'l2'
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: 'file',
    category_l1_id: '',
    triggers_editor_workflow: false
  });

  useEffect(() => {
    fetchCategories();
  }, []);

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
      toast.error('Failed to load categories');
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
    
    if (category) {
      setFormData({
        name: category.name,
        description: category.description || '',
        icon: category.icon || 'file',
        category_l1_id: category.category_l1_id || '',
        triggers_editor_workflow: category.triggers_editor_workflow || false
      });
    } else {
      setFormData({
        name: '',
        description: '',
        icon: 'file',
        category_l1_id: selectedL1 || '',
        triggers_editor_workflow: false
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) {
      toast.error('Name is required');
      return;
    }

    try {
      if (dialogType === 'l1') {
        const payload = {
          name: formData.name,
          description: formData.description || null,
          icon: formData.icon
        };
        
        if (editingCategory) {
          await axios.patch(`${API}/categories/l1/${editingCategory.id}`, payload);
          toast.success('Category updated');
        } else {
          await axios.post(`${API}/categories/l1`, payload);
          toast.success('Category created');
        }
        fetchCategories();
      } else {
        if (!formData.category_l1_id) {
          toast.error('Please select a parent category');
          return;
        }
        
        const payload = {
          name: formData.name,
          category_l1_id: formData.category_l1_id,
          description: formData.description || null,
          triggers_editor_workflow: formData.triggers_editor_workflow
        };
        
        if (editingCategory) {
          await axios.patch(`${API}/categories/l2/${editingCategory.id}`, payload);
          toast.success('Subcategory updated');
        } else {
          await axios.post(`${API}/categories/l2`, payload);
          toast.success('Subcategory created');
        }
        fetchCategoriesL2(selectedL1);
      }
      setDialogOpen(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Operation failed');
    }
  };

  const handleDelete = async (type, id) => {
    if (!window.confirm('Are you sure you want to deactivate this category?')) return;
    
    try {
      if (type === 'l1') {
        await axios.delete(`${API}/categories/l1/${id}`);
        fetchCategories();
      } else {
        await axios.delete(`${API}/categories/l2/${id}`);
        fetchCategoriesL2(selectedL1);
      }
      toast.success('Category deactivated');
    } catch (error) {
      toast.error('Failed to delete category');
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
          <h1 className="text-2xl font-bold text-slate-900">Categories</h1>
          <p className="text-slate-500 mt-1">Manage request categories (2-level hierarchy)</p>
        </div>
        <Button 
          className="bg-rose-600 hover:bg-rose-700"
          onClick={() => openDialog('l1')}
          data-testid="add-category-l1-btn"
        >
          <Plus size={18} className="mr-2" />
          Add Category
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Level 1 Categories */}
        <Card className="border-slate-200">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <FolderTree size={18} className="text-rose-600" />
              Level 1 Categories
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {categoriesL1.length === 0 ? (
              <div className="p-6 text-center text-slate-500">
                No categories yet
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
                  Subcategories
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
                    Add Subcategory
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {!selectedL1 ? (
                <div className="p-12 text-center text-slate-500">
                  Select a category to view subcategories
                </div>
              ) : categoriesL2.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  No subcategories yet
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
                          {cat.triggers_editor_workflow && (
                            <Badge className="bg-rose-100 text-rose-700 text-xs">
                              Editor Workflow
                            </Badge>
                          )}
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

          {/* Info Card */}
          <Card className="border-slate-200 mt-4">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
                  <Lightbulb size={16} className="text-amber-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-900">About Editor Workflow</p>
                  <p className="text-sm text-slate-500 mt-1">
                    When a subcategory has "Editor Workflow" enabled, requests under that category will be visible 
                    in the Editor's order pool and follow the standard editing workflow (Open → In Progress → Pending → Delivered).
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Edit' : 'Add'} {dialogType === 'l1' ? 'Category' : 'Subcategory'}
            </DialogTitle>
            <DialogDescription>
              {dialogType === 'l1' 
                ? 'Categories are the top level grouping for requests' 
                : 'Subcategories provide specific types under a category'
              }
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Category name"
                className="mt-1.5"
                data-testid="category-name-input"
              />
            </div>
            
            <div>
              <Label>Description</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Optional description"
                className="mt-1.5"
              />
            </div>

            {dialogType === 'l1' && (
              <div>
                <Label>Icon</Label>
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
                  <Label>Parent Category</Label>
                  <Select 
                    value={formData.category_l1_id} 
                    onValueChange={(v) => setFormData(prev => ({ ...prev, category_l1_id: v }))}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Select parent" />
                    </SelectTrigger>
                    <SelectContent>
                      {categoriesL1.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium text-sm">Enable Editor Workflow</p>
                    <p className="text-xs text-slate-500">Requests will go through the editor assignment process</p>
                  </div>
                  <Switch
                    checked={formData.triggers_editor_workflow}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, triggers_editor_workflow: checked }))}
                  />
                </div>
              </>
            )}

            <Button type="submit" className="w-full bg-rose-600 hover:bg-rose-700" data-testid="save-category-btn">
              {editingCategory ? 'Update' : 'Create'} {dialogType === 'l1' ? 'Category' : 'Subcategory'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
