import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import DocumentUpload from "@/components/DocumentUpload";
import ShipmentTable from "@/components/ShipmentTable";
import ShipmentDetail from "@/components/ShipmentDetail";
import CreateShipmentDialog from "@/components/CreateShipmentDialog";

import { Ship, FileText, CheckCircle, Plus, Bell, FileUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Shipment } from "@shared/schema";

export default function Dashboard() {
  const { user } = useAuth();
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDetailOpen, setIsDetailOpen] = useState(false);

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

  const handleViewShipment = (shipment: Shipment) => {
    console.log('Dashboard handleViewShipment called with:', shipment);
    setSelectedShipment(shipment);
    setIsDetailOpen(true);
  };

  const handleCloseDetail = () => {
    setIsDetailOpen(false);
    setSelectedShipment(null);
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
        <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
          <CreateShipmentDialog trigger={
            <Button className="btn-secondary w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Create Shipment
            </Button>
          } />
          <DocumentUpload 
            trigger={
              <Button className="btn-primary w-full sm:w-auto">
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

          <Button className="btn-ghost relative w-full sm:w-auto">
            <Bell className="w-5 h-5" />
            <Badge className="absolute -top-1 -right-1 bg-neon-green text-white text-xs w-5 h-5 flex items-center justify-center p-0">
              3
            </Badge>
          </Button>
        </div>
      </div>

      {/* Multi-Document Processing Feature Highlight */}
      <Card className="gradient-primary border-0 mb-6 lg:mb-8">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-xl font-bold text-white mb-3 flex items-center">
                <FileUp className="w-6 h-6 mr-3" />
                Comprehensive Multi-Document Processing
              </h3>
              <p className="text-blue-100 mb-4 text-sm lg:text-base">
                Upload multiple shipping documents simultaneously (Bill of Lading, Commercial Invoice, 
                Packing List, etc.) and our AI will automatically extract and consolidate all relevant 
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
                    Try Multi-Document Upload
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

      {/* Stats Cards */}
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

        <Card className="gradient-card hover-glow border-0">
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Processed This Month</p>
                <p className="text-3xl font-bold text-freight-dark">
                  {stats?.processedThisMonth || 0}
                </p>
              </div>
              <div className="bg-powder-blue/15 p-3 rounded-lg">
                <CheckCircle className="w-6 h-6 text-powder-blue" />
              </div>
            </div>
          </CardContent>
        </Card>


      </div>

      {/* Document Upload and Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 mb-6 lg:mb-8">
        <div className="lg:col-span-2">
          {recentShipments.length > 0 ? (
            <DocumentUpload shipmentId={recentShipments[0].id} />
          ) : (
            <Card>
              <CardContent className="p-4 lg:p-6">
                <p className="text-gray-500 text-center text-sm lg:text-base">
                  Create your first shipment to start uploading documents
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <Card>
          <CardHeader className="p-4 lg:p-6">
            <CardTitle className="text-lg lg:text-xl">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="p-4 lg:p-6">
            {recentShipments.length > 0 ? (
              <div className="space-y-4">
                {recentShipments.map((shipment: Shipment) => (
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

      {/* How Multi-Document Processing Works */}
      <Card className="mb-6 lg:mb-8 border-gray-200">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-freight-dark flex items-center">
            <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
            How Multi-Document Processing Works
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3">
                <FileUp className="w-8 h-8 text-blue-600" />
              </div>
              <h4 className="font-semibold text-freight-dark mb-2">1. Upload Multiple Documents</h4>
              <p className="text-sm text-gray-600">
                Select up to 10 documents including Bill of Lading, Commercial Invoice, Packing List, and more
              </p>
            </div>
            <div className="text-center">
              <div className="bg-green-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3">
                <FileText className="w-8 h-8 text-green-600" />
              </div>
              <h4 className="font-semibold text-freight-dark mb-2">2. AI Data Extraction</h4>
              <p className="text-sm text-gray-600">
                Azure Document Intelligence and OpenAI extract and map all relevant shipping data
              </p>
            </div>
            <div className="text-center">
              <div className="bg-purple-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3">
                <Ship className="w-8 h-8 text-purple-600" />
              </div>
              <h4 className="font-semibold text-freight-dark mb-2">3. Consolidated Shipment</h4>
              <p className="text-sm text-gray-600">
                All data is intelligently consolidated to create a complete shipment with comprehensive details
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Shipments */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center">
              <Ship className="w-5 h-5 mr-2 text-freight-blue" />
              Active Shipments
            </CardTitle>
            <Button variant="ghost" className="text-freight-orange hover:text-freight-dark">
              View All →
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ShipmentTable shipments={shipments as Shipment[]} onViewShipment={handleViewShipment} />
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
