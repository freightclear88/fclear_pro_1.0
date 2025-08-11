import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Copy, Download, X, FileUp, ExternalLink, Star, ArrowRight, Ship, Plane, Truck } from "lucide-react";
import DocumentUpload from "@/components/DocumentUpload";
import DocumentList from "@/components/DocumentList";
import { generateAWBTrackingUrl } from "@/lib/airlineTracking";


import type { Shipment, Document } from "@shared/schema";

interface ShipmentDetailProps {
  shipment: Shipment | null;
  isOpen: boolean;
  onClose: () => void;
}

// Lucide React transport mode icons - using same library as rest of app
function TransportModeIcon({ mode }: { mode: string | null }) {
  const iconClassName = "w-8 h-8 text-freight-blue";
  
  switch (mode) {
    case 'air':
      return <Plane className={iconClassName} />;
    case 'ocean':
      return <Ship className={iconClassName} />;
    case 'ground':
    default:
      return <Truck className={iconClassName} />;
  }
}

export default function ShipmentDetail({ shipment, isOpen, onClose }: ShipmentDetailProps) {
  const { toast } = useToast();
  


  const { data: documents } = useQuery({
    queryKey: [`/api/shipments/${shipment?.id}/documents`],
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

  const handleCopyAllData = async () => {
    if (!shipment) return;
    
    const formatDate = (dateString: string | null) => {
      if (!dateString) return 'N/A';
      return new Date(dateString).toLocaleDateString();
    };

    const formatValue = (value: any) => {
      if (value === null || value === undefined) return 'N/A';
      if (typeof value === 'string' && value.trim() === '') return 'N/A';
      return value.toString();
    };

    const simplifiedData = `
SHIPMENT DETAILS - ${shipment.shipmentId}
=====================================

BASIC INFORMATION:
- Shipment ID: ${formatValue(shipment.shipmentId)}
- ${shipment.transportMode === 'air' ? 'Air Waybill Number' : 'Bill of Lading'}: ${formatValue(shipment.transportMode === 'air' ? shipment.airWaybillNumber : shipment.billOfLadingNumber)}
- Booking Number: ${formatValue(shipment.bookingNumber)}
- ${shipment.transportMode === 'air' ? 'Flight' : 'Vessel'} & Voyage: ${formatValue(shipment.vesselAndVoyage)}
- Transport Mode: ${formatValue(shipment.transportMode)}
- Status: ${formatValue(shipment.status)}

ROUTING:
- Port of Loading: ${formatValue(shipment.portOfLoading)}
- Port of Discharge: ${formatValue(shipment.portOfDischarge)}
- Place of Receipt: ${formatValue(shipment.placeOfReceipt)}
- Place of Delivery: ${formatValue(shipment.placeOfDelivery)}

PARTIES:
- Shipper: ${formatValue(shipment.shipperName)}
- Shipper Address: ${formatValue(shipment.shipperAddress)}
- Shipper Phone: ${formatValue(shipment.shipperPhone)}
- Shipper Email: ${formatValue(shipment.shipperEmail)}

- Consignee: ${formatValue(shipment.consigneeName)}
- Consignee Address: ${formatValue(shipment.consigneeAddress)}
- Consignee Phone: ${formatValue(shipment.consigneePhone)}
- Consignee Email: ${formatValue(shipment.consigneeEmail)}

- Notify Party: ${formatValue(shipment.notifyPartyName)}
- Notify Party Phone: ${formatValue(shipment.notifyPartyPhone)}
- Notify Party Email: ${formatValue(shipment.notifyPartyEmail)}

CARGO:
- Description: ${formatValue(shipment.cargoDescription)}
- Marks & Numbers: ${formatValue(shipment.marksAndNumbers)}
- Number of Packages: ${formatValue(shipment.numberOfPackages)} ${formatValue(shipment.kindOfPackages)}
- Gross Weight: ${formatValue(shipment.grossWeight || shipment.weight)} ${formatValue(shipment.weightUnit)}
- Measurement: ${formatValue(shipment.measurement)}

COMMERCIAL:
- Freight Terms: ${formatValue(shipment.freightPaymentTerms)}
- Currency: ${formatValue(shipment.currency)}
- Total Value: ${formatValue(shipment.totalValue)}

DATES:
- Date of Shipment: ${formatDate(shipment.dateOfShipment?.toString() || null)}
- On Board Date: ${formatDate(shipment.onBoardDate?.toString() || null)}
- ETA: ${formatDate(shipment.eta?.toString() || null)}
- ETD: ${formatDate(shipment.etd?.toString() || null)}

CONTAINER:
- Container Number: ${formatValue(shipment.containerNumber)}
- Container Type: ${formatValue(shipment.containerType)}
- Seal Numbers: ${formatValue(shipment.sealNumbers)}
`;

    try {
      await navigator.clipboard.writeText(simplifiedData.trim());
      toast({
        title: "Copied",
        description: "All shipment data copied in readable format",
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy shipment data",
        variant: "destructive",
      });
    }
  };

  // Helper component for field rows with copy buttons
  const FieldRow = ({ label, value, className = "" }: { label: string; value: string | null | undefined; className?: string }) => {
    const displayValue = value || 'N/A';
    if (!value) return null;
    
    return (
      <div className={`flex justify-between items-center ${className}`}>
        <span className="text-gray-600">{label}:</span>
        <div className="flex items-center space-x-2">
          <span className="font-medium">{displayValue}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleCopyField(label, displayValue)}
            className="text-freight-orange hover:text-freight-dark"
          >
            <Copy className="w-3 h-3" />
          </Button>
        </div>
      </div>
    );
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
      <Badge variant={config.variant} className={"className" in config ? config.className : ""}>
        {config.label}
      </Badge>
    );
  };

  if (!shipment) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-6">
          <DialogTitle className="flex justify-between items-center text-2xl py-3">
            <span>Shipment Details - {shipment.shipmentId}</span>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        {/* Visual Route Map */}
        <div className="bg-gradient-to-r from-blue-50 to-green-50 p-6 rounded-lg border">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            {/* Origin */}
            <div className="flex flex-col items-center space-y-2 flex-1">
              <div className="relative">
                <Star className="w-8 h-8 text-freight-blue fill-freight-blue" />
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-freight-green rounded-full border-2 border-white"></div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-freight-dark">
                  {shipment.portOfLoading || 'Origin'}
                </div>
                <div className="text-sm text-gray-600">
                  {shipment.countryOfOrigin || 'Country of Origin'}
                </div>
                {shipment.etd && (
                  <div className="text-xs text-gray-500 mt-1">
                    ETD: {new Date(shipment.etd).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>

            {/* Route Line with Transport Mode */}
            <div className="flex-2 flex items-center justify-center px-4">
              <div className="relative w-full max-w-md">
                {/* Gradient line */}
                <div className="h-1 bg-gradient-to-r from-freight-blue via-freight-green to-freight-blue rounded-full"></div>
                
                {/* Font Awesome Transport mode indicator - Enhanced */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-full w-16 h-16 flex items-center justify-center shadow-xl border-4 border-freight-blue/20">
                  <TransportModeIcon mode={shipment.transportMode} />
                </div>
                
                {/* Transport Mode Label */}
                <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-xs font-bold text-freight-dark bg-white px-3 py-1 rounded-full shadow-md border-2 border-freight-blue/10">
                  {shipment.transportMode?.toUpperCase() || 'TRANSPORT'}
                </div>
              </div>
            </div>

            {/* Destination */}
            <div className="flex flex-col items-center space-y-2 flex-1">
              <div className="relative">
                <Star className="w-8 h-8 text-freight-green fill-freight-green" />
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-freight-blue rounded-full border-2 border-white"></div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-freight-dark">
                  {shipment.portOfDischarge || 'Destination'}
                </div>
                <div className="text-sm text-gray-600">
                  {shipment.destinationPort || 'Destination Port'}
                </div>
                {shipment.eta && (
                  <div className="text-xs text-gray-500 mt-1">
                    ETA: {new Date(shipment.eta).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Status and Progress Bar */}
          <div className="mt-4 max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-freight-dark">Journey Progress</span>
              <Badge 
                variant={shipment.status === 'delivered' ? 'default' : 
                        shipment.status === 'in_transit' ? 'secondary' : 'outline'}
                className={shipment.status === 'delivered' ? 'bg-freight-green text-white' : 
                          shipment.status === 'in_transit' ? 'bg-freight-blue text-white' : ''}
              >
                {shipment.status?.replace('_', ' ').toUpperCase()}
              </Badge>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-freight-blue to-freight-green h-2 rounded-full transition-all duration-500"
                style={{
                  width: shipment.status === 'delivered' ? '100%' : 
                         shipment.status === 'in_transit' ? '60%' : 
                         shipment.status === 'pending' ? '20%' : '0%'
                }}
              ></div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg py-2">Shipment Information</CardTitle>
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

              {shipment.transportMode === 'air' && shipment.airWaybillNumber && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Airway Bill Number:</span>
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">{shipment.airWaybillNumber}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const trackingUrl = generateAWBTrackingUrl(shipment.airWaybillNumber!, true);
                        if (trackingUrl) {
                          window.open(trackingUrl, '_blank');
                        }
                      }}
                      className="text-freight-blue hover:text-freight-dark"
                      title="Track AWB"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyField("Airway Bill", shipment.airWaybillNumber!)}
                      className="text-freight-orange hover:text-freight-dark"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )}

              {shipment.transportMode === 'ocean' && shipment.billOfLadingNumber && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Bill of Lading Number:</span>
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">{shipment.billOfLadingNumber}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyField("Bill of Lading", shipment.billOfLadingNumber!)}
                      className="text-freight-orange hover:text-freight-dark"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )}

              {shipment.vesselAndVoyage && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Vessel & Voyage:</span>
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">{shipment.vesselAndVoyage}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyField("Vessel & Voyage", shipment.vesselAndVoyage!)}
                      className="text-freight-orange hover:text-freight-dark"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )}

              <FieldRow label="Port of Loading" value={shipment.portOfLoading} />
              <FieldRow label="Port of Discharge" value={shipment.portOfDischarge} />
              <FieldRow label="Place of Receipt" value={shipment.placeOfReceipt} />
              <FieldRow label="Place of Delivery" value={shipment.placeOfDelivery} />

              {shipment.bookingNumber && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Booking Number:</span>
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">{shipment.bookingNumber}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyField("Booking Number", shipment.bookingNumber!)}
                      className="text-freight-orange hover:text-freight-dark"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )}

              <FieldRow label="Container Type" value={shipment.containerType} />
              <FieldRow label="Transport Mode" value={shipment.transportMode} />
              <FieldRow label="Container Numbers" value={shipment.containerNumbers ? shipment.containerNumbers.join(', ') : null} />
              <FieldRow label="Seal Numbers" value={shipment.sealNumbers ? shipment.sealNumbers.join(', ') : null} />

              <div className="flex justify-between items-center">
                <span className="text-gray-600">Status:</span>
                <Badge variant="default" className="bg-freight-blue text-white">
                  {shipment.status.replace("_", " ").toUpperCase()}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Ocean Bill of Lading Party Information */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg py-2">Parties Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {shipment.shipperName && (
                <div className="border-l-4 border-freight-blue pl-4">
                  <h4 className="font-semibold text-freight-blue mb-2">Shipper</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{shipment.shipperName}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyField("Shipper Name", shipment.shipperName!)}
                        className="text-freight-orange hover:text-freight-dark"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                    {shipment.shipperAddress && (
                      <div className="flex justify-between items-start">
                        <span className="text-gray-600 flex-1">{shipment.shipperAddress}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyField("Shipper Address", shipment.shipperAddress!)}
                          className="text-freight-orange hover:text-freight-dark ml-2"
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                    {(shipment.shipperCity || shipment.shipperState || shipment.shipperZipCode) && (
                      <div className="text-gray-600">
                        {[shipment.shipperCity, shipment.shipperState, shipment.shipperZipCode].filter(Boolean).join(', ')}
                      </div>
                    )}
                    {shipment.shipperCountry && <div className="text-gray-600">{shipment.shipperCountry}</div>}
                    {shipment.shipperPhone && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Tel: {shipment.shipperPhone}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyField("Shipper Phone", shipment.shipperPhone!)}
                          className="text-freight-orange hover:text-freight-dark"
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                    {shipment.shipperEmail && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Email: {shipment.shipperEmail}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyField("Shipper Email", shipment.shipperEmail!)}
                          className="text-freight-orange hover:text-freight-dark"
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {shipment.consigneeName && (
                <div className="border-l-4 border-freight-green pl-4">
                  <h4 className="font-semibold text-freight-green mb-2">Consignee</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{shipment.consigneeName}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyField("Consignee Name", shipment.consigneeName!)}
                        className="text-freight-orange hover:text-freight-dark"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                    {shipment.consigneeAddress && (
                      <div className="flex justify-between items-start">
                        <span className="text-gray-600 flex-1">{shipment.consigneeAddress}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyField("Consignee Address", shipment.consigneeAddress!)}
                          className="text-freight-orange hover:text-freight-dark ml-2"
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                    {(shipment.consigneeCity || shipment.consigneeState || shipment.consigneeZipCode) && (
                      <div className="text-gray-600">
                        {[shipment.consigneeCity, shipment.consigneeState, shipment.consigneeZipCode].filter(Boolean).join(', ')}
                      </div>
                    )}
                    {shipment.consigneeCountry && <div className="text-gray-600">{shipment.consigneeCountry}</div>}
                    {shipment.consigneePhone && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Tel: {shipment.consigneePhone}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyField("Consignee Phone", shipment.consigneePhone!)}
                          className="text-freight-orange hover:text-freight-dark"
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                    {shipment.consigneeEmail && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Email: {shipment.consigneeEmail}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyField("Consignee Email", shipment.consigneeEmail!)}
                          className="text-freight-orange hover:text-freight-dark"
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {shipment.notifyPartyName && (
                <div className="border-l-4 border-freight-orange pl-4">
                  <h4 className="font-semibold text-freight-orange mb-2">Notify Party</h4>
                  <div className="space-y-1 text-sm">
                    <div className="font-medium">{shipment.notifyPartyName}</div>
                    {shipment.notifyPartyAddress && <div className="text-gray-600">{shipment.notifyPartyAddress}</div>}
                    {(shipment.notifyPartyCity || shipment.notifyPartyState || shipment.notifyPartyZipCode) && (
                      <div className="text-gray-600">
                        {[shipment.notifyPartyCity, shipment.notifyPartyState, shipment.notifyPartyZipCode].filter(Boolean).join(', ')}
                      </div>
                    )}
                    {shipment.notifyPartyCountry && <div className="text-gray-600">{shipment.notifyPartyCountry}</div>}
                    {shipment.notifyPartyPhone && <div className="text-gray-600">Tel: {shipment.notifyPartyPhone}</div>}
                    {shipment.notifyPartyEmail && <div className="text-gray-600">Email: {shipment.notifyPartyEmail}</div>}
                  </div>
                </div>
              )}

              {shipment.forwardingAgentName && (
                <div className="border-l-4 border-purple-500 pl-4">
                  <h4 className="font-semibold text-purple-500 mb-2">Forwarding Agent</h4>
                  <div className="space-y-1 text-sm">
                    <div className="font-medium">{shipment.forwardingAgentName}</div>
                    {shipment.forwardingAgentAddress && <div className="text-gray-600">{shipment.forwardingAgentAddress}</div>}
                    {shipment.forwardingAgentPhone && <div className="text-gray-600">Tel: {shipment.forwardingAgentPhone}</div>}
                    {shipment.forwardingAgentEmail && <div className="text-gray-600">Email: {shipment.forwardingAgentEmail}</div>}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cargo Information */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg py-2">Cargo Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {shipment.cargoDescription && (
                <div className="flex justify-between items-start">
                  <span className="text-gray-600 w-1/3">Description:</span>
                  <div className="flex items-start space-x-2 w-2/3 justify-end">
                    <span className="font-medium text-right">{shipment.cargoDescription}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyField("Cargo Description", shipment.cargoDescription!)}
                      className="text-freight-orange hover:text-freight-dark"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )}

              <FieldRow label="Commodity" value={shipment.commodity} />
              
              {shipment.numberOfPackages && (
                <FieldRow 
                  label="Number of Packages" 
                  value={`${shipment.numberOfPackages} ${shipment.kindOfPackages || ''}`}
                />
              )}

              {(shipment.grossWeight || shipment.weight) && (
                <FieldRow 
                  label="Gross Weight" 
                  value={`${shipment.grossWeight || shipment.weight} ${shipment.weightUnit || 'KG'}`}
                />
              )}

              <FieldRow 
                label="Net Weight" 
                value={shipment.netWeight ? `${shipment.netWeight} ${shipment.weightUnit || 'KG'}` : null}
              />

              <FieldRow 
                label="Volume" 
                value={shipment.volume ? `${shipment.volume} ${shipment.volumeUnit || 'CBM'}` : null}
              />

              <FieldRow label="Measurement" value={shipment.measurement} />

              {shipment.marksAndNumbers && (
                <div className="flex justify-between items-start">
                  <span className="text-gray-600 w-1/3">Marks & Numbers:</span>
                  <div className="flex items-start space-x-2 w-2/3 justify-end">
                    <span className="font-medium text-right">{shipment.marksAndNumbers}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyField("Marks & Numbers", shipment.marksAndNumbers!)}
                      className="text-freight-orange hover:text-freight-dark"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )}

              {shipment.isHazardous && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-red-600 font-semibold">⚠️ Hazardous Material</span>
                    <Badge variant="destructive">HAZMAT</Badge>
                  </div>
                  {shipment.hazardClass && (
                    <div className="text-sm text-red-600">Class: {shipment.hazardClass}</div>
                  )}
                  {shipment.unNumber && (
                    <div className="text-sm text-red-600">UN Number: {shipment.unNumber}</div>
                  )}
                  {shipment.properShippingName && (
                    <div className="text-sm text-red-600">Proper Shipping Name: {shipment.properShippingName}</div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          </div>

          {/* Dates and Times */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg py-2">Important Dates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <FieldRow 
                label="Issue Date" 
                value={shipment.issueDate ? new Date(shipment.issueDate).toLocaleDateString() : null}
              />

              <FieldRow 
                label="On Board Date" 
                value={shipment.onBoardDate ? new Date(shipment.onBoardDate).toLocaleDateString() : null}
              />

              <FieldRow 
                label="Shipment Date" 
                value={shipment.dateOfShipment ? new Date(shipment.dateOfShipment).toLocaleDateString() : null}
              />

              <FieldRow 
                label="ETD" 
                value={shipment.etd ? new Date(shipment.etd).toLocaleDateString() : null}
              />

              <FieldRow 
                label="ETA" 
                value={shipment.eta ? new Date(shipment.eta).toLocaleDateString() : null}
              />

              <FieldRow 
                label="ATD" 
                value={shipment.atd ? new Date(shipment.atd).toLocaleDateString() : null}
              />

              <FieldRow 
                label="ATA" 
                value={shipment.ata ? new Date(shipment.ata).toLocaleDateString() : null}
              />
            </CardContent>
          </Card>

          {/* Trade and Regulatory Information */}
          {(shipment.countryOfOrigin || shipment.htsCode || shipment.exportLicense) && (
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg py-2">Trade & Regulatory</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {shipment.countryOfOrigin && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Country of Origin:</span>
                    <span className="font-medium">{shipment.countryOfOrigin}</span>
                  </div>
                )}

                {shipment.countryOfManufacture && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Country of Manufacture:</span>
                    <span className="font-medium">{shipment.countryOfManufacture}</span>
                  </div>
                )}

                {shipment.htsCode && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">HTS Code:</span>
                    <span className="font-medium">{shipment.htsCode}</span>
                  </div>
                )}

                {shipment.scheduleBCode && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Schedule B Code:</span>
                    <span className="font-medium">{shipment.scheduleBCode}</span>
                  </div>
                )}

                {shipment.exportLicense && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Export License:</span>
                    <span className="font-medium">{shipment.exportLicense}</span>
                  </div>
                )}

                {shipment.importLicense && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Import License:</span>
                    <span className="font-medium">{shipment.importLicense}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <h3 className="text-lg font-semibold">Documents</h3>
              <DocumentUpload 
                shipmentId={shipment.id}
                trigger={
                  <Button size="sm" className="bg-freight-green hover:bg-freight-green/90 text-white">
                    <FileUp className="w-4 h-4 mr-2" />
                    Add Documents
                  </Button>
                }
              />
            </div>
            <DocumentList shipmentId={shipment.id} />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-4 pt-6 border-t mt-6">
            <Button 
              onClick={handleCopyAllData}
              className="btn-outline-primary"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy All Data
            </Button>
            <Button 
              onClick={() => window.open(`/shipment-html/${shipment.id}`, '_blank')}
              className="btn-outline-accent"
            >
              <FileUp className="w-4 h-4 mr-2" />
              View HTML Page
            </Button>
            <Button 
              onClick={onClose}
              className="btn-primary"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
