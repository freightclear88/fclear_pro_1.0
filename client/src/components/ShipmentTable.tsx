import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { Eye, Copy, Edit, FileText, ExternalLink, ChevronDown, ChevronRight, Folder, Download } from "lucide-react";
import type { Shipment, Document } from "@shared/schema";
import ShipmentHtmlPage from "./ShipmentHtmlPage";
import { detectCarrierFromBL, generateTrackingUrl, generateContainerTrackingUrl } from "@/lib/carrierTracking";

interface ShipmentTableProps {
  shipments: Shipment[];
  onViewShipment: (shipment: Shipment) => void;
}

export default function ShipmentTable({ shipments, onViewShipment }: ShipmentTableProps) {
  const { toast } = useToast();
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [isHtmlPageOpen, setIsHtmlPageOpen] = useState(false);
  const [expandedShipments, setExpandedShipments] = useState<Set<number>>(new Set());

  // Safety check for shipments data
  if (!shipments || !Array.isArray(shipments)) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Loading shipments...</p>
      </div>
    );
  }

  // Debug logging
  if (shipments.length > 0) {
    console.log('Frontend received shipments:', shipments[0]);
  }

  const handleViewHtmlPage = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    setIsHtmlPageOpen(true);
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

  const handleCopyShipment = async (shipment: Shipment) => {
    try {
      const shipmentData = `
Shipment ID: ${shipment.shipmentId}
Container: ${shipment.containerNumber || "N/A"}
Bill of Lading: ${shipment.billOfLading || "N/A"}
Vessel: ${shipment.vessel || "N/A"}
Origin: ${shipment.origin}
Destination: ${shipment.destination}
      `.trim();

      await navigator.clipboard.writeText(shipmentData);
      toast({
        title: "Copied",
        description: "Shipment data copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy shipment data",
        variant: "destructive",
      });
    }
  };

  const getTransportModeIcon = (mode: string | null | undefined) => {
    if (!mode) return '📦';
    switch (mode.toLowerCase()) {
      case 'air':
        return '✈️';
      case 'ocean':
        return '🚢';
      case 'trucking':
        return '🚛';
      default:
        return '📦';
    }
  };

  // Document folder component for each shipment
  function DocumentFolder({ shipmentId }: { shipmentId: number }) {
    const { data: documents = [] } = useQuery({
      queryKey: ["/api/documents", shipmentId],
    });

    const handleDownload = async (document: Document) => {
      try {
        const response = await fetch(`/api/documents/${document.id}/download`);
        if (!response.ok) throw new Error('Download failed');
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = document.originalName || 'document';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast({
          title: "Download Complete",
          description: `Downloaded ${document.originalName}`,
        });
      } catch (error) {
        toast({
          title: "Download Failed",
          description: "Could not download document",
          variant: "destructive",
        });
      }
    };

    if (documents.length === 0) {
      return (
        <div className="text-center py-4 text-gray-500 text-sm">
          No documents uploaded yet
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {documents.map((doc: Document) => (
          <div key={doc.id} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
            <div className="flex items-center space-x-2">
              <FileText className="w-4 h-4 text-freight-blue" />
              <div>
                <p className="text-sm font-medium">{doc.originalName}</p>
                <p className="text-xs text-gray-500 capitalize">{doc.category.replace('_', ' ')}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDownload(doc)}
              className="text-freight-orange hover:text-freight-dark"
            >
              <Download className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>
    );
  }

  if (shipments.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No shipments found</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {shipments.map((shipment) => {
        if (!shipment) return null;
        const isExpanded = expandedShipments.has(shipment.id);
        
        return (
          <Collapsible key={shipment.id} open={isExpanded} onOpenChange={() => toggleExpanded(shipment.id)}>
            <div className="border rounded-lg bg-white shadow-sm">
              {/* Main shipment row */}
              <CollapsibleTrigger asChild>
                <div className="flex items-center p-4 hover:bg-gray-50 cursor-pointer">
                  <div className="flex items-center space-x-2 mr-4">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                    <Folder className="w-4 h-4 text-freight-blue" />
                  </div>
                  
                  <div className="flex-1 grid grid-cols-6 gap-4">
                    {/* Shipment ID & Transport Mode */}
                    <div>
                      <div className="font-medium text-freight-dark flex items-center space-x-2">
                        <span>{shipment.shipmentId}</span>
                        <span className="text-lg">{getTransportModeIcon((shipment as any)?.transportMode || (shipment as any)?.transport_mode || 'ocean')}</span>
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(shipment.createdAt!).toLocaleDateString()}
                      </div>
                    </div>

                    {/* Container/BL Info */}
                    <div>
                      <div className="text-sm font-medium">
                        {shipment.containerNumber || "No Container"}
                      </div>
                      <div className="text-xs text-gray-500 flex items-center space-x-1">
                        <span>BL: {shipment.billOfLading || "N/A"}</span>
                        {shipment.billOfLading && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              const trackingUrl = generateTrackingUrl(shipment.billOfLading!);
                              if (trackingUrl) {
                                window.open(trackingUrl, '_blank');
                              }
                            }}
                            className="text-freight-orange hover:text-freight-dark p-0 h-3"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Route */}
                    <div>
                      <div className="text-sm font-medium">{shipment.origin}</div>
                      <div className="text-xs text-gray-500">→ {shipment.destination}</div>
                    </div>

                    {/* Vessel */}
                    <div>
                      <div className="text-sm">{shipment.vessel || "TBD"}</div>
                      <div className="text-xs text-gray-500">
                        {shipment.originPort && `From: ${shipment.originPort}`}
                      </div>
                    </div>

                    {/* Container Tracking */}
                    <div>
                      {shipment.containerNumber && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            const trackingUrl = generateContainerTrackingUrl(shipment.containerNumber!);
                            if (trackingUrl) {
                              window.open(trackingUrl, '_blank');
                            }
                          }}
                          className="text-xs border-freight-blue text-freight-blue hover:bg-freight-blue hover:text-white"
                        >
                          Track Container
                        </Button>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewShipment(shipment);
                        }}
                        className="text-freight-blue hover:text-freight-dark"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewHtmlPage(shipment);
                        }}
                        className="text-freight-orange hover:text-freight-dark"
                        title="HTML Page"
                      >
                        <FileText className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyShipment(shipment);
                        }}
                        className="text-gray-600 hover:text-freight-dark"
                        title="Copy Data"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CollapsibleTrigger>

              {/* Document folder content */}
              <CollapsibleContent>
                <div className="border-t bg-gray-50 p-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <Folder className="w-4 h-4 text-freight-blue" />
                    <span className="text-sm font-medium text-freight-dark">
                      Document Folder - {shipment.shipmentId}
                    </span>
                  </div>
                  <DocumentFolder shipmentId={shipment.id} />
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      })}

      {/* HTML Page Modal */}
      <ShipmentHtmlPage
        shipment={selectedShipment}
        isOpen={isHtmlPageOpen}
        onClose={() => setIsHtmlPageOpen(false)}
      />
    </div>
  );
}