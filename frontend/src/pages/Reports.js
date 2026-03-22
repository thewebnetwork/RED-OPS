import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  BarChart3,
  Download,
  FileText,
  Filter,
  RefreshCw,
  FileSpreadsheet,
  FileType,
  Calendar,
  Search,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Users,
  Layers,
  Building2
} from 'lucide-react';
import { toast } from 'sonner';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Brand colors for PDF
const BRAND_COLORS = {
  primary: '#E11D48',
  secondary: '#1E293B',
  accent: '#F43F5E',
  background: '#FFFFFF',
  text: '#334155',
  lightGray: '#F1F5F9'
};

// Report category icons
const categoryIcons = {
  Volume: <BarChart3 size={16} className="text-blue-600" />,
  Aging: <Clock size={16} className="text-amber-600" />,
  Performance: <TrendingUp size={16} className="text-green-600" />,
  SLA: <AlertTriangle size={16} className="text-rose-600" />,
  Distribution: <Users size={16} className="text-purple-600" />,
  Escalation: <ChevronUp size={16} className="text-orange-600" />,
  Workflow: <RefreshCw size={16} className="text-cyan-600" />
};

export default function Reports() {
  const { t } = useTranslation();
  const [availableReports, setAvailableReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  
  // Filter states
  const [filters, setFilters] = useState({
    date_from: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    date_to: format(new Date(), 'yyyy-MM-dd'),
    status: [],
    category_l1_id: '',
    category_l2_id: '',
    team_id: '',
    assignee_id: '',
    role: '',
    specialty_id: '',
    access_tier_id: '',
    sla_state: '',
    search: ''
  });

  // Lookup data for filters
  const [categories, setCategories] = useState({ l1: [], l2: [] });
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [accessTiers, setAccessTiers] = useState([]);

  useEffect(() => {
    fetchAvailableReports();
    fetchFilterData();
  }, []);

  const fetchAvailableReports = async () => {
    try {
      const res = await axios.get(`${API}/reports/available`);
      setAvailableReports(res.data);
    } catch (error) {
      toast.error('Failed to load reports');
    }
  };

  const fetchFilterData = async () => {
    try {
      const [catL1, teamsRes, usersRes, specRes, tierRes] = await Promise.all([
        axios.get(`${API}/categories/l1`),
        axios.get(`${API}/teams`),
        axios.get(`${API}/users`),
        axios.get(`${API}/specialties`),
        axios.get(`${API}/access-tiers`)
      ]);
      setCategories({ l1: catL1.data, l2: [] });
      setTeams(teamsRes.data);
      setUsers(usersRes.data);
      setSpecialties(specRes.data);
      setAccessTiers(tierRes.data);
    } catch (error) {
      console.error('Failed to load filter data:', error);
    }
  };

  const fetchCategoriesL2 = async (l1Id) => {
    if (!l1Id) {
      setCategories(prev => ({ ...prev, l2: [] }));
      return;
    }
    try {
      const res = await axios.get(`${API}/categories/l2?category_l1_id=${l1Id}`);
      setCategories(prev => ({ ...prev, l2: res.data }));
    } catch (error) {
      console.error('Failed to load L2 categories:', error);
    }
  };

  const generateReport = async () => {
    if (!selectedReport) {
      toast.error('Please select a report');
      return;
    }

    setLoading(true);
    try {
      const cleanFilters = Object.fromEntries(
        Object.entries(filters).filter(([_, v]) => v && (Array.isArray(v) ? v.length > 0 : true))
      );
      
      const res = await axios.post(`${API}/reports/${selectedReport.id}/generate`, cleanFilters);
      setReportData(res.data);
      toast.success('Report generated');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = async () => {
    if (!selectedReport || !reportData) return;

    setExporting(true);
    try {
      const cleanFilters = Object.fromEntries(
        Object.entries(filters).filter(([_, v]) => v && (Array.isArray(v) ? v.length > 0 : true))
      );

      const res = await axios.post(
        `${API}/reports/${selectedReport.id}/export/csv`,
        cleanFilters,
        { responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${selectedReport.id}_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(t('reports.csvExported'));
    } catch (error) {
      toast.error(t('reports.failedToExportCsv'));
    } finally {
      setExporting(false);
    }
  };

  const exportPDF = async () => {
    if (!selectedReport || !reportData) return;

    setExporting(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Header with brand colors
      doc.setFillColor(BRAND_COLORS.primary);
      doc.rect(0, 0, pageWidth, 25, 'F');
      
      // Title
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(reportData.report_name, 14, 16);
      
      // Subtitle
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generated: ${format(new Date(reportData.generated_at), 'PPpp')}`, pageWidth - 14, 16, { align: 'right' });
      
      // Reset text color
      doc.setTextColor(BRAND_COLORS.text);
      
      // Summary section if available
      let yPos = 35;
      if (reportData.summary) {
        doc.setFillColor(BRAND_COLORS.lightGray);
        doc.rect(10, yPos - 5, pageWidth - 20, 25, 'F');
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Summary', 14, yPos);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        yPos += 8;
        
        const summaryItems = Object.entries(reportData.summary)
          .filter(([k, v]) => typeof v !== 'object')
          .slice(0, 6);
        
        let xPos = 14;
        summaryItems.forEach(([key, value], idx) => {
          const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          doc.setFont('helvetica', 'bold');
          doc.text(`${label}: `, xPos, yPos);
          const labelWidth = doc.getTextWidth(`${label}: `);
          doc.setFont('helvetica', 'normal');
          doc.text(String(value), xPos + labelWidth, yPos);
          
          if ((idx + 1) % 3 === 0) {
            yPos += 6;
            xPos = 14;
          } else {
            xPos += 60;
          }
        });
        
        yPos += 15;
      }
      
      // Data table
      if (reportData.data && reportData.data.length > 0) {
        const tableColumns = reportData.columns.map(col => ({
          header: col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          dataKey: col
        }));
        
        doc.autoTable({
          startY: yPos,
          columns: tableColumns,
          body: reportData.data,
          headStyles: {
            fillColor: BRAND_COLORS.secondary,
            textColor: '#FFFFFF',
            fontStyle: 'bold',
            fontSize: 9
          },
          bodyStyles: {
            fontSize: 8,
            textColor: BRAND_COLORS.text
          },
          alternateRowStyles: {
            fillColor: BRAND_COLORS.lightGray
          },
          margin: { left: 10, right: 10 },
          styles: {
            overflow: 'linebreak',
            cellPadding: 3
          }
        });
      }
      
      // Footer
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(
          `Page ${i} of ${pageCount} | Red Ops Portal Reports`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        );
      }
      
      doc.save(`${selectedReport.id}_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`);
      toast.success(t('reports.pdfExported'));
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error(t('reports.failedToExportPdf'));
    } finally {
      setExporting(false);
    }
  };

  // Quick date range presets
  const setDatePreset = (preset) => {
    const today = new Date();
    let from, to = format(today, 'yyyy-MM-dd');
    
    switch (preset) {
      case 'today':
        from = format(today, 'yyyy-MM-dd');
        break;
      case 'last7':
        from = format(subDays(today, 7), 'yyyy-MM-dd');
        break;
      case 'last30':
        from = format(subDays(today, 30), 'yyyy-MM-dd');
        break;
      case 'thisMonth':
        from = format(startOfMonth(today), 'yyyy-MM-dd');
        to = format(endOfMonth(today), 'yyyy-MM-dd');
        break;
      case 'lastMonth':
        const lastMonth = subMonths(today, 1);
        from = format(startOfMonth(lastMonth), 'yyyy-MM-dd');
        to = format(endOfMonth(lastMonth), 'yyyy-MM-dd');
        break;
      default:
        from = format(subDays(today, 30), 'yyyy-MM-dd');
    }
    
    setFilters(prev => ({ ...prev, date_from: from, date_to: to }));
  };

  // Group reports by category
  const reportsByCategory = availableReports.reduce((acc, report) => {
    if (!acc[report.category]) acc[report.category] = [];
    acc[report.category].push(report);
    return acc;
  }, {});

  return (
    <div className="space-y-6 animate-fade-in" data-testid="reports-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--tx-1)', margin: 0 }}>{t('reports.title')}</h1>
          <p style={{ color: 'var(--tx-3)' }}>{t('reports.description')}</p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Report Selector Panel */}
        <div className="col-span-12 lg:col-span-3">
          <Card className="border-slate-200 sticky top-4">
            <CardHeader className="border-b border-slate-100 pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText size={18} />
                {t('reports.availableReports')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 max-h-[600px] overflow-y-auto">
              {Object.entries(reportsByCategory).map(([category, reports]) => (
                <div key={category} className="border-b border-slate-100 last:border-0">
                  <div style={{ padding: '8px 16px', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: 'var(--tx-2)' }}>
                    {categoryIcons[category] || <FileText size={16} />}
                    {category}
                  </div>
                  {reports.map(report => (
                    <button
                      key={report.id}
                      onClick={() => {
                        setSelectedReport(report);
                        setReportData(null);
                      }}
                      style={{
                        width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none',
                        border: 'none', borderLeft: `2px solid ${selectedReport?.id === report.id ? 'var(--red)' : 'transparent'}`,
                        background: selectedReport?.id === report.id ? 'var(--red-bg)' : 'none',
                        cursor: 'pointer', transition: 'all .15s',
                      }}
                      data-testid={`report-${report.id}`}
                    >
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-1)', margin: 0 }}>{report.name}</p>
                      <p style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 3 }}>{report.description}</p>
                    </button>
                  ))}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="col-span-12 lg:col-span-9 space-y-4">
          {/* Filters Panel */}
          <Card className="border-slate-200">
            <CardHeader className="border-b border-slate-100 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Filter size={18} />
                  {t('reports.filters')}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  {showFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </Button>
              </div>
            </CardHeader>
            {showFilters && (
              <CardContent className="p-4">
                {/* Date Range */}
                <div className="mb-4">
                  <Label style={{ fontSize: 11, color: 'var(--tx-3)', marginBottom: 8, display: 'block' }}>{t('reports.quickDateRange')}</Label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: 'today', label: t('reports.today') },
                      { key: 'last7', label: t('reports.last7Days') },
                      { key: 'last30', label: t('reports.last30Days') },
                      { key: 'thisMonth', label: t('reports.thisMonth') },
                      { key: 'lastMonth', label: t('reports.lastMonth') }
                    ].map(preset => (
                      <Button
                        key={preset.key}
                        variant="outline"
                        size="sm"
                        onClick={() => setDatePreset(preset.key)}
                        className="text-xs"
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Date From */}
                  <div>
                    <Label className="text-xs">{t('reports.dateFrom')}</Label>
                    <Input
                      type="date"
                      value={filters.date_from}
                      onChange={(e) => setFilters(prev => ({ ...prev, date_from: e.target.value }))}
                      className="mt-1"
                    />
                  </div>

                  {/* Date To */}
                  <div>
                    <Label className="text-xs">{t('reports.dateTo')}</Label>
                    <Input
                      type="date"
                      value={filters.date_to}
                      onChange={(e) => setFilters(prev => ({ ...prev, date_to: e.target.value }))}
                      className="mt-1"
                    />
                  </div>

                  {/* Status */}
                  <div>
                    <Label className="text-xs">{t('common.status')}</Label>
                    <Select
                      value={filters.status[0] || 'all'}
                      onValueChange={(v) => setFilters(prev => ({ ...prev, status: v === 'all' ? [] : [v] }))}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder={t('common.all')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('reports.allStatuses')}</SelectItem>
                        <SelectItem value="Open">{t('reports.statusOpen')}</SelectItem>
                        <SelectItem value="In Progress">{t('reports.statusInProgress')}</SelectItem>
                        <SelectItem value="Pending">{t('reports.statusPending')}</SelectItem>
                        <SelectItem value="Delivered">{t('reports.statusDelivered')}</SelectItem>
                        <SelectItem value="Closed">{t('reports.statusClosed')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* SLA State */}
                  <div>
                    <Label className="text-xs">{t('reports.slaState')}</Label>
                    <Select
                      value={filters.sla_state || 'all'}
                      onValueChange={(v) => setFilters(prev => ({ ...prev, sla_state: v === 'all' ? '' : v }))}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder={t('common.all')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('common.all')}</SelectItem>
                        <SelectItem value="on_track">{t('reports.onTrack')}</SelectItem>
                        <SelectItem value="at_risk">{t('reports.atRisk')}</SelectItem>
                        <SelectItem value="breached">{t('reports.breached')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Category L1 */}
                  <div>
                    <Label className="text-xs">{t('reports.categoryL1')}</Label>
                    <Select
                      value={filters.category_l1_id || 'all'}
                      onValueChange={(v) => {
                        const newVal = v === 'all' ? '' : v;
                        setFilters(prev => ({ ...prev, category_l1_id: newVal, category_l2_id: '' }));
                        fetchCategoriesL2(newVal);
                      }}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder={t('common.all')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('reports.allCategories')}</SelectItem>
                        {categories.l1.map(cat => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Category L2 */}
                  <div>
                    <Label className="text-xs">{t('reports.categoryL2')}</Label>
                    <Select
                      value={filters.category_l2_id || 'all'}
                      onValueChange={(v) => setFilters(prev => ({ ...prev, category_l2_id: v === 'all' ? '' : v }))}
                      disabled={!filters.category_l1_id}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder={t('common.all')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('common.all')}</SelectItem>
                        {categories.l2.map(cat => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Team */}
                  <div>
                    <Label className="text-xs">{t('reports.team')}</Label>
                    <Select
                      value={filters.team_id || 'all'}
                      onValueChange={(v) => setFilters(prev => ({ ...prev, team_id: v === 'all' ? '' : v }))}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder={t('common.all')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('reports.allTeams')}</SelectItem>
                        {teams.map(team => (
                          <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Assignee */}
                  <div>
                    <Label className="text-xs">{t('reports.assignee')}</Label>
                    <Select
                      value={filters.assignee_id || 'all'}
                      onValueChange={(v) => setFilters(prev => ({ ...prev, assignee_id: v === 'all' ? '' : v }))}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder={t('common.all')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('reports.allAssignees')}</SelectItem>
                        {users.filter(u => u.role !== 'Requester').map(user => (
                          <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Specialty */}
                  <div>
                    <Label className="text-xs">{t('reports.specialty')}</Label>
                    <Select
                      value={filters.specialty_id || 'all'}
                      onValueChange={(v) => setFilters(prev => ({ ...prev, specialty_id: v === 'all' ? '' : v }))}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder={t('common.all')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('reports.allSpecialties')}</SelectItem>
                        {specialties.map(spec => (
                          <SelectItem key={spec.id} value={spec.id}>{spec.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Access Tier */}
                  <div>
                    <Label className="text-xs">{t('reports.accessTier')}</Label>
                    <Select
                      value={filters.access_tier_id || 'all'}
                      onValueChange={(v) => setFilters(prev => ({ ...prev, access_tier_id: v === 'all' ? '' : v }))}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder={t('common.all')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('reports.allTiers')}</SelectItem>
                        {accessTiers.map(tier => (
                          <SelectItem key={tier.id} value={tier.id}>{tier.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Search */}
                  <div className="col-span-2">
                    <Label className="text-xs">{t('common.search')}</Label>
                    <div className="relative mt-1">
                      <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx-3)', pointerEvents: 'none' }} />
                      <Input
                        placeholder={t('reports.searchPlaceholder')}
                        value={filters.search}
                        onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                        className="pl-9"
                      />
                    </div>
                  </div>
                </div>

                {/* Generate Button */}
                <div className="mt-4 flex gap-2">
                  <Button
                    onClick={generateReport}
                    disabled={!selectedReport || loading}
                    className="bg-rose-600 hover:bg-rose-700"
                    data-testid="generate-report-btn"
                  >
                    <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
                    {loading ? t('reports.generating') : t('reports.generateReport')}
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => setFilters({
                      date_from: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
                      date_to: format(new Date(), 'yyyy-MM-dd'),
                      status: [],
                      category_l1_id: '',
                      category_l2_id: '',
                      team_id: '',
                      assignee_id: '',
                      role: '',
                      specialty_id: '',
                      access_tier_id: '',
                      sla_state: '',
                      search: ''
                    })}
                  >
                    {t('reports.clearFilters')}
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Report Results */}
          {selectedReport && (
            <Card className="border-slate-200">
              <CardHeader className="border-b border-slate-100 pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{selectedReport.name}</CardTitle>
                    <p style={{ fontSize: 13, color: 'var(--tx-3)' }}>{selectedReport.description}</p>
                  </div>
                  {reportData && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={exportCSV}
                        disabled={exporting}
                        data-testid="export-csv-btn"
                      >
                        <FileSpreadsheet size={16} className="mr-2" />
                        CSV
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={exportPDF}
                        disabled={exporting}
                        data-testid="export-pdf-btn"
                      >
                        <FileType size={16} className="mr-2" />
                        PDF
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {!reportData ? (
                  <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--tx-3)' }}>
                    <BarChart3 size={48} style={{ color: 'var(--tx-3)', margin: '0 auto 12px', opacity: 0.5 }} />
                    <p>{t('reports.clickGenerateReport')}</p>
                  </div>
                ) : (
                  <div>
                    {/* Summary Cards */}
                    {reportData.summary && (
                      <div style={{ padding: 16, background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                          {Object.entries(reportData.summary)
                            .filter(([k, v]) => typeof v !== 'object')
                            .map(([key, value]) => (
                              <div key={key} style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: 12, border: '1px solid var(--border)' }}>
                                <p style={{ fontSize: 11, color: 'var(--tx-3)', textTransform: 'capitalize' }}>
                                  {key.replace(/_/g, ' ')}
                                </p>
                                <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--tx-1)', marginTop: 4 }}>
                                  {typeof value === 'number' && key.includes('rate') 
                                    ? `${value}%` 
                                    : typeof value === 'number' && key.includes('hours')
                                    ? `${value}h`
                                    : value}
                                </p>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Data Table */}
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {reportData.columns.map(col => (
                              <TableHead key={col} className="text-xs font-semibold capitalize whitespace-nowrap">
                                {col.replace(/_/g, ' ')}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reportData.data.slice(0, 100).map((row, idx) => (
                            <TableRow key={idx}>
                              {reportData.columns.map(col => (
                                <TableCell key={col} className="text-sm whitespace-nowrap">
                                  {col === 'sla_state' ? (() => {
                                    const s = { on_track: { bg:'#22c55e18',c:'#22c55e' }, at_risk: { bg:'#f59e0b18',c:'#f59e0b' }, breached: { bg:'#ef444418',c:'#ef4444' } }[row[col]] || { bg:'var(--bg-elevated)',c:'var(--tx-3)' };
                                    return <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 5, background: s.bg, color: s.c }}>{row[col]}</span>;
                                  })() : col === 'workflow_status' ? (() => {
                                    const s = { Responded: { bg:'#22c55e18',c:'#22c55e' }, 'Auto-close pending': { bg:'#ef444418',c:'#ef4444' }, 'Email reminder sent': { bg:'#f59e0b18',c:'#f59e0b' } }[row[col]] || { bg:'var(--bg-elevated)',c:'var(--tx-3)' };
                                    return <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 5, background: s.bg, color: s.c }}>{row[col]}</span>;
                                  })() : col.includes('_at') && row[col] ? (
                                    format(new Date(row[col]), 'MMM d, yyyy HH:mm')
                                  ) : (
                                    String(row[col] ?? '-')
                                  )}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      
                      {reportData.data.length > 100 && (
                        <div style={{ padding: 12, textAlign: 'center', fontSize: 13, color: 'var(--tx-3)', borderTop: '1px solid var(--border)' }}>
                          {t('reports.showingRows', { shown: 100, total: reportData.total_rows })}
                        </div>
                      )}
                      
                      {reportData.data.length === 0 && (
                        <div style={{ padding: 32, textAlign: 'center', color: 'var(--tx-3)' }}>
                          <FileText size={32} style={{ color: 'var(--tx-3)', margin: '0 auto 8px', opacity: 0.5 }} />
                          {t('reports.noDataFound')}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
