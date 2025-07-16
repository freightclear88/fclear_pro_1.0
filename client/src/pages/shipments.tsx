import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ShipmentTable from "@/components/ShipmentTable";
import ShipmentDetail from "@/components/ShipmentDetail";
import CreateShipmentDialog from "@/components/CreateShipmentDialog";
import DocumentUpload from "@/components/DocumentUpload";
import { Ship, Plus, Search, ChevronLeft, ChevronRight } from "lucide-react";
import type { Shipment } from "@shared/schema";

export default function Shipments() {
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [shipmentsPerPage, setShipmentsPerPage] = useState(10);


  const { data: shipments = [] } = useQuery<Shipment[]>({
    queryKey: ["/api/shipments"],
  });

  const filteredShipments = shipments.filter((shipment: Shipment) =>
    shipment.shipmentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    shipment.origin.toLowerCase().includes(searchTerm.toLowerCase()) ||
    shipment.destination.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  const handlePageSizeChange = (value: string) => {
    setShipmentsPerPage(parseInt(value));
    setCurrentPage(1); // Reset to page 1 when changing page size
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1); // Reset to page 1 when searching
  };

  const handleViewShipment = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    setIsDetailOpen(true);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center pt-6 pb-4">
        <div className="px-6 ml-4">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Shipments</h1>
          <p className="text-gray-600 mt-2">Track and manage your freight shipments</p>
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-800 text-sm leading-relaxed">
              Our AI automatically scans and transforms your BL, AWB and ISF data into a new shipment in Freightclear Workflows. Upload a doc to get started.
            </p>
          </div>
        </div>
        <div className="flex space-x-3 pr-8 mr-6">
          <DocumentUpload 
            trigger={
              <Button className="btn-outline-primary">
                <Plus className="w-4 h-4 mr-2" />
                Upload Documents
              </Button>
            }
          />
          <CreateShipmentDialog trigger={
            <Button className="btn-secondary mr-4">
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
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Shipments Table */}
      <Card>
        <CardHeader className="pb-6">
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center text-2xl py-2">
              <Ship className="w-6 h-6 mr-3 text-freight-blue" />
              Active Shipments ({filteredShipments.length})
            </CardTitle>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Show:</span>
                <Select value={shipmentsPerPage.toString()} onValueChange={handlePageSizeChange}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-gray-600">per page</span>
              </div>
              {totalPages > 1 && (
                <div className="text-sm text-gray-500">
                  Page {currentPage} of {totalPages}
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <ShipmentTable shipments={paginatedShipments} onViewShipment={handleViewShipment} />
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t pt-6 mt-6">
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

      {/* Shipment Detail Modal */}
      <ShipmentDetail
        shipment={selectedShipment}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
      />
    </div>
  );
}