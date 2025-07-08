import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ShipmentTable from "@/components/ShipmentTable";
import ShipmentDetail from "@/components/ShipmentDetail";
import CreateShipmentDialog from "@/components/CreateShipmentDialog";
import DocumentUpload from "@/components/DocumentUpload";
import DocumentList from "@/components/DocumentList";
import { Ship, Plus, Search, FileText, Package } from "lucide-react";
import type { Shipment } from "@shared/schema";

export default function Shipments() {
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("shipments");

  const { data: shipments = [] } = useQuery({
    queryKey: ["/api/shipments"],
  });

  const filteredShipments = shipments.filter((shipment: Shipment) =>
    shipment.shipmentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    shipment.origin.toLowerCase().includes(searchTerm.toLowerCase()) ||
    shipment.destination.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleViewShipment = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    setIsDetailOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Shipments & Documents</h1>
          <p className="text-gray-600 mt-1">Manage your freight shipments and associated documents</p>
        </div>
        <div className="flex space-x-3">
          <DocumentUpload 
            shipmentId={selectedShipment?.id}
            trigger={
              <Button variant="outline" className="border-freight-orange text-freight-orange hover:bg-freight-orange hover:text-white">
                <Plus className="w-4 h-4 mr-2" />
                Upload Documents
              </Button>
            }
            onShipmentCreated={(shipment) => {
              setSelectedShipment(shipment);
              setActiveTab("documents");
            }}
          />
          <CreateShipmentDialog trigger={
            <Button className="bg-freight-blue hover:bg-freight-blue/90">
              <Plus className="w-4 h-4 mr-2" />
              Create Shipment
            </Button>
          } />
        </div>
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="shipments" className="flex items-center space-x-2">
            <Ship className="w-4 h-4" />
            <span>Shipments ({filteredShipments.length})</span>
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex items-center space-x-2">
            <FileText className="w-4 h-4" />
            <span>Documents</span>
          </TabsTrigger>
        </TabsList>

        {/* Shipments Tab */}
        <TabsContent value="shipments" className="space-y-6">
          {/* Search */}
          <Card>
            <CardContent className="p-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search shipments by ID, origin, or destination..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>

          {/* Shipments Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Ship className="w-5 h-5 mr-2 text-freight-blue" />
                Active Shipments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ShipmentTable shipments={filteredShipments} onViewShipment={handleViewShipment} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-6">
          {/* Shipment Selection for Documents */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Package className="w-5 h-5 mr-2 text-freight-blue" />
                Document Management by Shipment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2">
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-700">Select Shipment:</label>
                    <select
                      value={selectedShipment?.id || ""}
                      onChange={(e) => {
                        const shipment = shipments.find((s: Shipment) => s.id === parseInt(e.target.value));
                        setSelectedShipment(shipment || null);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-freight-blue"
                    >
                      <option value="">Choose a shipment to view its documents</option>
                      {shipments.map((shipment: Shipment) => (
                        <option key={shipment.id} value={shipment.id}>
                          {shipment.shipmentId} - {shipment.origin} → {shipment.destination}
                        </option>
                      ))}
                    </select>
                    
                    {selectedShipment && (
                      <div className="p-3 bg-freight-blue/5 rounded-lg">
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
                </div>
                
                <div>
                  <DocumentUpload 
                    shipmentId={selectedShipment?.id}
                    trigger={
                      <div className="border-2 border-dashed border-freight-blue/30 rounded-lg p-4 text-center hover:border-freight-blue transition-colors cursor-pointer h-full flex flex-col justify-center">
                        <FileText className="w-8 h-8 text-freight-blue mx-auto mb-2" />
                        <p className="text-sm font-medium text-freight-dark">
                          {selectedShipment ? 'Add to Shipment' : 'Create New Shipment'}
                        </p>
                        <p className="text-xs text-gray-500">Upload documents</p>
                      </div>
                    }
                    onShipmentCreated={(shipment) => {
                      setSelectedShipment(shipment);
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Document List for Selected Shipment */}
          {selectedShipment ? (
            <DocumentList 
              shipmentId={selectedShipment.id} 
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
        </TabsContent>
      </Tabs>

      {/* Shipment Detail Modal */}
      <ShipmentDetail
        shipment={selectedShipment}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
      />
    </div>
  );
}