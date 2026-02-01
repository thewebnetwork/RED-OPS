import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
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
import { Plus, Search, Edit, Trash2, Briefcase, Users } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function SpecialtiesAdmin() {
  const [specialties, setSpecialties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSpecialty, setEditingSpecialty] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [specialtyToDelete, setSpecialtyToDelete] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#6366F1'
  });

  useEffect(() => {
    fetchSpecialties();
  }, []);

  const fetchSpecialties = async () => {
    try {
      const response = await axios.get(`${API}/specialties`);
      setSpecialties(response.data);
    } catch (error) {
      toast.error('Failed to fetch specialties');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (specialty = null) => {
    if (specialty) {
      setEditingSpecialty(specialty);
      setFormData({
        name: specialty.name,
        description: specialty.description || '',
        color: specialty.color || '#6366F1'
      });
    } else {
      setEditingSpecialty(null);
      setFormData({ name: '', description: '', color: '#6366F1' });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }

    try {
      if (editingSpecialty) {
        await axios.patch(`${API}/specialties/${editingSpecialty.id}`, formData);
        toast.success('Specialty updated');
      } else {
        await axios.post(`${API}/specialties`, formData);
        toast.success('Specialty created');
      }
      setDialogOpen(false);
      fetchSpecialties();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save specialty');
    }
  };

  const handleDelete = async () => {
    if (!specialtyToDelete) return;
    try {
      await axios.delete(`${API}/specialties/${specialtyToDelete.id}`);
      toast.success('Specialty deleted');
      setDeleteDialogOpen(false);
      setSpecialtyToDelete(null);
      fetchSpecialties();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete specialty');
    }
  };

  const filteredSpecialties = specialties.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.description || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#A2182C]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="specialties-admin-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Briefcase className="text-[#A2182C]" />
            Specialty Management
          </h1>
          <p className="text-slate-500 mt-1">{specialties.length} specialties defined</p>
        </div>
        <Button
          className="bg-rose-600 hover:bg-rose-700"
          onClick={() => handleOpenDialog()}
          data-testid="add-specialty-btn"
        >
          <Plus size={18} className="mr-2" />
          Add Specialty
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
        <Input
          placeholder="Search specialties..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
          data-testid="specialty-search"
        />
      </div>

      {/* Specialties Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSpecialties.map((specialty) => (
          <Card key={specialty.id} className="hover:shadow-md transition-shadow" data-testid={`specialty-card-${specialty.id}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: specialty.color || '#6366F1' }}
                  >
                    {specialty.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-medium text-slate-900">{specialty.name}</h3>
                    {specialty.description && (
                      <p className="text-sm text-slate-500 line-clamp-1">{specialty.description}</p>
                    )}
                    <div className="flex items-center gap-1 mt-1 text-xs text-slate-400">
                      <Users size={12} />
                      <span>{specialty.user_count || 0} users</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenDialog(specialty)}
                    data-testid={`edit-specialty-${specialty.id}`}
                  >
                    <Edit size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSpecialtyToDelete(specialty);
                      setDeleteDialogOpen(true);
                    }}
                    data-testid={`delete-specialty-${specialty.id}`}
                  >
                    <Trash2 size={16} className="text-red-500" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredSpecialties.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <Briefcase size={48} className="mx-auto mb-4 text-slate-300" />
          <p>No specialties found</p>
          {search && <p className="text-sm mt-1">Try a different search term</p>}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSpecialty ? 'Edit Specialty' : 'Add Specialty'}</DialogTitle>
            <DialogDescription>
              {editingSpecialty ? 'Update specialty details' : 'Create a new specialty for user classification'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Video Editor, Photographer"
                data-testid="specialty-name-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of this specialty"
                data-testid="specialty-description-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="color">Color</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="color"
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-16 h-10 p-1"
                />
                <Input
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  placeholder="#6366F1"
                  className="flex-1"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-rose-600 hover:bg-rose-700" data-testid="save-specialty-btn">
                {editingSpecialty ? 'Save Changes' : 'Create Specialty'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Specialty</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{specialtyToDelete?.name}"?
              {specialtyToDelete?.user_count > 0 && (
                <span className="block mt-2 text-amber-600">
                  Warning: {specialtyToDelete.user_count} users are assigned to this specialty.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
