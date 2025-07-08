import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import DocumentList from "@/components/DocumentList";
import DocumentUpload from "@/components/DocumentUpload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Upload, Plus, Package, Ship, Plane, Truck } from "lucide-react";
import type { Shipment } from "@shared/schema";

export default function Documents() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [selectedShipmentId, setSelectedShipmentId] = useState<number | null>(null);

  const { data: shipments = [], isLoading: shipmentsLoading } = useQuery({
    queryKey: ["/api/shipments"],
  });

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const getTransportIcon = (mode: string) => {
    switch (mode?.toLowerCase()) {
      case 'air': return Plane;
      case 'ocean': return Ship;
      case 'trucking': return Truck;
      default: return Package;
    }
  };

  if (isLoading || shipmentsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-freight-blue mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const selectedShipment = selectedShipmentId ? shipments.find((s: Shipment) => s.id === selectedShipmentId) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Document Management</h1>
          <p className="text-gray-600 mt-1">Organize documents by shipment for streamlined freight management</p>
        </div>
        <DocumentUpload 
          shipmentId={selectedShipmentId || undefined}
          trigger={
            <Button className="bg-freight-blue hover:bg-freight-blue/90">
              <Plus className="w-4 h-4 mr-2" />
              Upload Document
            </Button>
          }
          onShipmentCreated={(shipment) => {
            setSelectedShipmentId(shipment.id);
          }}
        />
      </div>

      {/* Shipment Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Package className="w-5 h-5 mr-2 text-freight-blue" />
            Select Shipment for Document Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <Select 
                value={selectedShipmentId?.toString() || ""} 
                onValueChange={(value) => setSelectedShipmentId(value ? parseInt(value) : null)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a shipment to view its documents" />
                </SelectTrigger>
                <SelectContent>
                  {shipments.map((shipment: Shipment) => {
                    const TransportIcon = getTransportIcon(shipment?.transportMode || 'ocean');
                    return (
                      <SelectItem key={shipment.id} value={shipment.id!.toString()}>
                        <div className="flex items-center space-x-2">
                          <TransportIcon className="w-4 h-4" />
                          <span className="font-medium">{shipment.shipmentId}</span>
                          <span className="text-gray-500">•</span>
                          <span className="text-sm">{shipment.origin} → {shipment.destination}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              
              {selectedShipment && (
                <div className="mt-3 p-3 bg-freight-blue/5 rounded-lg">
                  <div className="flex items-center space-x-2 text-sm">
                    <Package className="w-4 h-4 text-freight-blue" />
                    <span className="font-medium">{selectedShipment.shipmentId}</span>
                    <span>•</span>
                    <span>{selectedShipment.vessel || 'Vessel TBD'}</span>
                    <span>•</span>
                    <span className="text-freight-orange">{selectedShipment.status}</span>
                  </div>
                </div>
              )}
            </div>
            
            <div>
              <DocumentUpload 
                shipmentId={selectedShipmentId || undefined}
                trigger={
                  <div className="border-2 border-dashed border-freight-blue/30 rounded-lg p-4 text-center hover:border-freight-blue transition-colors cursor-pointer h-full flex flex-col justify-center">
                    <FileText className="w-8 h-8 text-freight-blue mx-auto mb-2" />
                    <p className="text-sm font-medium text-freight-dark">
                      {selectedShipmentId ? 'Add to Shipment' : 'Create New Shipment'}
                    </p>
                    <p className="text-xs text-gray-500">Upload documents</p>
                  </div>
                }
                onShipmentCreated={(shipment) => {
                  setSelectedShipmentId(shipment.id);
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Document List for Selected Shipment */}
      {selectedShipmentId ? (
        <DocumentList 
          shipmentId={selectedShipmentId} 
          showAll={false}
        />
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-700 mb-2">Select a Shipment to View Documents</h3>
            <p className="text-gray-500">
              Choose a shipment from the dropdown above to view and manage its associated documents.
              Each shipment maintains its own dedicated document folder for organized freight management.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}