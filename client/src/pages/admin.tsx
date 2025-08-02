import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Shield, Download, Copy, Search, Calendar, FileText, Ship, Users, CheckCircle, XCircle, Receipt, ChevronDown, ChevronRight, ChevronLeft, Folder, CreditCard, Crown, Zap, Eye, Plus, ExternalLink, Settings, Loader2 } from "lucide-react";
import type { Shipment, Document, User } from "@shared/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import ShipmentHtmlPage from "@/components/ShipmentHtmlPage";
import DocumentUpload from "@/components/DocumentUpload";
import DocumentList from "@/components/DocumentList";

import XMLIntegrationManager from "@/components/XMLIntegrationManager";
import AdminInvoiceUpload from "@/components/AdminInvoiceUpload";
import ZendeskTicketManager from "@/components/ZendeskTicketManager";

interface SubscriptionUpgradeDialogProps {
  user: User;
  subscriptionPlans: any[];
  onUpgrade: (planName: string, duration: number) => void;
  isPending: boolean;
}

// Simple DocumentFolder component for admin use
function DocumentFolder({ shipmentId }: { shipmentId: number }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">Shipment Documents</span>
        <DocumentUpload 
          shipmentId={shipmentId}
          trigger={
            <Button size="sm" className="btn-primary">
              <Plus className="w-4 h-4 mr-1" />
              Upload Document
            </Button>
          }
        />
      </div>
      <DocumentList shipmentId={shipmentId} />
    </div>
  );
}

