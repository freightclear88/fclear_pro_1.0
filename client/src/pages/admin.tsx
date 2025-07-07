import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Shield, Download, Copy, Search, Calendar, FileText, Ship, Users } from "lucide-react";
import type { Shipment, Document, User } from "@shared/schema";

export default function Admin() {
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const { toast } = useToast();

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

  const handleCopyShipmentData = async (shipment: Shipment) => {
    const shipmentHTML = `
<div class="shipment-data">
  <h2>Shipment Details - ${shipment.shipmentId}</h2>
  <table>
    <tr><td><strong>Shipment ID:</strong></td><td>${shipment.shipmentId}</td></tr>
    <tr><td><strong>Origin:</strong></td><td>${shipment.origin}</td></tr>
    <tr><td><strong>Origin Port:</strong></td><td>${shipment.originPort || 'N/A'}</td></tr>
    <tr><td><strong>Destination:</strong></td><td>${shipment.destination}</td></tr>
    <tr><td><strong>Destination Port:</strong></td><td>${shipment.destinationPort || 'N/A'}</td></tr>
    <tr><td><strong>Status:</strong></td><td>${shipment.status}</td></tr>
    <tr><td><strong>Vessel:</strong></td><td>${shipment.vessel || 'N/A'}</td></tr>
    <tr><td><strong>Container:</strong></td><td>${shipment.containerNumber || 'N/A'}</td></tr>
    <tr><td><strong>Bill of Lading:</strong></td><td>${shipment.billOfLading || 'N/A'}</td></tr>
    <tr><td><strong>Total Value:</strong></td><td>$${shipment.totalValue || '0'}</td></tr>
    <tr><td><strong>Created:</strong></td><td>${new Date(shipment.createdAt!).toLocaleDateString()}</td></tr>
  </table>
</div>`;

    try {
      await navigator.clipboard.writeText(shipmentHTML);
      toast({
        title: "HTML Copied",
        description: "Shipment HTML data copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy HTML data",
        variant: "destructive",
      });
    }
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
            className="bg-freight-green hover:bg-freight-green/90 text-white"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Users</p>
                <p className="text-3xl font-bold text-freight-dark">
                  {allUsers.length}
                </p>
              </div>
              <div className="bg-freight-blue/10 p-3 rounded-lg">
                <Users className="w-6 h-6 text-freight-blue" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Shipments</p>
                <p className="text-3xl font-bold text-freight-dark">
                  {allShipments.length}
                </p>
              </div>
              <div className="bg-freight-orange/10 p-3 rounded-lg">
                <Ship className="w-6 h-6 text-freight-orange" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Documents</p>
                <p className="text-3xl font-bold text-freight-dark">
                  {allDocuments.length}
                </p>
              </div>
              <div className="bg-freight-green/10 p-3 rounded-lg">
                <FileText className="w-6 h-6 text-freight-green" />
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

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search shipments by ID, origin, or destination..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <Select value={dateFilter} onValueChange={setDateFilter}>
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
                  <TableHead>Value</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredShipments.map((shipment) => {
                  const user = allUsers.find(u => u.id === shipment.userId);
                  return (
                    <TableRow key={shipment.id} className="hover:bg-gray-50">
                      <TableCell>
                        <div className="font-medium text-freight-dark">{shipment.shipmentId}</div>
                        {shipment.containerNumber && (
                          <div className="text-sm text-gray-500">Container: {shipment.containerNumber}</div>
                        )}
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
                        <span className="font-medium">
                          ${shipment.totalValue ? parseFloat(shipment.totalValue).toLocaleString() : "0"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {new Date(shipment.createdAt!).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyShipmentData(shipment)}
                          className="text-freight-orange hover:text-freight-dark"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}