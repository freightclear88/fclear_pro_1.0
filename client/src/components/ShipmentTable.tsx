import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { Eye, Copy, Edit, FileText, ExternalLink, ChevronDown, ChevronRight, Folder, Download, Plus, X } from "lucide-react";
import type { Shipment, Document } from "@shared/schema";
import ShipmentHtmlPage from "./ShipmentHtmlPage";
import DocumentUpload from "./DocumentUpload";
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
Shipment ID: ${shipment?.shipmentId || "N/A"}
Container: ${shipment?.containerNumber || "N/A"}
Bill of Lading: ${shipment?.billOfLadingNumber || "N/A"}
Vessel: ${shipment?.vesselAndVoyage || "N/A"}
Origin: ${shipment?.portOfLoading || "N/A"}
Destination: ${shipment?.portOfDischarge || "N/A"}
Shipper: ${shipment?.shipperName || "N/A"}
Consignee: ${shipment?.consigneeName || "N/A"}
Weight: ${shipment?.weight || "N/A"}
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
      case 'last_mile':
        return '🚛';
      default:
        return '📦';
    }
  };

  // Document folder component for each shipment
  function DocumentFolder({ shipmentId }: { shipmentId: number }) {
    const [viewingDocument, setViewingDocument] = useState<Document | null>(null);
    const [isPdfViewerOpen, setIsPdfViewerOpen] = useState(false);
    
    const { data: documents = [] } = useQuery<Document[]>({
      queryKey: ["/api/documents", shipmentId],
    });

    const handleViewPdf = (doc: Document) => {
      setViewingDocument(doc);
      setIsPdfViewerOpen(true);
    };

    const handleDownload = async (doc: Document) => {
      try {
        const response = await fetch(`/api/documents/${doc.id}/download`);
        if (!response.ok) throw new Error('Download failed');
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = window.document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = doc.originalName || 'document';
        window.document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        window.document.body.removeChild(a);
        
        toast({
          title: "Download Complete",
          description: `Downloaded ${doc.originalName}`,
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
      <>
        <div className="space-y-2">
          {documents.map((doc: Document) => (
            <div key={doc.id} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-freight-blue" />
                <div>
                  <p className="text-sm font-medium">{doc.originalName}</p>
                  <div className="flex items-center space-x-1">
                    <p className="text-xs text-gray-500 capitalize">{doc.category.replace('_', ' ')}</p>
                    {doc.subCategory && (
                      <span className="text-xs bg-orange-100 text-orange-700 px-1 rounded">
                        {doc.subCategory.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-1">
                {(doc.fileType === 'application/pdf' || 
                  doc.fileType?.startsWith('image/') ||
                  doc.fileType === 'text/plain') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleViewPdf(doc)}
                    className="text-freight-blue hover:text-freight-dark"
                    title="View Document"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDownload(doc)}
                  className="text-freight-orange hover:text-freight-dark"
                  title="Download Document"
                >
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* PDF Viewer Dialog */}
        <Dialog open={isPdfViewerOpen} onOpenChange={setIsPdfViewerOpen}>
          <DialogContent className="max-w-6xl max-h-[90vh] w-[90vw] h-[90vh]">
            <DialogHeader className="pb-2">
              <DialogTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <FileText className="w-5 h-5 mr-2 text-freight-blue" />
                  {viewingDocument?.originalName || viewingDocument?.fileName}
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    size="sm"
                    onClick={() => window.open(`/api/documents/${viewingDocument?.id}/view`, '_blank')}
                    className="btn-outline-primary"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open in New Tab
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => viewingDocument && handleDownload(viewingDocument)}
                    className="btn-outline-primary"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsPdfViewerOpen(false)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </DialogTitle>
            </DialogHeader>
            
            <div className="flex-1 overflow-hidden">
              {viewingDocument && (
                <div className="w-full h-full bg-gray-100 rounded border">
                  {viewingDocument.fileType === 'application/pdf' ? (
                    <iframe
                      src={`/api/documents/${viewingDocument.id}/view`}
                      className="w-full h-full border-0 rounded"
                      title={viewingDocument.originalName || viewingDocument.fileName}
                    />
                  ) : viewingDocument.fileType?.startsWith('image/') ? (
                    <div className="w-full h-full flex items-center justify-center p-4">
                      <img
                        src={`/api/documents/${viewingDocument.id}/view`}
                        alt={viewingDocument.originalName || viewingDocument.fileName}
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                  ) : (
                    <iframe
                      src={`/api/documents/${viewingDocument.id}/view`}
                      className="w-full h-full border-0 rounded bg-white"
                      title={viewingDocument.originalName || viewingDocument.fileName}
                    />
                  )}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </>
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
      {shipments.filter(shipment => shipment && shipment.id && shipment.shipmentId).map((shipment) => {
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
                  
                  <div className="flex-1 grid grid-cols-2 lg:grid-cols-6 gap-2 lg:gap-4">
                    {/* Shipment ID & Transport Mode */}
                    <div>
                      <div className="font-medium text-freight-dark flex items-center space-x-2">
                        <span>{shipment?.shipmentId || 'Unknown'}</span>
                        <span className="text-lg">{getTransportModeIcon(shipment?.transportMode || 'ocean')}</span>
                      </div>
                      <div className="text-sm text-gray-500">
                        {shipment?.createdAt ? new Date(shipment.createdAt).toLocaleDateString() : 'Unknown'}
                      </div>
                    </div>

                    {/* Container/AWB/BL Info */}
                    <div>
                      <div className="text-sm font-medium">
                        {shipment?.transportMode === 'air' 
                          ? (shipment?.airWaybillNumber ? `AWB: ${shipment.airWaybillNumber}` : "No AWB")
                          : (shipment?.containerNumber || "No Container")
                        }
                      </div>
                      <div className="text-xs text-gray-500 flex items-center space-x-1">
                        {shipment?.transportMode === 'air' ? (
                          <>
                            <span>Flight: {shipment?.vesselAndVoyage || "N/A"}</span>
                            {shipment?.airWaybillNumber && (
                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const trackingUrl = generateTrackingUrl(shipment?.airWaybillNumber!);
                                  if (trackingUrl) {
                                    window.open(trackingUrl, '_blank');
                                  }
                                }}
                                className="btn-ghost p-0 h-3"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </Button>
                            )}
                          </>
                        ) : (
                          <>
                            <span>BL: {shipment?.billOfLadingNumber || "N/A"}</span>
                            {shipment?.billOfLadingNumber && (
                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const trackingUrl = generateTrackingUrl(shipment?.billOfLadingNumber!);
                                  if (trackingUrl) {
                                    window.open(trackingUrl, '_blank');
                                  }
                                }}
                                className="btn-ghost p-0 h-3"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Route */}
                    <div>
                      <div className="text-sm font-medium">{shipment?.portOfLoading || 'Unknown'}</div>
                      <div className="text-xs text-gray-500">→ {shipment?.portOfDischarge || 'Unknown'}</div>
                    </div>

                    {/* Vessel/Aircraft */}
                    <div>
                      <div className="text-sm">
                        {shipment?.transportMode === 'air' 
                          ? (shipment?.vesselAndVoyage || "TBD Flight")
                          : (shipment?.vesselAndVoyage || "TBD Vessel")
                        }
                      </div>
                      <div className="text-xs text-gray-500">
                        {shipment?.originPort && `From: ${shipment.originPort}`}
                      </div>
                    </div>

                    {/* Tracking */}
                    <div>
                      {(shipment?.containerNumber || shipment?.airWaybillNumber || shipment?.billOfLadingNumber) && (
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            let trackingUrl = null;
                            
                            if (shipment?.transportMode === 'air' && shipment?.airWaybillNumber) {
                              console.log('Air tracking clicked for AWB:', shipment?.airWaybillNumber);
                              trackingUrl = generateTrackingUrl(shipment?.airWaybillNumber);
                            } else if (shipment?.containerNumber) {
                              console.log('Container tracking clicked for:', shipment?.containerNumber);
                              trackingUrl = generateContainerTrackingUrl(shipment?.containerNumber);
                              
                              // Fallback to BL tracking if container tracking fails
                              if (!trackingUrl && shipment?.billOfLadingNumber) {
                                console.log('Container tracking failed, trying BL tracking for:', shipment?.billOfLadingNumber);
                                trackingUrl = generateTrackingUrl(shipment?.billOfLadingNumber);
                              }
                            } else if (shipment?.billOfLadingNumber) {
                              console.log('BL tracking clicked for:', shipment?.billOfLadingNumber);
                              trackingUrl = generateTrackingUrl(shipment?.billOfLadingNumber);
                            }
                            
                            if (trackingUrl) {
                              console.log('Opening tracking URL:', trackingUrl);
                              window.open(trackingUrl, '_blank');
                            } else {
                              console.log('No tracking URL generated');
                              toast({
                                title: "Tracking Unavailable",
                                description: "Unable to detect carrier for tracking. Please check the tracking number format.",
                                variant: "destructive",
                              });
                            }
                          }}
                          className="btn-outline-accent text-xs"
                        >
                          {shipment?.transportMode === 'air' ? 'Track AWB' : 'Track Container'}
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
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <Folder className="w-4 h-4 text-freight-blue" />
                      <span className="text-sm font-medium text-freight-dark">
                        Document Folder - {shipment?.shipmentId || 'Unknown'}
                      </span>
                    </div>
                    <DocumentUpload 
                      shipmentId={shipment?.id}
                      trigger={
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex items-center space-x-1 text-xs border-blue-500 text-blue-600 hover:bg-blue-500 hover:text-white transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add Document</span>
                        </Button>
                      }
                    />
                  </div>
                  <DocumentFolder shipmentId={shipment?.id || 0} />
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      })}

      {/* HTML Page Modal */}
      {selectedShipment && (
        <ShipmentHtmlPage
          shipment={selectedShipment}
          isOpen={isHtmlPageOpen}
          onClose={() => setIsHtmlPageOpen(false)}
        />
      )}
    </div>
  );
}