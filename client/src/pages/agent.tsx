import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Ship, Truck, Plane, FileText, Download, Search, Plus, Shield, Users, FolderOpen, UploadCloud, UserPlus, Receipt, Headphones } from "lucide-react";
import DocumentUpload from "@/components/DocumentUpload";
import DocumentList from "@/components/DocumentList";
import CreateShipmentDialog from "@/components/CreateShipmentDialog";
import InviteUserDialog from "@/components/InviteUserDialog";
import XMLIntegrationManager from "@/components/XMLIntegrationManager";
import AdminInvoiceUpload from "@/components/AdminInvoiceUpload";
import ZendeskTicketManager from "@/components/ZendeskTicketManager";
import type { Shipment, Document } from "@shared/schema";

interface DocumentFolder {
  shipmentId: number;
  documents: Document[];
}

function DocumentFolder({ shipmentId }: { shipmentId: number }) {
  const { data: documents = [] } = useQuery({
    queryKey: ["/api/documents", { shipmentId }],
    retry: false,
  });

  if ((documents as Document[]).length === 0) {
    return (
      <div className="text-center py-4 text-gray-500">
        <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
        <p className="text-sm">No documents uploaded</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {(documents as Document[]).map((document: Document) => (
        <div key={document.id} className="flex items-center justify-between p-2 border rounded hover:bg-gray-50">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium">{document.fileName}</span>
            <Badge variant="outline" className="text-xs">
              {document.category}
            </Badge>
            {document.subCategory && (
              <Badge variant="secondary" className="text-xs">
                {document.subCategory}
              </Badge>
            )}
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" asChild>
              <a href={`/api/documents/${document.id}/download`} target="_blank" rel="noopener noreferrer">
                <Download className="w-3 h-3" />
              </a>
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Agent() {
  const [searchTerm, setSearchTerm] = useState("");
  const [transportFilter, setTransportFilter] = useState("all");
  const [expandedShipments, setExpandedShipments] = useState<Set<number>>(new Set());

  const { data: assignedUsers = [] } = useQuery<any[]>({
    queryKey: ["/api/agent/assigned-users"],
  });

  const { data: allShipments = [], isLoading: shipmentsLoading } = useQuery({
    queryKey: ["/api/admin/shipments"],
    retry: false,
  });

  const { data: allDocuments = [], isLoading: documentsLoading } = useQuery({
    queryKey: ["/api/agent/documents"],
    retry: false,
  });

  const filteredShipments = (allShipments as Shipment[]).filter((shipment: Shipment) => {
    const matchesSearch = shipment.shipmentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         shipment.origin.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         shipment.destination.toLowerCase().includes(searchTerm.toLowerCase());

    if (transportFilter === "all") return matchesSearch;
    return matchesSearch && shipment.transportMode === transportFilter;
  });

  const getTransportIcon = (mode: string) => {
    switch (mode) {
      case "ocean": return <Ship className="w-4 h-4" />;
      case "air": return <Plane className="w-4 h-4" />;
      case "trucking": return <Truck className="w-4 h-4" />;
      case "last_mile": return <span className="text-green-600">🚚</span>;
      default: return <Ship className="w-4 h-4" />;
    }
  };

  const toggleExpanded = (shipmentId: number) => {
    const newExpanded = new Set(expandedShipments);
    if (newExpanded.has(shipmentId)) {
      newExpanded.delete(shipmentId);
    } else {
      newExpanded.add(shipmentId);
    }
    setExpandedShipments(newExpanded);
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2 rounded-lg">
              <Shield className="w-6 h-6 text-white" />
            </div>
            Agent Dashboard
          </h1>
          <p className="text-gray-600 mt-2">
            Manage assigned users and their shipments
          </p>
        </div>
        <div className="flex gap-3">
          <InviteUserDialog 
            trigger={
              <Button variant="outline">
                <UserPlus className="w-4 h-4 mr-2" />
                Invite User
              </Button>
            }
          />
          <CreateShipmentDialog 
            trigger={
              <Button className="bg-teal-600 hover:bg-teal-700">
                <Plus className="w-4 h-4 mr-2" />
                New Shipment
              </Button>
            } 
          />
          <DocumentUpload 
            trigger={
              <Button variant="outline">
                <UploadCloud className="w-4 h-4 mr-2" />
                Upload Document
              </Button>
            } 
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Shipments</CardTitle>
            <Ship className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(allShipments as Shipment[]).length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(allDocuments as Document[]).length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assigned Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{assignedUsers.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Shipments Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <div className="bg-teal-100 p-2 rounded-lg mr-3">
              <Ship className="w-5 h-5 text-teal-600" />
            </div>
            All Shipments Management
          </CardTitle>
          <CardDescription>
            View and manage all shipments across the platform
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search shipments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={transportFilter} onValueChange={setTransportFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by transport mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Transport Modes</SelectItem>
                <SelectItem value="ocean">Ocean</SelectItem>
                <SelectItem value="air">Air</SelectItem>
                <SelectItem value="trucking">Trucking</SelectItem>
                <SelectItem value="last_mile">Last Mile</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Shipments Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Shipment ID</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Transport</TableHead>
                  <TableHead>BL/Container</TableHead>
                  <TableHead>Documents</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shipmentsLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      Loading shipments...
                    </TableCell>
                  </TableRow>
                ) : filteredShipments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      No shipments found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredShipments.map((shipment: Shipment) => {
                    const isExpanded = expandedShipments.has(shipment.id);
                    return (
                      <>
                        <TableRow key={shipment.id} className="hover:bg-gray-50">
                          <TableCell className="font-medium">{shipment.shipmentId}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div className="font-medium">{shipment.userId}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div>{shipment.origin} → {shipment.destination}</div>
                              {shipment.originPort && shipment.destinationPort && (
                                <div className="text-gray-500 text-xs">
                                  {shipment.originPort} → {shipment.destinationPort}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getTransportIcon(shipment.transportMode)}
                              <span className="capitalize text-sm">{shipment.transportMode.replace('_', ' ')}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {shipment.billOfLading && (
                                <div>BL: {shipment.billOfLading}</div>
                              )}
                              {shipment.containerNumber && (
                                <div>Container: {shipment.containerNumber}</div>
                              )}
                              {!shipment.billOfLading && !shipment.containerNumber && (
                                <span className="text-gray-400">Not specified</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleExpanded(shipment.id)}
                              className="flex items-center gap-1"
                            >
                              <FolderOpen className="w-4 h-4" />
                              {isExpanded ? "Hide" : "View"}
                            </Button>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <DocumentUpload 
                                shipmentId={shipment.id}
                                trigger={
                                  <Button variant="ghost" size="sm">
                                    <UploadCloud className="w-4 h-4" />
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
                                <h4 className="font-medium mb-3 text-gray-900 flex items-center">
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
        </CardContent>
      </Card>

      {/* Recent Documents */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <div className="bg-blue-100 p-2 rounded-lg mr-3">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            Recent Documents
          </CardTitle>
          <CardDescription>
            Latest documents uploaded across all shipments
          </CardDescription>
        </CardHeader>
        <CardContent>
          {documentsLoading ? (
            <div className="text-center py-8 text-gray-500">Loading documents...</div>
          ) : (
            <DocumentList showAll={true} />
          )}
        </CardContent>
      </Card>

      {/* XML Integration Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <div className="bg-gradient-to-br from-orange-500 to-red-600 p-2 rounded-lg mr-3">
              <FileText className="w-5 h-5 text-white" />
            </div>
            XML Integration Manager
          </CardTitle>
          <CardDescription>
            Process shipment data from external systems using industry-standard XML formats
          </CardDescription>
        </CardHeader>
        <CardContent>
          <XMLIntegrationManager />
        </CardContent>
      </Card>

      {/* Invoice Management */}
      <Card>
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

      {/* Zendesk Support Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <div className="bg-gradient-to-br from-blue-500 to-cyan-600 p-2 rounded-lg mr-3">
              <Shield className="w-5 h-5 text-white" />
            </div>
            Customer Support - Zendesk
          </CardTitle>
          <CardDescription>
            Manage customer support tickets and track support statistics through Zendesk integration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ZendeskTicketManager />
        </CardContent>
      </Card>
    </div>
  );
}