function SubscriptionUpgradeDialog({ user, subscriptionPlans, onUpgrade, isPending }: SubscriptionUpgradeDialogProps) {
  const [selectedPlan, setSelectedPlan] = useState(user.subscriptionPlan || 'free');
  const [selectedDuration, setSelectedDuration] = useState('1');

  const handleUpgrade = () => {
    onUpgrade(selectedPlan, parseInt(selectedDuration));
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" className="w-full btn-primary">
          Upgrade Subscription
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upgrade User Subscription</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="plan">Subscription Plan</Label>
            <Select value={selectedPlan} onValueChange={setSelectedPlan}>
              <SelectTrigger>
                <SelectValue placeholder="Select plan" />
              </SelectTrigger>
              <SelectContent>
                {subscriptionPlans.map((plan: any) => (
                  <SelectItem key={plan.id} value={plan.planName}>
                    {plan.displayName} - ${plan.monthlyPrice}/month
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="duration">Duration (months)</Label>
            <Select value={selectedDuration} onValueChange={setSelectedDuration}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 Month</SelectItem>
                <SelectItem value="3">3 Months</SelectItem>
                <SelectItem value="6">6 Months</SelectItem>
                <SelectItem value="12">12 Months</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <Button
            onClick={handleUpgrade}
            disabled={isPending}
            className="w-full btn-primary"
          >
            {isPending ? 'Updating...' : 'Update Subscription'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Admin() {
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [expandedShipments, setExpandedShipments] = useState<Set<number>>(new Set());
  const [companySearchTerm, setCompanySearchTerm] = useState("");
  const [selectedHtmlShipment, setSelectedHtmlShipment] = useState<Shipment | null>(null);
  const [isHtmlPageOpen, setIsHtmlPageOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const shipmentsPerPage = 10;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Zendesk configuration state
  const [zendeskConfig, setZendeskConfig] = useState({
    subdomain: 'wcscargo',
    username: '',
    token: '',
    defaultRequester: 'noreply@freightclear.com',
    defaultTags: 'freightclear,workflow',
    defaultPriority: 'normal',
    defaultType: 'question',
    autoAssignAgent: 'none'
  });

  const { data: allShipments = [] } = useQuery<Shipment[]>({
    queryKey: ["/api/admin/shipments"],
  });

  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  const { data: allDocuments = [] } = useQuery<Document[]>({
    queryKey: ["/api/admin/documents"],
  });

  const { data: stats } = useQuery({
    queryKey: ["/api/admin/stats"],
  });

  const { data: subscriptionPlans = [] } = useQuery({
    queryKey: ["/api/admin/subscription/plans"],
  });

  // Zendesk configuration queries and mutations
  const { data: zendeskConfigData, isLoading: configLoading } = useQuery({
    queryKey: ['/api/admin/zendesk/config'],
    refetchOnWindowFocus: false,
  });

  // Load config data into state when available
  useEffect(() => {
    if (zendeskConfigData) {
      setZendeskConfig({
        subdomain: zendeskConfigData.subdomain || 'wcscargo',
        username: zendeskConfigData.username || '',
        token: '',
        defaultRequester: zendeskConfigData.defaultRequester || 'noreply@freightclear.com',
        defaultTags: Array.isArray(zendeskConfigData.defaultTags) 
          ? zendeskConfigData.defaultTags.join(',') 
          : zendeskConfigData.defaultTags || 'freightclear,workflow',
        defaultPriority: zendeskConfigData.defaultPriority || 'normal',
        defaultType: zendeskConfigData.defaultType || 'question',
        autoAssignAgent: zendeskConfigData.autoAssignAgent || 'none'
      });
    }
  }, [zendeskConfigData]);

  const saveZendeskConfigMutation = useMutation({
    mutationFn: async (config: typeof zendeskConfig) => {
      return apiRequest('/api/admin/zendesk/config', {
        method: 'POST',
        body: JSON.stringify({
          ...config,
          defaultTags: config.defaultTags.split(',').map(tag => tag.trim())
        }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/zendesk/config'] });
      queryClient.invalidateQueries({ queryKey: ['/api/zendesk/stats'] });
      toast({
        title: "Configuration Saved",
        description: data.message || "Zendesk configuration updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save Zendesk configuration",
        variant: "destructive",
      });
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async (config: typeof zendeskConfig) => {
      return apiRequest('/api/admin/zendesk/test-connection', {
        method: 'POST',
        body: JSON.stringify({
          subdomain: config.subdomain,
          username: config.username,
          token: config.token
        }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Connection Successful",
        description: `Connected as ${data.user}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect to Zendesk",
        variant: "destructive",
      });
    },
  });

  const handleSaveZendeskConfig = () => {
    if (!zendeskConfig.subdomain || !zendeskConfig.username) {
      toast({
        title: "Missing Information",
        description: "Please enter subdomain and username",
        variant: "destructive",
      });
      return;
    }
    saveZendeskConfigMutation.mutate(zendeskConfig);
  };

  const handleTestConnection = () => {
    if (!zendeskConfig.subdomain || !zendeskConfig.username || !zendeskConfig.token) {
      toast({
        title: "Missing Credentials",
        description: "Please enter subdomain, username, and API token",
        variant: "destructive",
      });
      return;
    }
    testConnectionMutation.mutate(zendeskConfig);
  };

  const filteredShipments = allShipments.filter((shipment: Shipment) => {
    const matchesSearch = shipment.shipmentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         shipment.origin.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         shipment.destination.toLowerCase().includes(searchTerm.toLowerCase());

    if (dateFilter === "all") return matchesSearch;

    const shipmentDate = new Date(shipment.createdAt!);
    const now = new Date();
    
    if (dateFilter === "month") {
      return matchesSearch && shipmentDate.getMonth() === now.getMonth() && 
             shipmentDate.getFullYear() === now.getFullYear();
    }
    
    if (dateFilter === "year") {
      return matchesSearch && shipmentDate.getFullYear() === now.getFullYear();
    }

    return matchesSearch;
  });

  // Calculate pagination
  const totalPages = Math.ceil(filteredShipments.length / shipmentsPerPage);
  const startIndex = (currentPage - 1) * shipmentsPerPage;
  const endIndex = startIndex + shipmentsPerPage;
  const paginatedShipments = filteredShipments.slice(startIndex, endIndex);

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  // Reset to page 1 when search or filter changes
  const resetPagination = () => {
    setCurrentPage(1);
  };

  const filteredUsers = allUsers.filter((user: User) => {
    if (!companySearchTerm) return false;
    
    const searchLower = companySearchTerm.toLowerCase();
    return (
      (user.firstName?.toLowerCase().includes(searchLower)) ||
      (user.lastName?.toLowerCase().includes(searchLower)) ||
      (user.email?.toLowerCase().includes(searchLower)) ||
      (user.companyName?.toLowerCase().includes(searchLower))
    );
  });

  const handleExportCSV = () => {
    const csvData = filteredShipments.map(shipment => ({
      shipmentId: shipment.shipmentId,
      origin: shipment.origin,
      destination: shipment.destination,
      status: shipment.status,
      vessel: shipment.vessel || "",
      container: shipment.containerNumber || "",
      billOfLading: shipment.billOfLading || "",
      totalValue: shipment.totalValue || "",
      createdAt: new Date(shipment.createdAt!).toLocaleDateString(),
    }));

    const csvContent = [
      Object.keys(csvData[0]).join(","),
      ...csvData.map(row => Object.values(row).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shipments-${dateFilter}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: `Exported ${filteredShipments.length} shipments to CSV`,
    });
  };

  const handleViewHtmlPage = (shipment: Shipment) => {
    setSelectedHtmlShipment(shipment);
    setIsHtmlPageOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { variant: "secondary" as const, label: "Pending" },
      in_transit: { variant: "default" as const, label: "In Transit" },
      arrived: { variant: "default" as const, label: "Arrived", className: "bg-freight-green text-white" },
      delivered: { variant: "default" as const, label: "Delivered", className: "bg-freight-green text-white" },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    
    return (
      <Badge variant={config.variant} className={config.className}>
        {config.label}
      </Badge>
    );
  };

  // POA validation mutations
  const validatePOAMutation = useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: string }) => {
      const response = await fetch(`/api/admin/users/${userId}/poa/validate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update POA status');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({
        title: "POA Status Updated",
        description: "Power of Attorney status has been updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleValidatePOA = (userId: string, status: 'validated' | 'rejected') => {
    validatePOAMutation.mutate({ userId, status });
  };

  // IRS Proof validation mutations
  const validateIRSProofMutation = useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: string }) => {
      const response = await fetch(`/api/admin/users/${userId}/irs-proof/validate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update IRS proof status');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({
        title: "IRS Proof Updated",
        description: "User's IRS proof status has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const upgradeSubscriptionMutation = useMutation({
    mutationFn: async ({ userId, planName, durationMonths }: { userId: string; planName: string; durationMonths: number }) => {
      await apiRequest(`/api/admin/users/${userId}/subscription`, {
        method: 'POST',
        body: { planName, durationMonths }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Subscription Updated",
        description: "User subscription has been updated successfully",
      });
    },
    onError: (error: Error) => {
      console.error("Error updating subscription:", error);
      toast({
        title: "Error",
        description: "Failed to update user subscription",
        variant: "destructive",
      });
    }
  });

  const handleValidateIRSProof = (userId: string, status: 'validated' | 'rejected') => {
    validateIRSProofMutation.mutate({ userId, status });
  };

  const handleUpgradeSubscription = (userId: string, planName: string, durationMonths: number) => {
    upgradeSubscriptionMutation.mutate({ userId, planName, durationMonths });
  };

  const toggleShipmentExpansion = (shipmentId: number) => {
    setExpandedShipments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(shipmentId)) {
        newSet.delete(shipmentId);
      } else {
        newSet.add(shipmentId);
      }
      return newSet;
    });
  };

  // Document Folder Component
  function DocumentFolder({ shipmentId }: { shipmentId: number }) {
    const { data: documents = [] } = useQuery<Document[]>({
      queryKey: ['/api/documents', shipmentId],
      queryFn: async () => {
        const response = await fetch(`/api/documents?shipmentId=${shipmentId}`);
        if (!response.ok) throw new Error('Failed to fetch documents');
        return response.json();
      },
    });

    const handleDownload = async (document: Document) => {
      try {
        const response = await fetch(`/api/documents/${document.id}/download`);
        if (!response.ok) throw new Error('Download failed');
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = document.originalName || 'document';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast({
          title: "Download Complete",
          description: `Downloaded ${document.originalName}`,
        });
      } catch (error) {
        toast({
          title: "Download Failed",
          description: "Could not download document",
          variant: "destructive",
        });
      }
    };

    if (documents.length === 0) {
      return (
        <div className="text-center py-4 text-gray-500 text-sm">
          No documents uploaded yet
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {documents.map((doc: Document) => (
          <div key={doc.id} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
            <div className="flex items-center space-x-2">
              <FileText className="w-4 h-4 text-freight-blue" />
              <div>
                <p className="text-sm font-medium">{doc.originalName}</p>
                <p className="text-xs text-gray-500 capitalize">{doc.category.replace('_', ' ')}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDownload(doc)}
              className="text-freight-orange hover:text-freight-dark"
            >
              <Download className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>
    );
  }

  // Filter users with pending POAs
  const pendingPOAUsers = allUsers.filter((user: User) => user.powerOfAttorneyStatus === 'pending');
  const pendingIRSProofUsers = allUsers.filter((user: User) => user.irsProofStatus === 'uploaded');

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-freight-dark flex items-center">
            <Shield className="w-6 h-6 mr-2 text-freight-orange" />
            Admin Dashboard
          </h2>
          <p className="text-gray-600">System-wide data management and exports</p>
        </div>
        <div className="flex items-center space-x-4">
          <Button
            onClick={handleExportCSV}
            className="btn-accent"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="gradient-card hover-glow border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Users</p>
                <p className="text-3xl font-bold text-freight-dark">
                  {allUsers.length}
                </p>
              </div>
              <div className="bg-teal/10 p-3 rounded-lg">
                <Users className="w-6 h-6 text-teal" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="gradient-card hover-glow border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Shipments</p>
                <p className="text-3xl font-bold text-freight-dark">
                  {allShipments.length}
                </p>
              </div>
              <div className="bg-neon-green/10 p-3 rounded-lg">
                <Ship className="w-6 h-6 text-neon-green" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="gradient-card hover-glow border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Documents</p>
                <p className="text-3xl font-bold text-freight-dark">
                  {allDocuments.length}
                </p>
              </div>
              <div className="bg-powder-blue/15 p-3 rounded-lg">
                <FileText className="w-6 h-6 text-powder-blue" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Filtered Results</p>
                <p className="text-3xl font-bold text-freight-dark">
                  {filteredShipments.length}
                </p>
              </div>
              <div className="bg-freight-blue/10 p-3 rounded-lg">
                <Search className="w-6 h-6 text-freight-blue" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* POA Validation Section */}
      {pendingPOAUsers.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Power of Attorney Validation Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingPOAUsers.map((user: User) => (
                <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg bg-yellow-50">
                  <div className="flex-1">
                    <h4 className="font-medium">{user.firstName} {user.lastName}</h4>
                    <p className="text-sm text-gray-600">{user.email}</p>
                    <p className="text-xs text-gray-500">
                      Submitted: {user.powerOfAttorneyUploadedAt ? new Date(user.powerOfAttorneyUploadedAt).toLocaleString() : 'N/A'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={async () => {
                        try {
                          const response = await fetch(`/api/admin/users/${user.id}/poa/view`, {
                            credentials: 'include'
                          });
                          if (response.ok) {
                            const blob = await response.blob();
                            const url = URL.createObjectURL(blob);
                            window.open(url, '_blank');
                            // Clean up the object URL after a delay
                            setTimeout(() => URL.revokeObjectURL(url), 1000);
                          } else {
                            console.error('Failed to fetch POA document');
                          }
                        } catch (error) {
                          console.error('Error viewing POA:', error);
                        }
                      }}
                      disabled={!user.powerOfAttorneyDocumentPath}
                      className="btn-outline-accent"
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      View
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleValidatePOA(user.id, 'validated')}
                      disabled={validatePOAMutation.isPending}
                      className="btn-secondary"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Validate
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleValidatePOA(user.id, 'rejected')}
                      disabled={validatePOAMutation.isPending}
                      className="btn-danger"
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* IRS Proof Validation Section */}
      {pendingIRSProofUsers.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              IRS Proof Verification Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingIRSProofUsers.map((user: User) => (
                <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg bg-blue-50">
                  <div className="flex-1">
                    <h4 className="font-medium">{user.firstName} {user.lastName}</h4>
                    <p className="text-sm text-gray-600">{user.email}</p>
                    <p className="text-xs text-gray-500">
                      Submitted: {user.irsProofUploadedAt ? new Date(user.irsProofUploadedAt).toLocaleString() : 'N/A'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {user.irsProofDocumentPath && (
                      <Button
                        size="sm"
                        onClick={() => window.open(`/api/admin/users/${user.id}/irs-proof/view`, '_blank')}
                        className="btn-outline-accent"
                      >
                        <FileText className="h-4 w-4 mr-1" />
                        View Document
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => handleValidateIRSProof(user.id, 'validated')}
                      disabled={validateIRSProofMutation.isPending}
                      className="btn-secondary"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleValidateIRSProof(user.id, 'rejected')}
                      disabled={validateIRSProofMutation.isPending}
                      className="btn-danger"
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Subscription Management */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Subscription Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Company Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search by company name, email, or user name..."
                value={companySearchTerm}
                onChange={(e) => setCompanySearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Search Results */}
            {companySearchTerm && (
              <div className="space-y-3">
                {filteredUsers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No users found matching "{companySearchTerm}"
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredUsers.map((user: User) => (
                      <div key={user.id} className="border rounded-lg p-4 bg-white">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h4 className="font-medium">{user.firstName} {user.lastName}</h4>
                              <div className="flex items-center gap-1">
                                {user.subscriptionPlan === 'pro' && <Crown className="w-4 h-4 text-freight-orange" />}
                                {user.subscriptionPlan === 'starter' && <CreditCard className="w-4 h-4 text-blue-500" />}
                                <Badge variant={user.subscriptionPlan === 'free' ? 'secondary' : 'default'}>
                                  {user.subscriptionPlan || 'free'}
                                </Badge>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                              <div>
                                <p><strong>Email:</strong> {user.email}</p>
                                {user.companyName && <p><strong>Company:</strong> {user.companyName}</p>}
                                <p><strong>Status:</strong> {user.subscriptionStatus || 'inactive'}</p>
                              </div>
                              <div>
                                {user.subscriptionEndDate && (
                                  <p><strong>Expires:</strong> {new Date(user.subscriptionEndDate).toLocaleDateString()}</p>
                                )}
                                <p><strong>Shipments:</strong> {user.currentShipmentCount || 0} / {user.maxShipments === -1 ? '∞' : user.maxShipments}</p>
                                <p><strong>Documents:</strong> {user.currentDocumentCount || 0} / {user.maxDocuments === -1 ? '∞' : user.maxDocuments}</p>
                              </div>
                            </div>
                          </div>
                          <div className="ml-4">
                            <SubscriptionUpgradeDialog
                              user={user}
                              subscriptionPlans={subscriptionPlans}
                              onUpgrade={(planName, duration) => handleUpgradeSubscription(user.id, planName, duration)}
                              isPending={upgradeSubscriptionMutation.isPending}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!companySearchTerm && (
              <div className="text-center py-8 text-gray-500">
                Enter a company name, email, or user name to search for accounts
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search shipments by ID, origin, or destination..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  resetPagination();
                }}
                className="pl-10"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <Select value={dateFilter} onValueChange={(value) => {
                setDateFilter(value);
                resetPagination();
              }}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Date filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="year">This Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* All Shipments Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>
              All Shipments ({filteredShipments.length})
            </CardTitle>
            <div className="text-sm text-gray-500">
              Page {currentPage} of {totalPages} ({paginatedShipments.length} shown)
            </div>
            <div className="text-sm text-gray-500">
              Filter: {dateFilter === "all" ? "All Time" : dateFilter === "month" ? "This Month" : "This Year"}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Shipment ID</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Origin</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedShipments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      No shipments found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedShipments.map((shipment) => {
                    const user = allUsers.find(u => u.id === shipment.userId);
                    const isExpanded = expandedShipments.has(shipment.id);
                    
                    return (
                    <>
                      <TableRow key={shipment.id} className="hover:bg-gray-50">
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Collapsible>
                              <CollapsibleTrigger 
                                onClick={() => toggleShipmentExpansion(shipment.id)}
                                className="flex items-center space-x-1 hover:text-freight-blue"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                                <Folder className="w-4 h-4" />
                              </CollapsibleTrigger>
                            </Collapsible>
                            <div>
                              <div className="font-medium text-freight-dark">{shipment.shipmentId}</div>
                              {shipment.containerNumber && (
                                <div className="text-sm text-gray-500">Container: {shipment.containerNumber}</div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{user?.firstName} {user?.lastName}</div>
                          <div className="text-sm text-gray-500">{user?.email}</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-freight-dark">{shipment.origin}</div>
                          {shipment.originPort && (
                            <div className="text-sm text-gray-500">Port: {shipment.originPort}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-freight-dark">{shipment.destination}</div>
                          {shipment.destinationPort && (
                            <div className="text-sm text-gray-500">Port: {shipment.destinationPort}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(shipment.status)}
                        </TableCell>
                        <TableCell>
                          {new Date(shipment.createdAt!).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewHtmlPage(shipment)}
                              className="text-freight-orange hover:text-freight-dark"
                              title="View HTML Page"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                            <DocumentUpload 
                              shipmentId={shipment.id}
                              trigger={
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-freight-blue hover:text-freight-dark"
                                  title="Upload Document"
                                >
                                  <Plus className="w-4 h-4" />
                                </Button>
                              }
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={7} className="p-4 bg-gray-50/50">
                            <div className="border rounded-lg p-4 bg-white">
                              <h4 className="font-medium mb-3 text-freight-dark flex items-center">
                                <FileText className="w-4 h-4 mr-2" />
                                Documents for {shipment.shipmentId}
                              </h4>
                              <DocumentFolder shipmentId={shipment.id} />
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-6 py-4">
              <div className="text-sm text-gray-500">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredShipments.length)} of {filteredShipments.length} shipments
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePreviousPage}
                  disabled={currentPage === 1}
                  className="flex items-center space-x-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </Button>
                
                <div className="flex items-center space-x-1">
                  <span className="text-sm font-medium">
                    Page {currentPage} of {totalPages}
                  </span>
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                  className="flex items-center space-x-1"
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Admin Support System */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center">
            <div className="bg-gradient-to-br from-freight-blue to-freight-green p-2 rounded-lg mr-3">
              <Shield className="w-5 h-5 text-white" />
            </div>
            Admin Support System
          </CardTitle>
          <CardDescription>
            Centralized support management and user communication hub
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg bg-gradient-to-br from-blue-50 to-indigo-100">
              <h4 className="font-medium mb-2 flex items-center">
                <Shield className="w-4 h-4 mr-2 text-blue-600" />
                Support Channels
              </h4>
              <p className="text-sm text-gray-600 mb-3">
                Professional chat support system ready for integration
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>TalkJS Integration</span>
                  <Badge variant="outline" className="text-amber-600 border-amber-600">Pending Setup</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Email Notifications</span>
                  <Badge variant="outline" className="text-green-600 border-green-600">Active</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Admin Channels</span>
                  <Badge variant="outline" className="text-blue-600 border-blue-600">Ready</Badge>
                </div>
              </div>
            </div>
            
            <div className="p-4 border rounded-lg bg-gradient-to-br from-green-50 to-emerald-100">
              <h4 className="font-medium mb-2 flex items-center">
                <Users className="w-4 h-4 mr-2 text-green-600" />
                User Management
              </h4>
              <p className="text-sm text-gray-600 mb-3">
                Direct access to user accounts and subscription management
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>Account Search</span>
                  <Badge variant="outline" className="text-green-600 border-green-600">Active</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Subscription Control</span>
                  <Badge variant="outline" className="text-green-600 border-green-600">Active</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Document Validation</span>
                  <Badge variant="outline" className="text-green-600 border-green-600">Active</Badge>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start">
              <div className="bg-amber-100 p-2 rounded-lg mr-3">
                <ExternalLink className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <h5 className="font-medium text-amber-800 mb-1">TalkJS Integration Setup Required</h5>
                <p className="text-sm text-amber-700 mb-2">
                  To enable live chat support, configure your TalkJS API credentials in the environment settings.
                </p>
                <p className="text-xs text-amber-600">
                  Contact your system administrator to set up VITE_TALKJS_APP_ID for full chat functionality.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* XML Integration Management */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center">
            <div className="bg-gradient-to-br from-orange-500 to-red-600 p-2 rounded-lg mr-3">
              <FileText className="w-5 h-5 text-white" />
            </div>
            XML Integration Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <XMLIntegrationManager />
        </CardContent>
      </Card>

      {/* Invoice Management */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center">
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-2 rounded-lg mr-3">
              <Receipt className="w-5 h-5 text-white" />
            </div>
            Invoice Management
          </CardTitle>
          <CardDescription>
            Upload and send invoices directly to user accounts with automatic email notifications
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AdminInvoiceUpload />
        </CardContent>
      </Card>

      {/* Zendesk Configuration & Management */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center">
            <div className="bg-gradient-to-br from-blue-500 to-cyan-600 p-2 rounded-lg mr-3">
              <Shield className="w-5 h-5 text-white" />
            </div>
            Zendesk Configuration & Management
          </CardTitle>
          <CardDescription>
            Configure Zendesk settings, manage support tickets, and monitor integration status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Zendesk Settings Configuration */}
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span className="flex items-center">
                    <Shield className="w-4 h-4 mr-2" />
                    Zendesk Account Settings
                  </span>
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 mt-4 p-4 border rounded-lg bg-gray-50">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="zendesk-subdomain">Zendesk Subdomain</Label>
                    <div className="flex">
                      <Input 
                        id="zendesk-subdomain"
                        placeholder="wcscargo" 
                        value={zendeskConfig.subdomain}
                        onChange={(e) => setZendeskConfig({...zendeskConfig, subdomain: e.target.value})}
                        className="rounded-r-none"
                      />
                      <div className="px-3 py-2 bg-gray-100 border border-l-0 rounded-r-md text-sm text-gray-600">
                        .zendesk.com
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">Your Zendesk account subdomain</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="zendesk-username">Admin Username</Label>
                    <Input 
                      id="zendesk-username"
                      placeholder="admin@freightclear.com"
                      type="email"
                      value={zendeskConfig.username}
                      onChange={(e) => setZendeskConfig({...zendeskConfig, username: e.target.value})}
                    />
                    <p className="text-xs text-gray-500">Zendesk admin email address</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="zendesk-token">API Token</Label>
                    <Input 
                      id="zendesk-token"
                      placeholder="Enter your Zendesk API token"
                      type="password"
                      value={zendeskConfig.token}
                      onChange={(e) => setZendeskConfig({...zendeskConfig, token: e.target.value})}
                    />
                    <p className="text-xs text-gray-500">Generate from Admin Center → APIs → Zendesk API</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="default-requester">Default Requester Email</Label>
                    <Input 
                      id="default-requester"
                      placeholder="noreply@freightclear.com"
                      type="email"
                      value={zendeskConfig.defaultRequester}
                      onChange={(e) => setZendeskConfig({...zendeskConfig, defaultRequester: e.target.value})}
                    />
                    <p className="text-xs text-gray-500">Default email for system-generated tickets</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="default-tags">Default Tags (comma-separated)</Label>
                  <Input 
                    id="default-tags"
                    placeholder="freightclear, workflow, system"
                    value={zendeskConfig.defaultTags}
                    onChange={(e) => setZendeskConfig({...zendeskConfig, defaultTags: e.target.value})}
                  />
                  <p className="text-xs text-gray-500">Tags automatically added to new tickets</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="default-priority">Default Priority</Label>
                    <Select value={zendeskConfig.defaultPriority} onValueChange={(value) => setZendeskConfig({...zendeskConfig, defaultPriority: value})}>
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
                  
                  <div className="space-y-2">
                    <Label htmlFor="default-type">Default Type</Label>
                    <Select value={zendeskConfig.defaultType} onValueChange={(value) => setZendeskConfig({...zendeskConfig, defaultType: value})}>
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
                  
                  <div className="space-y-2">
                    <Label htmlFor="auto-assign">Auto-assign Agent</Label>
                    <Select value={zendeskConfig.autoAssignAgent} onValueChange={(value) => setZendeskConfig({...zendeskConfig, autoAssignAgent: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select agent" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No auto-assignment</SelectItem>
                        <SelectItem value="admin">Admin User</SelectItem>
                        <SelectItem value="support">Support Team</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="flex justify-between items-center pt-4 border-t">
                  <div className="flex items-center space-x-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleTestConnection}
                      disabled={testConnectionMutation.isPending}
                    >
                      {testConnectionMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Testing...
                        </>
                      ) : (
                        'Test Connection'
                      )}
                    </Button>
                    <Badge variant="outline" className={zendeskConfigData?.isConfigured ? "text-green-600 border-green-600" : "text-amber-600 border-amber-600"}>
                      {configLoading ? 'Loading...' : zendeskConfigData?.isConfigured ? 'Connected' : 'Not Configured'}
                    </Badge>
                  </div>
                  <Button 
                    className="btn-primary"
                    onClick={handleSaveZendeskConfig}
                    disabled={saveZendeskConfigMutation.isPending}
                  >
                    {saveZendeskConfigMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Configuration'
                    )}
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>
            
            {/* Ticket Management Interface */}
            <ZendeskTicketManager />
          </div>
        </CardContent>
      </Card>

      {/* HTML Page Dialog */}
      <ShipmentHtmlPage
        shipment={selectedHtmlShipment}
        isOpen={isHtmlPageOpen}
        onClose={() => {
          setIsHtmlPageOpen(false);
          setSelectedHtmlShipment(null);
        }}
      />
    </div>
  );
}