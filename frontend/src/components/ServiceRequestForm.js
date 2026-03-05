import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Button } from '../components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Send, Upload, X, File, ArrowLeft, Loader2, ExternalLink, CheckCircle2 } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [
  '.jpg','.jpeg','.png','.gif','.webp','.svg','.bmp',
  '.pdf','.doc','.docx','.xls','.xlsx','.ppt','.pptx','.txt','.rtf','.csv',
  '.mp4','.mov','.avi','.mkv','.webm',
  '.mp3','.wav','.ogg','.m4a',
  '.zip','.rar','.7z'
];

export default function ServiceRequestForm({ template, onBack }) {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [submittedOrderId, setSubmittedOrderId] = useState(null);
  const [formValues, setFormValues] = useState(() => {
    const defaults = {};
    template.form_schema.forEach(field => {
      defaults[field.field] = field.default_value || '';
    });
    defaults._title = template.default_title;
    return defaults;
  });

  const setValue = (key, val) => setFormValues(prev => ({ ...prev, [key]: val }));

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const valid = [];
    for (const file of files) {
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        toast.error(`File type ${ext} is not allowed`);
        continue;
      }
      const currentSize = attachments.reduce((s, f) => s + f.size, 0);
      if (currentSize + file.size > MAX_FILE_SIZE) {
        toast.error('Total file size exceeds 50MB');
        break;
      }
      valid.push(file);
    }
    setAttachments(prev => [...prev, ...valid]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const validate = () => {
    if (!formValues._title?.trim()) {
      toast.error('Please enter a request title');
      return false;
    }
    for (const field of template.form_schema) {
      if (field.required && !formValues[field.field]?.toString().trim()) {
        toast.error(`"${field.label}" is required`);
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const serviceFields = {};
      template.form_schema.forEach(f => {
        if (formValues[f.field]) serviceFields[f.field] = formValues[f.field];
      });

      const priority = serviceFields.priority || 'Normal';
      delete serviceFields.priority;

      const description = template.form_schema
        .filter(f => serviceFields[f.field] && f.field !== 'priority' && f.field !== 'deadline')
        .map(f => {
          const field = template.form_schema.find(s => s.field === f.field);
          return `**${field?.label || f.field}:** ${serviceFields[f.field]}`;
        })
        .join('\n\n');

      const res = await axios.post(`${API}/orders`, {
        title: formValues._title,
        description: description || `${template.name} request`,
        priority,
        service_template_id: template.id,
        service_name: template.name,
        service_fields: serviceFields,
        footage_links: serviceFields.footage_links || null,
        reference_links: serviceFields.reference_links || null,
        special_instructions: serviceFields.special_notes || null,
        delivery_format: serviceFields.delivery_format || null,
        music_preference: serviceFields.music_preference || null,
        video_script: serviceFields.hook_script || null,
      });

      if (attachments.length > 0 && res.data?.id) {
        for (const file of attachments) {
          const fd = new FormData();
          fd.append('file', file);
          try {
            await axios.post(`${API}/orders/${res.data.id}/files/upload`, fd, {
              headers: { 'Content-Type': 'multipart/form-data' }
            });
          } catch (err) {
            console.error('Upload failed:', file.name);
          }
        }
      }

      toast.success('Request submitted successfully!');

      // For BOOK_CALL templates, show CTA instead of navigating
      if (template.flow_type === 'BOOK_CALL') {
        setSubmittedOrderId(res.data.id);
      } else {
        navigate(`/requests/${res.data.id}`);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  const renderField = (field) => {
    const key = field.field;
    const val = formValues[key] || '';

    if (field.type === 'textarea') {
      return (
        <div key={key}>
          <Label className="text-sm font-medium text-slate-700">
            {field.label} {field.required && <span className="text-red-500">*</span>}
          </Label>
          {field.help_text && <p className="text-xs text-slate-400 mt-0.5">{field.help_text}</p>}
          <Textarea
            value={val}
            onChange={(e) => setValue(key, e.target.value)}
            placeholder={field.placeholder || ''}
            className="mt-1.5 min-h-[80px]"
            data-testid={`field-${key}`}
          />
        </div>
      );
    }

    if (field.type === 'select' && field.options) {
      return (
        <div key={key}>
          <Label className="text-sm font-medium text-slate-700">
            {field.label} {field.required && <span className="text-red-500">*</span>}
          </Label>
          <Select value={val} onValueChange={(v) => setValue(key, v)}>
            <SelectTrigger className="mt-1.5" data-testid={`field-${key}`}>
              <SelectValue placeholder={`Select ${field.label.toLowerCase()}...`} />
            </SelectTrigger>
            <SelectContent>
              {field.options.map(opt => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (field.type === 'date') {
      return (
        <div key={key}>
          <Label className="text-sm font-medium text-slate-700">
            {field.label} {field.required && <span className="text-red-500">*</span>}
          </Label>
          <Input
            type="date"
            value={val}
            onChange={(e) => setValue(key, e.target.value)}
            className="mt-1.5"
            data-testid={`field-${key}`}
          />
        </div>
      );
    }

    if (field.type === 'toggle') {
      return (
        <div key={key} className="flex items-center justify-between py-2">
          <Label className="text-sm font-medium text-slate-700">
            {field.label} {field.required && <span className="text-red-500">*</span>}
          </Label>
          <button
            type="button"
            onClick={() => setValue(key, val === 'Yes' ? 'No' : 'Yes')}
            className={`relative w-11 h-6 rounded-full transition-colors ${val === 'Yes' ? 'bg-[#A2182C]' : 'bg-slate-300'}`}
            data-testid={`field-${key}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${val === 'Yes' ? 'translate-x-5' : ''}`} />
          </button>
        </div>
      );
    }

    return (
      <div key={key}>
        <Label className="text-sm font-medium text-slate-700">
          {field.label} {field.required && <span className="text-red-500">*</span>}
        </Label>
        <Input
          value={val}
          onChange={(e) => setValue(key, e.target.value)}
          placeholder={field.placeholder || ''}
          className="mt-1.5"
          data-testid={`field-${key}`}
        />
      </div>
    );
  };

  return (
    <>
      {/* BOOK_CALL post-submit CTA */}
      {submittedOrderId && template.flow_type === 'BOOK_CALL' && (
        <div className="text-center py-8 space-y-6" data-testid="book-call-success">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100">
            <CheckCircle2 size={32} className="text-green-600" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900">Request Submitted</h3>
            <p className="text-slate-500 mt-1">Your request has been logged. Take the next step and book your call.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={template.cta_url}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="book-call-cta-btn"
            >
              <Button className="bg-[#A2182C] hover:bg-[#8B1526] h-11 px-8 text-base">
                <ExternalLink size={18} className="mr-2" />
                {template.cta_label || 'Book a Call'}
              </Button>
            </a>
            <Button
              variant="outline"
              onClick={() => navigate(`/requests/${submittedOrderId}`)}
              data-testid="view-request-btn"
            >
              View Request
            </Button>
          </div>
        </div>
      )}

      {/* Regular form (hidden after BOOK_CALL submit) */}
      {!submittedOrderId && (
    <form onSubmit={handleSubmit} className="space-y-6" data-testid="service-request-form">
      {/* Back + Service Context */}
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" size="sm" onClick={onBack} data-testid="back-to-services-btn">
          <ArrowLeft size={16} className="mr-1" /> Back
        </Button>
        <div className="h-5 w-px bg-slate-200" />
        <span className="text-sm text-slate-500">{template.name}</span>
        {template.turnaround_text && (
          <span className="text-xs text-slate-400 ml-auto">Typical turnaround: {template.turnaround_text}</span>
        )}
      </div>

      {/* Request Title */}
      <div>
        <Label className="text-sm font-medium text-slate-700">
          Request Title <span className="text-red-500">*</span>
        </Label>
        <Input
          value={formValues._title}
          onChange={(e) => setValue('_title', e.target.value)}
          placeholder={template.default_title}
          className="mt-1.5 text-base"
          data-testid="request-title-input"
        />
      </div>

      {/* Service-Specific Fields */}
      <div className="space-y-4">
        {template.form_schema.map(field => renderField(field))}
      </div>

      {/* File Upload */}
      <div>
        <Label className="text-sm font-medium text-slate-700">Attachments</Label>
        <div
          className="mt-1.5 border-2 border-dashed border-slate-200 rounded-lg p-4 text-center hover:border-[#A2182C]/40 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
          data-testid="file-upload-area"
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            accept={ALLOWED_EXTENSIONS.join(',')}
          />
          <Upload size={20} className="mx-auto text-slate-400 mb-1" />
          <p className="text-sm text-slate-600">Click to upload files</p>
          <p className="text-xs text-slate-400">Max 50MB total. Images, docs, videos, archives.</p>
        </div>
        {attachments.length > 0 && (
          <div className="mt-2 space-y-1">
            {attachments.map((file, i) => (
              <div key={i} className="flex items-center gap-2 p-2 bg-slate-50 rounded text-sm">
                <File size={14} className="text-slate-500" />
                <span className="flex-1 truncate text-slate-700">{file.name}</span>
                <span className="text-xs text-slate-400">{(file.size / 1024 / 1024).toFixed(1)}MB</span>
                <button type="button" onClick={() => removeAttachment(i)} className="p-0.5 hover:bg-slate-200 rounded">
                  <X size={14} className="text-slate-400" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Submit */}
      <div className="pt-4 border-t border-slate-100">
        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-[#A2182C] hover:bg-[#8B1526] h-11 text-base"
          data-testid="submit-request-btn"
        >
          {loading ? (
            <><Loader2 size={18} className="mr-2 animate-spin" /> Submitting...</>
          ) : (
            <><Send size={18} className="mr-2" /> Submit Request</>
          )}
        </Button>
      </div>
    </form>
      )}
    </>
  );
}
