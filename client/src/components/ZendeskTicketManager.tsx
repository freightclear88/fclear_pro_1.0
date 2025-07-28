import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Ticket, Plus, AlertCircle, CheckCircle, Clock, ExternalLink, RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface ZendeskTicket {
  id: number;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  requester_id: number;
  assignee_id?: number;
  type: string;
  tags: string[];
  url: string;
}

interface ZendeskStats {
  open_tickets: number;
  pending_tickets: number;
  solved_tickets: number;
  total_tickets: number;
  isConfigured: boolean;
}

export default function ZendeskTicketManager() {
  const [statusFilter, setStatusFilter] = useState('open');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch Zendesk statistics
  const { data: stats } = useQuery<ZendeskStats>({
    queryKey: ['/api/zendesk/stats'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch Zendesk tickets
  const { data: ticketsData, isLoading: ticketsLoading, refetch: refetchTickets } = useQuery({
    queryKey: ['/api/zendesk/tickets', statusFilter],
    queryFn: () => apiRequest(`/api/zendesk/tickets?status=${statusFilter}&per_page=50`),
    refetchInterval: 30000,
  });

  // Create ticket mutation
  const createTicketMutation = useMutation({
    mutationFn: async (ticketData: any) => {
      return apiRequest('/api/zendesk/tickets', {
        method: 'POST',
        body: JSON.stringify(ticketData),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/zendesk/tickets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/zendesk/stats'] });
      setShowCreateDialog(false);
      toast({
        title: "Ticket Created",
        description: "Support ticket created successfully in Zendesk",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create ticket",
        variant: "destructive",
      });
    },
  });

  // Update ticket mutation
  const updateTicketMutation = useMutation({
    mutationFn: async ({ ticketId, updateData }: { ticketId: number; updateData: any }) => {
      return apiRequest(`/api/zendesk/tickets/${ticketId}`, {
        method: 'PATCH',
        body: JSON.stringify(updateData),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/zendesk/tickets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/zendesk/stats'] });
      toast({
        title: "Ticket Updated",
        description: "Ticket status updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update ticket",
        variant: "destructive",
      });
    },
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'normal': return 'bg-blue-100 text-blue-800';
      case 'low': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-green-100 text-green-800';
      case 'open': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'solved': return 'bg-gray-100 text-gray-800';
      case 'closed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'new': return <AlertCircle className="w-4 h-4" />;
      case 'open': return <Clock className="w-4 h-4" />;
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'solved': return <CheckCircle className="w-4 h-4" />;
      case 'closed': return <CheckCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const handleCreateTicket = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const ticketData = {
      subject: formData.get('subject'),
      description: formData.get('description'),
      priority: formData.get('priority') || 'normal',
      type: formData.get('type') || 'question',
      requester_email: formData.get('requester_email') || 'noreply@freightclear.com',
      tags: ['freightclear', 'workflow', 'admin-created']
    };

    createTicketMutation.mutate(ticketData);
  };

  const handleStatusChange = (ticketId: number, newStatus: string) => {
    updateTicketMutation.mutate({
      ticketId,
      updateData: { status: newStatus }
    });
  };

  const handlePriorityChange = (ticketId: number, newPriority: string) => {
    updateTicketMutation.mutate({
      ticketId,
      updateData: { priority: newPriority }
    });
  };

  // Check if Zendesk is configured by looking at stats
  const isConfigured = stats && (stats.isConfigured !== false);
  
  if (!isConfigured && stats?.isConfigured === false) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <Ticket className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Zendesk Not Configured</h3>
            <p className="text-gray-600 mb-4">
              Zendesk API credentials need to be configured to manage support tickets.
            </p>
            <p className="text-sm text-gray-500">
              Please contact your system administrator to set up ZENDESK_USERNAME, ZENDESK_API_TOKEN, and ZENDESK_URI environment variables.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Open Tickets</p>
                <p className="text-2xl font-bold text-blue-600">{stats?.open_tickets || 0}</p>
              </div>
              <Clock className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{stats?.pending_tickets || 0}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Solved (30 days)</p>
                <p className="text-2xl font-bold text-green-600">{stats?.solved_tickets || 0}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-2xl font-bold text-gray-600">{stats?.total_tickets || 0}</p>
              </div>
              <Ticket className="w-8 h-8 text-gray-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ticket Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Ticket className="w-5 h-5" />
              Zendesk Support Tickets
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => refetchTickets()}
                disabled={ticketsLoading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${ticketsLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" className="btn-primary">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Ticket
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Support Ticket</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateTicket} className="space-y-4">
                    <div>
                      <Label htmlFor="subject">Subject</Label>
                      <Input name="subject" required placeholder="Brief description of the issue" />
                    </div>
                    
                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea name="description" required placeholder="Detailed description of the issue" />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="priority">Priority</Label>
                        <Select name="priority" defaultValue="normal">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label htmlFor="type">Type</Label>
                        <Select name="type" defaultValue="question">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="question">Question</SelectItem>
                            <SelectItem value="incident">Incident</SelectItem>
                            <SelectItem value="problem">Problem</SelectItem>
                            <SelectItem value="task">Task</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="requester_email">Requester Email</Label>
                      <Input name="requester_email" type="email" placeholder="customer@example.com" />
                    </div>
                    
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createTicketMutation.isPending} className="btn-primary">
                        {createTicketMutation.isPending ? 'Creating...' : 'Create Ticket'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Filter Options */}
            <div className="flex items-center gap-4">
              <Label htmlFor="status-filter">Filter by Status:</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="solved">Solved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tickets Table */}
            {ticketsLoading ? (
              <div className="text-center py-8">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600">Loading tickets...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ticketsData?.tickets?.map((ticket: ZendeskTicket) => (
                      <TableRow key={ticket.id}>
                        <TableCell className="font-mono text-sm">#{ticket.id}</TableCell>
                        <TableCell className="max-w-xs truncate">{ticket.subject}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(ticket.status)}>
                            {getStatusIcon(ticket.status)}
                            <span className="ml-1 capitalize">{ticket.status}</span>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getPriorityColor(ticket.priority)}>
                            {ticket.priority}
                          </Badge>
                        </TableCell>
                        <TableCell className="capitalize">{ticket.type}</TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {new Date(ticket.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Select 
                              value={ticket.status} 
                              onValueChange={(value) => handleStatusChange(ticket.id, value)}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="new">New</SelectItem>
                                <SelectItem value="open">Open</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="solved">Solved</SelectItem>
                                <SelectItem value="closed">Closed</SelectItem>
                              </SelectContent>
                            </Select>
                            
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => window.open(ticket.url, '_blank')}
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                {(!ticketsData?.tickets || ticketsData.tickets.length === 0) && (
                  <div className="text-center py-8">
                    <Ticket className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No {statusFilter} tickets found</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}