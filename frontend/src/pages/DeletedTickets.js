/**
 * DeletedTickets.js — Soft-Deleted Orders Recovery
 *
 * Administrator-only page for viewing and restoring soft-deleted orders.
 *
 * Route: /deleted-tickets
 * Roles: Administrator only
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { 
  Trash2, 
  RotateCcw, 
  Search, 
  Calendar,
  User,
  ExternalLink,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const statusConfig = {
  'Draft': { class: '' },
  'Open': { class: '' },
  'In Progress': { class: 'text-amber-700' },
  'Pending': { class: '' },
  'Delivered': { class: '' },
  'Closed': { class: '' },
  'Canceled': { class: 'bg-red-100 text-red-600' },
};

export default function DeletedTickets() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    fetchDeletedTickets();
  }, []);

  const fetchDeletedTickets = async () => {
    try {
      const res = await axios.get(`${API}/orders/deleted/list`);
      setTickets(res.data);
    } catch (error) {
      toast.error('Failed to fetch deleted tickets');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!selectedTicket) return;
    
    setRestoring(true);
    try {
      await axios.post(`${API}/orders/${selectedTicket.id}/restore`);
      toast.success(`Ticket ${selectedTicket.order_code} restored successfully`);
      setRestoreDialogOpen(false);
      setSelectedTicket(null);
      fetchDeletedTickets();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to restore ticket');
    } finally {
      setRestoring(false);
    }
  };

  const openRestoreDialog = (ticket) => {
    setSelectedTicket(ticket);
    setRestoreDialogOpen(true);
  };

  const filteredTickets = tickets.filter(ticket => {
    const searchLower = searchQuery.toLowerCase();
    return (
      ticket.order_code?.toLowerCase().includes(searchLower) ||
      ticket.title?.toLowerCase().includes(searchLower) ||
      ticket.requester_name?.toLowerCase().includes(searchLower) ||
      ticket.deletion_reason?.toLowerCase().includes(searchLower) ||
      ticket.deleted_by_name?.toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-rose-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="deleted-tickets-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trash2 className="h-6 w-6 text-red-500" />
            Deleted Tickets
          </h1>
          <p className="mt-1">
            View and restore soft-deleted tickets. {tickets.length} ticket(s) in trash.
          </p>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" />
            <Input
              placeholder="Search by ticket code, title, requester, or deletion reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="search-deleted-tickets"
            />
          </div>
        </CardContent>
      </Card>

      {/* Empty State */}
      {filteredTickets.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full p-4 mb-4">
              <Trash2 className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-medium mb-1">
              {searchQuery ? 'No matching tickets found' : 'No deleted tickets'}
            </h3>
            <p className="text-center max-w-sm">
              {searchQuery 
                ? 'Try adjusting your search query to find deleted tickets.' 
                : 'When administrators soft-delete tickets, they will appear here for review and potential restoration.'
              }
            </p>
          </CardContent>
        </Card>
      )}

      {/* Tickets Table */}
      {filteredTickets.length > 0 && (
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-lg">Deleted Tickets ({filteredTickets.length})</CardTitle>
            <CardDescription>
              Click restore to bring back a ticket to its previous state
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Requester</TableHead>
                  <TableHead>Status Before Delete</TableHead>
                  <TableHead>Deleted By</TableHead>
                  <TableHead>Deleted At</TableHead>
                  <TableHead>Deletion Reason</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTickets.map((ticket) => (
                  <TableRow key={ticket.id} data-testid={`deleted-ticket-row-${ticket.id}`}>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="font-mono text-sm">{ticket.order_code}</span>
                        <span className="font-medium line-clamp-1">{ticket.title}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span className="">{ticket.requester_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusConfig[ticket.status]?.class || ''}>
                        {ticket.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="">{ticket.deleted_by_name || 'Unknown'}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span className="text-sm">
                          {ticket.deleted_at 
                            ? format(new Date(ticket.deleted_at), 'MMM d, yyyy HH:mm')
                            : 'N/A'
                          }
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm line-clamp-2" title={ticket.deletion_reason}>
                        {ticket.deletion_reason || 'No reason provided'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          className="hover:bg-blue-50"
                          onClick={() => navigate(`/orders/${ticket.id}`)}
                          data-testid={`view-deleted-ticket-${ticket.id}`}
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-green-600 border-green-200 hover:bg-green-50"
                          onClick={() => openRestoreDialog(ticket)}
                          data-testid={`restore-ticket-${ticket.id}`}
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Restore
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Restore Confirmation Dialog */}
      <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-green-600" />
              Restore Ticket?
            </DialogTitle>
            <DialogDescription>
              This will restore the ticket <strong>{selectedTicket?.order_code}</strong> to its previous state.
              The requester will be notified that their ticket has been restored.
            </DialogDescription>
          </DialogHeader>
          {selectedTicket && (
            <div className="p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="">Title:</span>
                <span className="font-medium">{selectedTicket.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="">Status:</span>
                <Badge className={statusConfig[selectedTicket.status]?.class || ''}>
                  {selectedTicket.status}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="">Requester:</span>
                <span className="">{selectedTicket.requester_name}</span>
              </div>
              {selectedTicket.deletion_reason && (
                <div className="pt-2 border-t">
                  <span className="text-sm">Deletion Reason:</span>
                  <p className="text-sm mt-1">{selectedTicket.deletion_reason}</p>
                </div>
              )}
            </div>
          )}
          <div className="flex gap-3 justify-end pt-4">
            <Button 
              variant="outline" 
              onClick={() => {
                setRestoreDialogOpen(false);
                setSelectedTicket(null);
              }}
            >
              Cancel
            </Button>
            <Button 
              className="bg-green-600 hover:bg-green-700"
              onClick={handleRestore}
              disabled={restoring}
              data-testid="confirm-restore-btn"
            >
              {restoring ? 'Restoring...' : 'Restore Ticket'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
