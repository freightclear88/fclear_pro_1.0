import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Shipment } from "@shared/schema";
import { Copy, FileText, Calendar, MapPin, Package, Truck, Ship, Plane, ExternalLink } from "lucide-react";
import { detectCarrierFromBL, generateTrackingUrl, generateContainerTrackingUrl } from "@/lib/carrierTracking";

interface ShipmentHtmlPageProps {
  shipment: Shipment;
  isOpen: boolean;
  onClose: () => void;
}

const FIELD_SECTIONS = {
  "Shipment Identification": [
    { key: "shipmentId", label: "Shipment ID", icon: Package },
    { key: "billOfLadingNumber", label: "Bill of Lading", icon: FileText, hasTracking: true },
    { key: "status", label: "Status", icon: Package },
    { key: "transportMode", label: "Transport Mode", icon: Truck },
  ],
  "Vessel & Transport Details": [
    { key: "vesselAndVoyage", label: "Vessel & Voyage", icon: Ship },
    { key: "containerNumber", label: "Container Number", icon: Package, hasTracking: true },
    { key: "weight", label: "Weight", icon: Package },
  ],
  "Origin & Destination": [
    { key: "portOfLoading", label: "Port of Loading", icon: MapPin },
    { key: "portOfDischarge", label: "Port of Discharge", icon: MapPin },
    { key: "placeOfDelivery", label: "Place of Delivery", icon: MapPin },
  ],
  "Arrival Information": [
    { key: "eta", label: "Estimated Time of Arrival (ETA)", icon: Calendar },
    { key: "ata", label: "Actual Time of Arrival (ATA)", icon: Calendar },
  ],
  "Party Information": [
    { key: "shipperName", label: "Shipper Name", icon: Package },
    { key: "consigneeName", label: "Consignee Name", icon: Package },
    { key: "notifyPartyName", label: "Notify Party", icon: FileText },
  ],
  "Financial Information": [
    { key: "freightCharges", label: "Freight Charges", icon: Package },
    { key: "destinationCharges", label: "Destination Charges", icon: Package },
    { key: "totalValue", label: "Total Cargo Value", icon: Package },
  ],
  "System Information": [
    { key: "createdAt", label: "Created Date", icon: Calendar },
    { key: "updatedAt", label: "Updated Date", icon: Calendar },
  ],
};

