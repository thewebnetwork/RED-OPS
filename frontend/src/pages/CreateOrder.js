import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
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
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CATEGORIES = ["Video Editing", "Reel Batch", "Listing Video", "Marketplace Service", "Videography", "Other"];
const PRIORITIES = ["Low", "Normal", "High", "Urgent"];

export default function CreateOrder() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    category: 'Video Editing',
    priority: 'Normal',
    description: '',
    video_script: '',
    reference_links: '',
    footage_links: '',
    music_preference: '',
    delivery_format: '',
    special_instructions: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title) {
      toast.error('Please enter a title');
      return;
    }
    if (!formData.description) {
      toast.error('Please enter a description');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API}/orders`, formData);
      toast.success('Order created successfully!');
      navigate(`/orders/${res.data.id}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in" data-testid="create-order-page">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/')}>
          <ArrowLeft size={18} className="mr-2" />
          Back
        </Button>
        <h1 className="text-2xl font-bold text-slate-900">New Order Request</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="border-slate-200">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle>Order Details</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {/* Title */}
            <div>
              <Label>Title *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g., Product Launch Video for Acme Corp"
                className="mt-1.5"
                data-testid="title-input"
              />
            </div>

            {/* Category & Priority */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label>Category</Label>
                <Select 
                  value={formData.category} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, category: v }))}
                >
                  <SelectTrigger className="mt-1.5" data-testid="category-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Priority</Label>
                <Select 
                  value={formData.priority} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, priority: v }))}
                >
                  <SelectTrigger className="mt-1.5" data-testid="priority-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Description */}
            <div>
              <Label>Description *</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe what you need..."
                className="mt-1.5 min-h-[100px]"
                data-testid="description-input"
              />
            </div>

            {/* Video Script */}
            <div>
              <Label>Video Script (optional)</Label>
              <Textarea
                value={formData.video_script}
                onChange={(e) => setFormData(prev => ({ ...prev, video_script: e.target.value }))}
                placeholder="Paste your video script here..."
                className="mt-1.5 min-h-[80px]"
              />
            </div>

            {/* Reference Links */}
            <div>
              <Label>Reference Links (optional)</Label>
              <Textarea
                value={formData.reference_links}
                onChange={(e) => setFormData(prev => ({ ...prev, reference_links: e.target.value }))}
                placeholder="Links to example videos or inspiration..."
                className="mt-1.5"
              />
            </div>

            {/* Footage Links */}
            <div>
              <Label>Footage Links (optional)</Label>
              <Textarea
                value={formData.footage_links}
                onChange={(e) => setFormData(prev => ({ ...prev, footage_links: e.target.value }))}
                placeholder="Links to raw footage (Google Drive, Dropbox, etc.)"
                className="mt-1.5"
              />
            </div>

            {/* Music Preference */}
            <div>
              <Label>Music Preference (optional)</Label>
              <Input
                value={formData.music_preference}
                onChange={(e) => setFormData(prev => ({ ...prev, music_preference: e.target.value }))}
                placeholder="e.g., Upbeat, corporate, link to specific track..."
                className="mt-1.5"
              />
            </div>

            {/* Delivery Format */}
            <div>
              <Label>Delivery Format (optional)</Label>
              <Input
                value={formData.delivery_format}
                onChange={(e) => setFormData(prev => ({ ...prev, delivery_format: e.target.value }))}
                placeholder="e.g., 1080p MP4, 9:16 for Instagram, etc."
                className="mt-1.5"
              />
            </div>

            {/* Special Instructions */}
            <div>
              <Label>Special Instructions (optional)</Label>
              <Textarea
                value={formData.special_instructions}
                onChange={(e) => setFormData(prev => ({ ...prev, special_instructions: e.target.value }))}
                placeholder="Any other details or requirements..."
                className="mt-1.5"
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-3 mt-6">
          <Button type="button" variant="outline" onClick={() => navigate('/')}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            className="bg-rose-600 hover:bg-rose-700"
            disabled={loading}
            data-testid="submit-order-btn"
          >
            {loading ? 'Submitting...' : 'Submit Order'}
          </Button>
        </div>
      </form>
    </div>
  );
}
