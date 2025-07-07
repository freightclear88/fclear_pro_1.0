import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Copy, Download, X } from "lucide-react";
import type { Shipment, Document } from "@shared/schema";

interface ShipmentDetailProps {
  shipment: Shipment | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ShipmentDetail({ shipment, isOpen, onClose }: ShipmentDetailProps) {
  const { toast } = useToast();

  const { data: documents } = useQuery({
    queryKey: ["/api/shipments", shipment?.id, "documents"],
    enabled: !!shipment?.id,
  });

  const handleCopyField = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({
        title: "Copied",
        description: `${label} copied to clipboard`,
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: `Failed to copy ${label}`,
        variant: "destructive",
      });
    }
  };

  const getDocumentStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { variant: "secondary" as const, label: "Pending" },
      uploaded: { variant: "default" as const, label: "Uploaded", className: "bg-freight-blue text-white" },
      processing: { variant: "default" as const, label: "Processing", className: "bg-freight-orange text-white" },
      processed: { variant: "default" as const, label: "Processed", className: "bg-freight-green text-white" },
      failed: { variant: "destructive" as const, label: "Failed" },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    
    return (
      <Badge variant={config.variant} className={config.className}>
        {config.label}
      </Badge>
    );
  };

  if (!shipment) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex justify-between items-center">
            <span>Shipment Details - {shipment.shipmentId}</span>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Shipment Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Shipment ID:</span>
                <div className="flex items-center space-x-2">
                  <span className="font-medium">{shipment.shipmentId}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyField("Shipment ID", shipment.shipmentId)}
                    className="text-freight-orange hover:text-freight-dark"
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              {shipment.containerNumber && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Container:</span>
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">{shipment.containerNumber}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyField("Container", shipment.containerNumber!)}
                      className="text-freight-orange hover:text-freight-dark"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )}

              {shipment.billOfLading && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Bill of Lading:</span>
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">{shipment.billOfLading}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyField("Bill of Lading", shipment.billOfLading!)}
                      className="text-freight-orange hover:text-freight-dark"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )}

              {shipment.vessel && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Vessel:</span>
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">{shipment.vessel}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyField("Vessel", shipment.vessel!)}
                      className="text-freight-orange hover:text-freight-dark"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center">
                <span className="text-gray-600">Origin:</span>
                <span className="font-medium">{shipment.origin}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-600">Destination:</span>
                <span className="font-medium">{shipment.destination}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-600">Status:</span>
                <Badge variant="default" className="bg-freight-blue text-white">
                  {shipment.status.replace("_", " ").toUpperCase()}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
            </CardHeader>
            <CardContent>
              {documents && documents.length > 0 ? (
                <div className="space-y-3">
                  {documents.map((document: Document) => (
                    <div
                      key={document.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="text-freight-blue">
                          📄
                        </div>
                        <div>
                          <span className="text-sm font-medium">{document.originalName}</span>
                          <div className="text-xs text-gray-500">
                            {document.category.replace("_", " ").toUpperCase()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getDocumentStatusBadge(document.status)}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-freight-blue hover:text-freight-dark"
                        >
                          <Download className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">No documents uploaded</p>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
