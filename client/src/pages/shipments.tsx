import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ShipmentTable from "@/components/ShipmentTable";
import ShipmentDetail from "@/components/ShipmentDetail";
import CreateShipmentDialog from "@/components/CreateShipmentDialog";
import DocumentUpload from "@/components/DocumentUpload";
import { Ship, Plus, Search, ChevronLeft, ChevronRight, FileUp, CheckCircle, FileText } from "lucide-react";
import type { Shipment } from "@shared/schema";

export default function Shipments() {
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [shipmentsPerPage, setShipmentsPerPage] = useState(10);
  const queryClient = useQueryClient();


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
    <div className="space-y-4 lg:space-y-8">
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
                  setTimeout(() => {
                    window.location.reload();
                  }, 1000);
                }} 
              />
            </div>
          </div>
        </CardContent>
      </Card>

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
              <h4 className="font-semibold text-freight-dark mb-2">2. Intelligent Data Extraction</h4>
              <p className="text-sm text-gray-600">
                Advanced document processing technology extracts and maps all relevant shipping data
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

      {/* Header with Status Card */}
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start space-y-4 lg:space-y-0 pt-2 lg:pt-6 pb-4">
        <div className="px-2 lg:px-6 lg:ml-4">
          <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2 lg:mb-3">Manage Shipments</h2>
          <p className="text-gray-600 text-sm lg:text-base">Track and manage your freight shipments</p>
        </div>
        <div className="px-2 lg:pr-8 lg:mr-6">
          <Card className="gradient-card hover-glow border-0">
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Shipments</p>
                  <p className="text-3xl font-bold text-freight-dark">
                    {shipments.length}
                  </p>
                </div>
                <div className="bg-teal/10 p-3 rounded-lg">
                  <Ship className="w-6 h-6 text-teal" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4 lg:p-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search shipments by ID, origin, or destination..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10 text-sm lg:text-base"
            />
          </div>
        </CardContent>
      </Card>

      {/* Shipments Table */}
      <Card>
        <CardHeader className="pb-4 lg:pb-6">
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center space-y-3 lg:space-y-0">
            <CardTitle className="flex items-center text-lg lg:text-2xl py-1 lg:py-2">
              <Ship className="w-5 h-5 lg:w-6 lg:h-6 mr-2 lg:mr-3 text-freight-blue" />
              Active Shipments ({filteredShipments.length})
            </CardTitle>
            <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
              <div className="flex items-center space-x-2">
                <span className="text-xs lg:text-sm text-gray-600">Show:</span>
                <Select value={shipmentsPerPage.toString()} onValueChange={handlePageSizeChange}>
                  <SelectTrigger className="w-16 lg:w-20 text-xs lg:text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-xs lg:text-sm text-gray-600">per page</span>
              </div>
              {totalPages > 1 && (
                <div className="text-xs lg:text-sm text-gray-500">
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
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between border-t pt-4 lg:pt-6 mt-4 lg:mt-6 space-y-3 lg:space-y-0">
              <div className="text-xs lg:text-sm text-gray-500 text-center lg:text-left">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredShipments.length)} of {filteredShipments.length} shipments
              </div>
              <div className="flex items-center justify-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePreviousPage}
                  disabled={currentPage === 1}
                  className="flex items-center space-x-1 text-xs lg:text-sm"
                >
                  <ChevronLeft className="w-3 h-3 lg:w-4 lg:h-4" />
                  <span className="hidden sm:inline">Previous</span>
                  <span className="sm:hidden">Prev</span>
                </Button>
                
                <div className="flex items-center space-x-1">
                  <span className="text-xs lg:text-sm font-medium">
                    Page {currentPage} of {totalPages}
                  </span>
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                  className="flex items-center space-x-1 text-xs lg:text-sm"
                >
                  <span className="hidden sm:inline">Next</span>
                  <span className="sm:hidden">Next</span>
                  <ChevronRight className="w-3 h-3 lg:w-4 lg:h-4" />
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