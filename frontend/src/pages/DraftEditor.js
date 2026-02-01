import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { ArrowLeft, Save, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function DraftEditor() {
  const { type, draftId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [draft, setDraft] = useState(null);
  const [formData, setFormData] = useState({});

  useEffect(() => {
    fetchDraft();
  }, [draftId, type]);

  const fetchDraft = async () => {
    try {
      // For editing type drafts, use orders endpoint
      const endpoint = type === 'editing' ? `${API}/orders/${draftId}` : `${API}/${type}-requests/${draftId}`;
      const res = await axios.get(endpoint);
      
      if (res.data.status !== 'Draft') {
        toast.error('This request is not a draft');
        navigate('/command-center');
        return;
      }
      
      setDraft(res.data);
      setFormData(res.data);
    } catch (error) {
      toast.error('Failed to load draft');
      navigate('/command-center');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.title) {
      toast.error('Title is required');
      return;
    }

    setSaving(true);
    try {
      const endpoint = type === 'editing' 
        ? `${API}/orders/${draftId}/draft`
        : `${API}/${type}-requests/${draftId}/draft`;
      
      await axios.put(endpoint, {
        title: formData.title,
        description: formData.description || '',
        category_l1_id: formData.category_l1_id,
        category_l2_id: formData.category_l2_id,
        priority: formData.priority || 'Normal',
        ...(type === 'editing' && {
          video_script: formData.video_script,
          reference_links: formData.reference_links,
          footage_links: formData.footage_links,
          music_preference: formData.music_preference,
          delivery_format: formData.delivery_format,
          special_instructions: formData.special_instructions,
        }),
      });
      
      toast.success('Draft saved');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save draft');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.title) {
      toast.error('Title is required');
      return;
    }
    if (!formData.description) {
      toast.error('Description is required');
      return;
    }

    setSubmitting(true);
    try {
      // First save any changes
      await handleSave();
      
      // Then submit the draft
      const endpoint = type === 'editing' 
        ? `${API}/orders/${draftId}/submit`
        : `${API}/${type}-requests/${draftId}/submit`;
      
      await axios.post(endpoint);
      
      toast.success('Request submitted successfully!');
      navigate('/command-center');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-rose-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!draft) {
    return null;
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="draft-editor-page">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => navigate('/command-center')}
          data-testid="back-btn"
        >
          <ArrowLeft size={20} />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">Edit Draft</h1>
            <Badge className="bg-slate-200 text-slate-600">Draft</Badge>
          </div>
          <p className="text-slate-500 text-sm">{draft.order_code || draft.request_code || draft.report_code}</p>
        </div>
      </div>

      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle>Request Details</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Title */}
          <div>
            <Label>Title *</Label>
            <Input
              value={formData.title || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter a title for your request"
              className="mt-1.5"
              data-testid="draft-title-input"
            />
          </div>

          {/* Description */}
          <div>
            <Label>Description *</Label>
            <Textarea
              value={formData.description || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe your request in detail"
              className="mt-1.5 min-h-[120px]"
              data-testid="draft-description-input"
            />
          </div>

          {/* Priority */}
          <div>
            <Label>Priority</Label>
            <Select 
              value={formData.priority || 'Normal'} 
              onValueChange={(v) => setFormData(prev => ({ ...prev, priority: v }))}
            >
              <SelectTrigger className="mt-1.5" data-testid="draft-priority-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Low">Low</SelectItem>
                <SelectItem value="Normal">Normal</SelectItem>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Editing-specific fields */}
          {type === 'editing' && (
            <>
              <div>
                <Label>Delivery Format</Label>
                <Input
                  value={formData.delivery_format || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, delivery_format: e.target.value }))}
                  placeholder="e.g., 1080p MP4, 9:16 for Instagram"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label>Video Script</Label>
                <Textarea
                  value={formData.video_script || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, video_script: e.target.value }))}
                  placeholder="Paste your video script here..."
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label>Footage Links</Label>
                <Textarea
                  value={formData.footage_links || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, footage_links: e.target.value }))}
                  placeholder="Links to raw footage (Google Drive, Dropbox, etc.)"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label>Reference Links</Label>
                <Textarea
                  value={formData.reference_links || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, reference_links: e.target.value }))}
                  placeholder="Links to example videos or inspiration..."
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label>Music Preference</Label>
                <Input
                  value={formData.music_preference || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, music_preference: e.target.value }))}
                  placeholder="e.g., Upbeat, corporate, link to specific track..."
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label>Special Instructions</Label>
                <Textarea
                  value={formData.special_instructions || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, special_instructions: e.target.value }))}
                  placeholder="Any other details or requirements..."
                  className="mt-1.5"
                />
              </div>
            </>
          )}

          {/* Action Buttons */}
          <div className="sticky bottom-0 pt-4 pb-2 bg-white border-t border-slate-100 flex gap-3">
            <Button 
              type="button" 
              variant="outline" 
              className="flex-1"
              onClick={handleSave}
              disabled={saving || submitting}
              data-testid="save-draft-btn"
            >
              <Save size={16} className="mr-2" />
              {saving ? 'Saving...' : 'Save Draft'}
            </Button>
            <Button 
              type="button" 
              className="flex-1 bg-rose-600 hover:bg-rose-700" 
              onClick={handleSubmit}
              disabled={saving || submitting}
              data-testid="submit-draft-btn"
            >
              <Send size={16} className="mr-2" />
              {submitting ? 'Submitting...' : 'Submit Request'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
