import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ShipmentTable from "@/components/ShipmentTable";
import ShipmentDetail from "@/components/ShipmentDetail";
import CreateShipmentDialog from "@/components/CreateShipmentDialog";
import DocumentUpload from "@/components/DocumentUpload";
import { Ship, Plus, Search } from "lucide-react";
import type { Shipment } from "@shared/schema";

export default function Shipments() {
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");


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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center pt-6 pb-4">
        <div className="px-2">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Shipments</h1>
          <p className="text-gray-600 mt-2">Track and manage your freight shipments</p>
        </div>
        <div className="flex space-x-3">
          <DocumentUpload 
            trigger={
              <Button className="btn-outline-primary">
                <Plus className="w-4 h-4 mr-2" />
                Upload Documents
              </Button>
            }
          />
          <CreateShipmentDialog trigger={
            <Button className="btn-secondary">
              <Plus className="w-4 h-4 mr-2" />
              Create Shipment
            </Button>
          } />
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-8">
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
        <CardHeader className="pb-6">
          <CardTitle className="flex items-center text-2xl py-2">
            <Ship className="w-6 h-6 mr-3 text-freight-blue" />
            Active Shipments ({filteredShipments.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ShipmentTable shipments={filteredShipments} onViewShipment={handleViewShipment} />
        </CardContent>
      </Card>

      {/* Shipment Detail Modal */}
      <ShipmentDetail
        shipment={selectedShipment}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
      />
    </div>
  );
}