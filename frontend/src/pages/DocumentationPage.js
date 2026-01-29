import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { 
  FileText, 
  Download, 
  ArrowLeft, 
  FileDown,
  Loader2,
  AlertCircle,
  Clock,
  Package,
  FileType,
  File
} from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

export default function DocumentationPage() {
  const navigate = useNavigate();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastModified, setLastModified] = useState(null);
  const [downloadingMd, setDownloadingMd] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [docPackFiles, setDocPackFiles] = useState([]);
  const [loadingDocPack, setLoadingDocPack] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState(null);

  useEffect(() => {
    fetchDocumentation();
    fetchDocPack();
  }, []);

  const fetchDocPack = async () => {
    try {
      setLoadingDocPack(true);
      const res = await axios.get(`${API}/api/documentation/system-docs-pack`);
      setDocPackFiles(res.data.files || []);
    } catch (err) {
      console.error('Error fetching doc pack:', err);
    } finally {
      setLoadingDocPack(false);
    }
  };

  const downloadDocPackFile = async (file) => {
    try {
      setDownloadingFile(file.filename);
      const res = await axios.get(`${API}${file.path}`, {
        responseType: 'blob'
      });
      
      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success(`${file.filename} downloaded`);
    } catch (err) {
      console.error('Error downloading file:', err);
      toast.error(`Failed to download ${file.filename}`);
    } finally {
      setDownloadingFile(null);
    }
  };

  const getFileIcon = (format) => {
    switch (format) {
      case 'pdf': return <FileDown className="h-5 w-5 text-red-500" />;
      case 'docx': return <FileType className="h-5 w-5 text-blue-500" />;
      case 'html': return <FileText className="h-5 w-5 text-orange-500" />;
      case 'md': return <File className="h-5 w-5 text-slate-500" />;
      default: return <File className="h-5 w-5 text-slate-500" />;
    }
  };

  const fetchDocumentation = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await axios.get(`${API}/api/documentation/system-logic-snapshot`);
      setContent(res.data.content);
      setLastModified(res.data.last_modified);
    } catch (err) {
      console.error('Error fetching documentation:', err);
      setError(err.response?.data?.detail || 'Failed to load documentation');
    } finally {
      setLoading(false);
    }
  };

  const downloadMarkdown = async () => {
    try {
      setDownloadingMd(true);
      const res = await axios.get(`${API}/api/documentation/system-logic-snapshot/download?format=md`, {
        responseType: 'blob'
      });
      
      const blob = new Blob([res.data], { type: 'text/markdown' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'System_Logic_Snapshot.md';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('Markdown file downloaded');
    } catch (err) {
      console.error('Error downloading markdown:', err);
      toast.error('Failed to download markdown file');
    } finally {
      setDownloadingMd(false);
    }
  };

  const downloadPdf = async () => {
    try {
      setDownloadingPdf(true);
      
      // Dynamic import of jspdf
      const { jsPDF } = await import('jspdf');
      
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      // Set up font and margins
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      const maxWidth = pageWidth - (margin * 2);
      let yPosition = margin;
      
      // Add title
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('Red Ops - System Logic Snapshot', margin, yPosition);
      yPosition += 10;
      
      // Add date
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generated: ${new Date().toLocaleString()}`, margin, yPosition);
      yPosition += 10;
      
      // Process content line by line
      doc.setFontSize(10);
      const lines = content.split('\n');
      
      for (const line of lines) {
        // Check if we need a new page
        if (yPosition > pageHeight - margin) {
          doc.addPage();
          yPosition = margin;
        }
        
        // Handle headers
        if (line.startsWith('## ')) {
          yPosition += 5;
          doc.setFontSize(14);
          doc.setFont('helvetica', 'bold');
          const headerText = line.replace('## ', '').replace(/\*\*/g, '');
          doc.text(headerText, margin, yPosition);
          yPosition += 8;
          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
        } else if (line.startsWith('### ')) {
          yPosition += 3;
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          const headerText = line.replace('### ', '').replace(/\*\*/g, '');
          doc.text(headerText, margin, yPosition);
          yPosition += 7;
          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
        } else if (line.startsWith('# ')) {
          yPosition += 8;
          doc.setFontSize(16);
          doc.setFont('helvetica', 'bold');
          const headerText = line.replace('# ', '').replace(/\*\*/g, '');
          doc.text(headerText, margin, yPosition);
          yPosition += 10;
          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
        } else if (line.startsWith('|')) {
          // Table row - simplified handling
          const cleanLine = line.replace(/\|/g, ' | ').replace(/\*\*/g, '').trim();
          const splitLines = doc.splitTextToSize(cleanLine, maxWidth);
          for (const splitLine of splitLines) {
            if (yPosition > pageHeight - margin) {
              doc.addPage();
              yPosition = margin;
            }
            doc.text(splitLine, margin, yPosition);
            yPosition += 5;
          }
        } else if (line.startsWith('- ') || line.startsWith('* ')) {
          // Bullet point
          const bulletText = '• ' + line.substring(2).replace(/\*\*/g, '');
          const splitLines = doc.splitTextToSize(bulletText, maxWidth - 5);
          for (const splitLine of splitLines) {
            if (yPosition > pageHeight - margin) {
              doc.addPage();
              yPosition = margin;
            }
            doc.text(splitLine, margin + 3, yPosition);
            yPosition += 5;
          }
        } else if (line.startsWith('```')) {
          // Code block marker - skip
          continue;
        } else if (line.trim() === '---') {
          // Horizontal rule
          yPosition += 3;
          doc.line(margin, yPosition, pageWidth - margin, yPosition);
          yPosition += 5;
        } else if (line.trim()) {
          // Regular text
          const cleanLine = line.replace(/\*\*/g, '').replace(/`/g, '');
          const splitLines = doc.splitTextToSize(cleanLine, maxWidth);
          for (const splitLine of splitLines) {
            if (yPosition > pageHeight - margin) {
              doc.addPage();
              yPosition = margin;
            }
            doc.text(splitLine, margin, yPosition);
            yPosition += 5;
          }
        } else {
          // Empty line
          yPosition += 3;
        }
      }
      
      // Save the PDF
      doc.save('System_Logic_Snapshot.pdf');
      toast.success('PDF file downloaded');
    } catch (err) {
      console.error('Error generating PDF:', err);
      toast.error('Failed to generate PDF file');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return 'Unknown';
    try {
      return new Date(isoString).toLocaleString();
    } catch {
      return isoString;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" data-testid="documentation-loading">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#A2182C] mx-auto mb-2" />
          <p className="text-slate-500">Loading documentation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6" data-testid="documentation-error">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/settings')}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Settings
          </Button>
        </div>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-red-700 mb-2">Error Loading Documentation</h3>
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={fetchDocumentation} variant="outline">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="documentation-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/settings')}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <FileText className="text-[#A2182C]" />
              System Documentation
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              System Logic Snapshot for UAT and reference
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={downloadMarkdown}
            disabled={downloadingMd}
            data-testid="download-md-btn"
          >
            {downloadingMd ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Download .md
          </Button>
          <Button
            onClick={downloadPdf}
            disabled={downloadingPdf}
            className="bg-[#A2182C] hover:bg-[#8a1526]"
            data-testid="download-pdf-btn"
          >
            {downloadingPdf ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4 mr-2" />
            )}
            Download PDF
          </Button>
        </div>
      </div>

      {/* Last Modified Info */}
      {lastModified && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Clock className="h-4 w-4" />
          Last updated: {formatDate(lastModified)}
        </div>
      )}

      {/* System Documentation Pack - Download Center */}
      {docPackFiles.length > 0 && (
        <Card className="border-emerald-200 bg-emerald-50" data-testid="doc-pack-section">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-emerald-800">
              <Package className="h-5 w-5" />
              System Documentation Pack
            </CardTitle>
            <CardDescription className="text-emerald-700">
              Complete documentation bundle ready for download (PDF, DOCX, Markdown, HTML)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {docPackFiles.map((file) => (
                <button
                  key={file.filename}
                  onClick={() => downloadDocPackFile(file)}
                  disabled={downloadingFile === file.filename}
                  className="flex items-center gap-3 p-4 bg-white rounded-lg border border-emerald-200 hover:border-emerald-400 hover:shadow-md transition-all text-left disabled:opacity-50"
                  data-testid={`download-${file.format}-btn`}
                >
                  {downloadingFile === file.filename ? (
                    <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
                  ) : (
                    getFileIcon(file.format)
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 truncate text-sm">
                      {file.format.toUpperCase()}
                    </p>
                    <p className="text-xs text-slate-500">{file.size_kb} KB</p>
                  </div>
                  <Download className="h-4 w-4 text-slate-400" />
                </button>
              ))}
            </div>
            {loadingDocPack && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Documentation Content */}
      <Card data-testid="documentation-content">
        <CardContent className="p-6 prose prose-slate max-w-none prose-headings:text-slate-900 prose-h1:text-2xl prose-h2:text-xl prose-h2:border-b prose-h2:pb-2 prose-h2:mb-4 prose-h3:text-lg prose-table:text-sm prose-th:bg-slate-100 prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2 prose-td:border prose-th:border prose-code:bg-slate-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-[#A2182C] prose-code:before:content-none prose-code:after:content-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content}
          </ReactMarkdown>
        </CardContent>
      </Card>
    </div>
  );
}
