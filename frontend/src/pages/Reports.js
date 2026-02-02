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
      toast.success('CSV exported');
    } catch (error) {
      toast.error('Failed to export CSV');
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
      toast.success('PDF exported');
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('Failed to export PDF');
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
          <h1 className="text-2xl font-bold text-slate-900">{t('reports.title')}</h1>
          <p className="text-slate-500">{t('reports.description')}</p>
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
                  <div className="px-4 py-2 bg-slate-50 flex items-center gap-2 text-sm font-medium text-slate-700">
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
                      className={`w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors border-l-2 ${
                        selectedReport?.id === report.id
                          ? 'border-l-rose-600 bg-rose-50'
                          : 'border-l-transparent'
                      }`}
                      data-testid={`report-${report.id}`}
                    >
                      <p className="font-medium text-sm text-slate-900">{report.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{report.description}</p>
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
                  <Label className="text-xs text-slate-500 mb-2 block">{t('reports.quickDateRange')}</Label>
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
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
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
                    <p className="text-sm text-slate-500">{selectedReport.description}</p>
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
                  <div className="p-12 text-center text-slate-500">
                    <BarChart3 size={48} className="mx-auto text-slate-300 mb-3" />
                    <p>Click "Generate Report" to view results</p>
                  </div>
                ) : (
                  <div>
                    {/* Summary Cards */}
                    {reportData.summary && (
                      <div className="p-4 bg-slate-50 border-b border-slate-100">
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                          {Object.entries(reportData.summary)
                            .filter(([k, v]) => typeof v !== 'object')
                            .map(([key, value]) => (
                              <div key={key} className="bg-white rounded-lg p-3 border border-slate-200">
                                <p className="text-xs text-slate-500 capitalize">
                                  {key.replace(/_/g, ' ')}
                                </p>
                                <p className="text-lg font-bold text-slate-900 mt-1">
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
                                  {col === 'sla_state' ? (
                                    <Badge className={
                                      row[col] === 'on_track' ? 'bg-green-100 text-green-700' :
                                      row[col] === 'at_risk' ? 'bg-amber-100 text-amber-700' :
                                      row[col] === 'breached' ? 'bg-red-100 text-red-700' :
                                      'bg-slate-100 text-slate-700'
                                    }>
                                      {row[col]}
                                    </Badge>
                                  ) : col === 'workflow_status' ? (
                                    <Badge className={
                                      row[col] === 'Responded' ? 'bg-green-100 text-green-700' :
                                      row[col] === 'Auto-close pending' ? 'bg-red-100 text-red-700' :
                                      row[col] === 'Email reminder sent' ? 'bg-amber-100 text-amber-700' :
                                      'bg-slate-100 text-slate-700'
                                    }>
                                      {row[col]}
                                    </Badge>
                                  ) : col.includes('_at') && row[col] ? (
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
                        <div className="p-3 text-center text-sm text-slate-500 border-t border-slate-100">
                          Showing 100 of {reportData.total_rows} rows. Export to see all data.
                        </div>
                      )}
                      
                      {reportData.data.length === 0 && (
                        <div className="p-8 text-center text-slate-500">
                          <FileText size={32} className="mx-auto text-slate-300 mb-2" />
                          No data found for the selected filters
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
