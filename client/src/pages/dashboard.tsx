import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import DocumentUpload from "@/components/DocumentUpload";
import ShipmentTable from "@/components/ShipmentTable";
import ShipmentDetail from "@/components/ShipmentDetail";
import CreateShipmentDialog from "@/components/CreateShipmentDialog";
import NotificationDropdown from "@/components/NotificationDropdown";

import { Ship, FileText, CheckCircle, Plus, Bell, FileUp, ChevronLeft, ChevronRight, Clock, DollarSign, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import type { Shipment, IsfFiling } from "@shared/schema";

export default function Dashboard() {
  const { user } = useAuth();
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  
  // Pagination states
  const [shipmentsPage, setShipmentsPage] = useState(1);
  const [isfFilingsPage, setIsfFilingsPage] = useState(1);
  const shipmentsPerPage = 10;
  const isfFilingsPerPage = 5;

  const { data: stats } = useQuery<{
    activeShipments: number;
    pendingDocuments: number;
    processedThisMonth: number;
  }>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: shipments = [] } = useQuery<Shipment[]>({
    queryKey: ["/api/shipments"],
  });

  const { data: isfFilings = [] } = useQuery<IsfFiling[]>({
    queryKey: ["/api/isf/filings"],
  });

  // Pagination calculations
  const totalShipments = shipments.length;
  const totalShipmentsPages = Math.ceil(totalShipments / shipmentsPerPage);
  const startShipmentIndex = (shipmentsPage - 1) * shipmentsPerPage;
  const endShipmentIndex = startShipmentIndex + shipmentsPerPage;
  const paginatedShipments = shipments.slice(startShipmentIndex, endShipmentIndex);

  const totalIsfFilings = isfFilings.length;
  const totalIsfFilingsPages = Math.ceil(totalIsfFilings / isfFilingsPerPage);
  const startIsfIndex = (isfFilingsPage - 1) * isfFilingsPerPage;
  const endIsfIndex = startIsfIndex + isfFilingsPerPage;
  const paginatedIsfFilings = isfFilings.slice(startIsfIndex, endIsfIndex);

  const handleViewShipment = (shipment: Shipment) => {
    console.log('Dashboard handleViewShipment called with:', shipment);
    setSelectedShipment(shipment);
    setIsDetailOpen(true);
  };

  const handleCloseDetail = () => {
    setIsDetailOpen(false);
    setSelectedShipment(null);
  };

  // ISF status helper functions
  const getIsfStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "paid":
        return <DollarSign className="w-4 h-4 text-blue-500" />;
      case "submitted":
        return <FileText className="w-4 h-4 text-orange-500" />;
      case "draft":
        return <Clock className="w-4 h-4 text-gray-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getIsfStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "paid":
        return "bg-blue-100 text-blue-800";
      case "submitted":
        return "bg-orange-100 text-orange-800";
      case "draft":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-red-100 text-red-800";
    }
  };



  const recentShipments = shipments.slice(0, 3);

  return (
    <div className="p-3 lg:p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center mb-6 lg:mb-8 space-y-4 lg:space-y-0">
        <div>
          <h2 className="text-xl lg:text-2xl font-bold text-freight-dark">Dashboard</h2>
          <p className="text-gray-600 text-sm lg:text-base">
            Welcome back, {user?.firstName || "User"}
          </p>
        </div>
        <div className="flex justify-end">
          <NotificationDropdown />
        </div>
      </div>

      {/* Multi-Document Processing Feature Highlight */}
      <Card className="gradient-primary border-0 mb-6 lg:mb-8">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-2xl lg:text-3xl font-bold text-white mb-3 flex items-center">
                <FileUp className="w-7 h-7 mr-3" />
                Create Shipment
              </h1>
              <h3 className="text-xl font-semibold text-white mb-3">
                Comprehensive Multi-Document Processing
              </h3>
              <p className="text-blue-100 mb-4 text-sm lg:text-base">
                Upload multiple shipping documents simultaneously (Bill of Lading, Commercial Invoice, 
                Packing List, etc.) and our intelligent processing system will automatically extract and consolidate all relevant 
                data to create complete shipments with comprehensive information from all documents.
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                <Badge className="bg-white/20 text-white border-white/30">Bill of Lading</Badge>
                <Badge className="bg-white/20 text-white border-white/30">Commercial Invoice</Badge>
                <Badge className="bg-white/20 text-white border-white/30">Packing List</Badge>
                <Badge className="bg-white/20 text-white border-white/30">Arrival Notice</Badge>
                <Badge className="bg-white/20 text-white border-white/30">+ More</Badge>
              </div>
            </div>
            <div className="hidden lg:block">
              <DocumentUpload 
                trigger={
                  <Button className="bg-white text-freight-blue hover:bg-gray-100">
                    <FileUp className="w-4 h-4 mr-2" />
                    Multi-Document Upload
                  </Button>
                }
                onShipmentCreated={(shipment) => {
                  queryClient.invalidateQueries({ queryKey: ["/api/shipments"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
                  setTimeout(() => {
                    window.location.reload();
                  }, 1000);
                }} 
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards with Recent Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 mb-6 lg:mb-8">
        <Card className="gradient-card hover-glow border-0">
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Shipments</p>
                <p className="text-3xl font-bold text-freight-dark">
                  {stats?.activeShipments || 0}
                </p>
              </div>
              <div className="bg-teal/10 p-3 rounded-lg">
                <Ship className="w-6 h-6 text-teal" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="gradient-card hover-glow border-0">
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Documents</p>
                <p className="text-3xl font-bold text-freight-dark">
                  {stats?.pendingDocuments || 0}
                </p>
              </div>
              <div className="bg-neon-green/10 p-3 rounded-lg">
                <FileText className="w-6 h-6 text-neon-green" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 lg:p-6">
            <CardTitle className="text-lg lg:text-xl">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="p-4 lg:p-6">
            {recentShipments.length > 0 ? (
              <div className="space-y-4">
                {recentShipments.slice(0, 2).map((shipment: Shipment) => (
                  <div key={shipment.id} className="flex items-start space-x-3">
                    <div className="bg-freight-green/10 p-2 rounded-full">
                      <CheckCircle className="w-4 h-4 text-freight-green" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-freight-dark">
                        Shipment created
                      </p>
                      <p className="text-xs text-gray-500">
                        {shipment.shipmentId} - {new Date(shipment.createdAt!).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No recent activity</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Active Shipments with Pagination */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center">
              <Ship className="w-5 h-5 mr-2 text-freight-blue" />
              Active Shipments ({totalShipments})
            </CardTitle>
            <Link href="/shipments">
              <Button variant="ghost" className="text-freight-orange hover:text-freight-dark">
                View All →
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <ShipmentTable shipments={paginatedShipments as Shipment[]} onViewShipment={handleViewShipment} />
          
          {/* Shipments Pagination */}
          {totalShipmentsPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-gray-500">
                Showing {startShipmentIndex + 1}-{Math.min(endShipmentIndex, totalShipments)} of {totalShipments} shipments
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShipmentsPage(Math.max(1, shipmentsPage - 1))}
                  disabled={shipmentsPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>
                <span className="text-sm">
                  Page {shipmentsPage} of {totalShipmentsPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShipmentsPage(Math.min(totalShipmentsPages, shipmentsPage + 1))}
                  disabled={shipmentsPage === totalShipmentsPages}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ISF Filings Section */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center">
              <FileText className="w-5 h-5 mr-2 text-teal-600" />
              ISF Filings ({totalIsfFilings})
            </CardTitle>
            <Link href="/isf">
              <Button variant="ghost" className="text-freight-orange hover:text-freight-dark">
                View All →
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {paginatedIsfFilings.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500 mb-2">No ISF filings yet</p>
              <p className="text-sm text-gray-400">Create your first ISF 10+2 filing to get started</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ISF Number</TableHead>
                    <TableHead>Consignee</TableHead>
                    <TableHead>Port of Entry</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedIsfFilings.map((filing) => (
                    <TableRow key={filing.id}>
                      <TableCell className="font-medium">{filing.isfNumber}</TableCell>
                      <TableCell>{filing.consignee}</TableCell>
                      <TableCell>{filing.portOfEntry}</TableCell>
                      <TableCell>
                        <Badge className={getIsfStatusColor(filing.status)} variant="secondary">
                          <div className="flex items-center gap-1">
                            {getIsfStatusIcon(filing.status)}
                            {filing.status}
                          </div>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Link href={`/isf/detail/${filing.id}`}>
                          <Button variant="outline" size="sm">
                            View Details
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* ISF Filings Pagination */}
              {totalIsfFilingsPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-gray-500">
                    Showing {startIsfIndex + 1}-{Math.min(endIsfIndex, totalIsfFilings)} of {totalIsfFilings} ISF filings
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsfFilingsPage(Math.max(1, isfFilingsPage - 1))}
                      disabled={isfFilingsPage === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </Button>
                    <span className="text-sm">
                      Page {isfFilingsPage} of {totalIsfFilingsPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsfFilingsPage(Math.min(totalIsfFilingsPages, isfFilingsPage + 1))}
                      disabled={isfFilingsPage === totalIsfFilingsPages}
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Shipment Detail Modal */}
      <ShipmentDetail
        shipment={selectedShipment}
        isOpen={isDetailOpen}
        onClose={handleCloseDetail}
      />
    </div>
  );
}
