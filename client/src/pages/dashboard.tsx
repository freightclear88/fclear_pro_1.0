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
import type { Shipment, Document } from "@shared/schema";

export default function Dashboard() {
  const { user } = useAuth();
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const { data: stats } = useQuery({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: shipments = [] } = useQuery({
    queryKey: ["/api/shipments"],
  });

  const { data: documents = [] } = useQuery({
    queryKey: ["/api/documents"],
  });

  const handleViewShipment = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    setIsDetailOpen(true);
  };

  const handleCloseDetail = () => {
    setIsDetailOpen(false);
    setSelectedShipment(null);
  };



  const recentShipments = shipments.slice(0, 10);
  const recentDocuments = documents.slice(0, 10);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-freight-dark">Dashboard</h2>
          <p className="text-gray-600">
            Welcome back, {user?.firstName || "User"}
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <CreateShipmentDialog trigger={
            <Button className="btn-secondary">
              <Plus className="w-4 h-4 mr-2" />
              Create Shipment
            </Button>
          } />
          <DocumentUpload 
            trigger={
              <Button className="btn-outline-primary">
                <FileUp className="w-4 h-4 mr-2" />
                Upload Documents
              </Button>
            }
            onShipmentCreated={(shipment) => {
              setTimeout(() => {
                window.location.reload();
              }, 1000);
            }} 
          />

          <Button className="btn-ghost relative">
            <Bell className="w-5 h-5" />
            <Badge className="absolute -top-1 -right-1 bg-neon-green text-white text-xs w-5 h-5 flex items-center justify-center p-0">
              3
            </Badge>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <Card className="gradient-card hover-glow border-0">
          <CardContent className="p-6">
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
          <CardContent className="p-6">
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
          <CardContent className="p-6">
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

      {/* Quick Upload Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          {recentShipments.length > 0 ? (
            <DocumentUpload shipmentId={recentShipments[0].id} />
          ) : (
            <Card>
              <CardContent className="p-6">
                <p className="text-gray-500 text-center">
                  Create your first shipment to start uploading documents
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {(recentShipments.length > 0 || recentDocuments.length > 0) ? (
              <div className="space-y-4">
                {/* Recent Shipments */}
                {recentShipments.slice(0, 2).map((shipment) => (
                  <div key={`shipment-${shipment.id}`} className="flex items-start space-x-3">
                    <div className="bg-freight-blue/10 p-2 rounded-full">
                      <Ship className="w-4 h-4 text-freight-blue" />
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
                {/* Recent Documents */}
                {recentDocuments.slice(0, 2).map((document) => (
                  <div key={`document-${document.id}`} className="flex items-start space-x-3">
                    <div className="bg-neon-green/10 p-2 rounded-full">
                      <FileText className="w-4 h-4 text-neon-green" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-freight-dark">
                        Document uploaded
                      </p>
                      <p className="text-xs text-gray-500">
                        {document.filename} - {new Date(document.createdAt!).toLocaleDateString()}
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

      {/* Recent Shipments and Documents */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center">
                <Ship className="w-5 h-5 mr-2 text-freight-blue" />
                Recent Shipments
              </CardTitle>
              <Button variant="ghost" className="text-freight-orange hover:text-freight-dark">
                View All →
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentShipments.length > 0 ? (
              <div className="space-y-3">
                {recentShipments.map((shipment) => (
                  <div key={shipment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer" onClick={() => handleViewShipment(shipment)}>
                    <div className="flex items-center space-x-3">
                      <div className="bg-freight-blue/10 p-2 rounded-full">
                        <Ship className="w-4 h-4 text-freight-blue" />
                      </div>
                      <div>
                        <p className="font-medium text-freight-dark">{shipment.shipmentId}</p>
                        <p className="text-sm text-gray-500">{shipment.transportMode} • {shipment.origin} → {shipment.destination}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">{new Date(shipment.createdAt!).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No shipments available</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center">
                <FileText className="w-5 h-5 mr-2 text-neon-green" />
                Recent Documents
              </CardTitle>
              <Button variant="ghost" className="text-freight-orange hover:text-freight-dark">
                View All →
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentDocuments.length > 0 ? (
              <div className="space-y-3">
                {recentDocuments.map((document: Document) => (
                  <div key={document.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex items-center space-x-3">
                      <div className="bg-neon-green/10 p-2 rounded-full">
                        <FileText className="w-4 h-4 text-neon-green" />
                      </div>
                      <div>
                        <p className="font-medium text-freight-dark">{document.filename}</p>
                        <p className="text-sm text-gray-500">{document.category.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">{new Date(document.createdAt!).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No documents available</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* All Shipments Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center">
              <Ship className="w-5 h-5 mr-2 text-freight-blue" />
              All Shipments
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ShipmentTable shipments={shipments} onViewShipment={handleViewShipment} />
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