export default function ShipmentHtmlPage({ shipment, isOpen, onClose }: ShipmentHtmlPageProps) {
  // Safety check - don't render if shipment is null/undefined
  if (!shipment) {
    return null;
  }
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const { toast } = useToast();

  const copyToClipboard = async (value: string, fieldLabel: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(fieldLabel);
      toast({
        title: "Copied",
        description: `${fieldLabel} copied to clipboard`,
      });
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Could not copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const getFieldValue = (key: string) => {
    const value = shipment[key as keyof Shipment];
    if (value === null || value === undefined) return "N/A";
    if (value instanceof Date) return value.toLocaleString();
    if (typeof value === "boolean") return value ? "Yes" : "No";
    return String(value);
  };

  const getTransportIcon = (mode: string) => {
    switch (mode?.toLowerCase()) {
      case 'air': return Plane;
      case 'ocean': return Ship;
      case 'trucking': return Truck;
      case 'last_mile': return Truck;
      default: return Package;
    }
  };

  const getTrackingUrl = (fieldKey: string, value: string) => {
    if (!value || value === "N/A") return null;
    
    if (fieldKey === "billOfLadingNumber") {
      return generateTrackingUrl(value);
    }
    if (fieldKey === "containerNumber") {
      return generateContainerTrackingUrl(value);
    }
    return null;
  };

  const getCarrierInfo = (fieldKey: string, value: string) => {
    if (!value || value === "N/A") return null;
    
    if (fieldKey === "billOfLadingNumber") {
      return detectCarrierFromBL(value);
    }
    return null;
  };

  const TransportIcon = getTransportIcon(shipment?.transportMode || 'ocean');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center text-xl">
            <TransportIcon className="w-6 h-6 mr-3 text-freight-blue" />
            Shipment Details: {shipment?.shipmentId || 'Unknown'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header Summary */}
          <Card className="border-freight-blue border-2">
            <CardHeader className="bg-freight-blue/5">
              <CardTitle className="text-freight-blue">
                {shipment?.shipmentId || 'Unknown'} - {shipment?.status || 'Unknown'}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center space-x-2">
                  <TransportIcon className="w-5 h-5 text-freight-blue" />
                  <span className="font-medium">{shipment?.transportMode || "Unknown"}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <MapPin className="w-5 h-5 text-freight-orange" />
                  <span>{shipment?.portOfLoading || "Origin TBD"} → {shipment?.portOfDischarge || "Destination TBD"}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Calendar className="w-5 h-5 text-freight-green" />
                  <span>{shipment?.eta ? new Date(shipment.eta).toLocaleDateString() : "ETA TBD"}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Detailed Fields */}
          {Object.entries(FIELD_SECTIONS).map(([sectionName, fields]) => (
            <Card key={sectionName}>
              <CardHeader>
                <CardTitle className="text-lg text-freight-dark">{sectionName}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {fields.map(({ key, label, icon: Icon, hasTracking }) => {
                    const value = getFieldValue(key);
                    const isEmpty = value === "N/A" || value === "";
                    const trackingUrl = hasTracking && !isEmpty ? getTrackingUrl(key, value) : null;
                    const carrierInfo = hasTracking && !isEmpty ? getCarrierInfo(key, value) : null;
                    
                    return (
                      <div
                        key={key}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          isEmpty ? 'border-gray-200 bg-gray-50' : 'border-freight-blue/20 bg-freight-blue/5'
                        }`}
                      >
                        <div className="flex items-center space-x-3 flex-1">
                          <Icon className={`w-4 h-4 ${isEmpty ? 'text-gray-400' : 'text-freight-blue'}`} />
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-700">{label}</div>
                            <div className={`text-sm ${isEmpty ? 'text-gray-400 italic' : 'text-gray-900 font-medium'}`}>
                              {value}
                              {carrierInfo && (
                                <div className="text-xs text-freight-orange mt-1 font-medium">
                                  🚢 {carrierInfo.name}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {!isEmpty && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => copyToClipboard(value, label)}
                              className={`${
                                copiedField === label
                                  ? 'bg-green-100 border-green-300 text-green-700'
                                  : 'hover:bg-freight-blue hover:text-white'
                              }`}
                            >
                              <Copy className="w-3 h-3" />
                              {copiedField === label ? 'Copied!' : 'Copy'}
                            </Button>
                          )}
                          {trackingUrl && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(trackingUrl, '_blank')}
                              className="hover:bg-freight-orange hover:text-white border-freight-orange text-freight-orange"
                            >
                              <ExternalLink className="w-3 h-3 mr-1" />
                              Track
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Copy All Data Button */}
          <Card className="border-freight-green border-2">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-freight-green">Copy All Data</h3>
                  <p className="text-sm text-gray-600">Copy all shipment data as formatted text</p>
                </div>
                <Button
                  onClick={() => {
                    const allData = Object.entries(FIELD_SECTIONS)
                      .map(([section, fields]) => {
                        const sectionData = fields
                          .map(({ key, label }) => `${label}: ${getFieldValue(key)}`)
                          .join('\n');
                        return `${section}\n${sectionData}`;
                      })
                      .join('\n\n');
                    
                    copyToClipboard(allData, "All Shipment Data");
                  }}
                  className="btn-secondary"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy All Data
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Footer Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button
              onClick={onClose}
              variant="outline"
              className="px-6"
            >
              Close
            </Button>
            <Button
              onClick={() => window.print()}
              className="bg-freight-blue hover:bg-freight-blue/90 text-white px-6"
            >
              <FileText className="w-4 h-4 mr-2" />
              Print Page
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}