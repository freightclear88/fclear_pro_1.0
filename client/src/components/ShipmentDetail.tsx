import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Copy, Download, X, FileUp } from "lucide-react";
import DocumentUpload from "@/components/DocumentUpload";
import DocumentList from "@/components/DocumentList";


import type { Shipment, Document } from "@shared/schema";

interface ShipmentDetailProps {
  shipment: Shipment | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ShipmentDetail({ shipment, isOpen, onClose }: ShipmentDetailProps) {
  const { toast } = useToast();
  
  // Debug logging to see what data we receive
  console.log('ShipmentDetail received shipment:', shipment);

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
        <DialogHeader className="pb-6">
          <DialogTitle className="flex justify-between items-center text-2xl py-3">
            <span>Shipment Details - {shipment.shipmentId}</span>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

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

              {shipment.billOfLadingNumber && (
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

              <div className="flex justify-between items-center">
                <span className="text-gray-600">Port of Loading:</span>
                <span className="font-medium">{shipment.portOfLoading || 'N/A'}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-600">Port of Discharge:</span>
                <span className="font-medium">{shipment.portOfDischarge || 'N/A'}</span>
              </div>

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

              {shipment.containerType && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Container Type:</span>
                  <span className="font-medium">{shipment.containerType}</span>
                </div>
              )}

              {shipment.transportMode && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Transport Mode:</span>
                  <span className="font-medium capitalize">{shipment.transportMode}</span>
                </div>
              )}

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
                    <div className="font-medium">{shipment.shipperName}</div>
                    {shipment.shipperAddress && <div className="text-gray-600">{shipment.shipperAddress}</div>}
                    {(shipment.shipperCity || shipment.shipperState || shipment.shipperZipCode) && (
                      <div className="text-gray-600">
                        {[shipment.shipperCity, shipment.shipperState, shipment.shipperZipCode].filter(Boolean).join(', ')}
                      </div>
                    )}
                    {shipment.shipperCountry && <div className="text-gray-600">{shipment.shipperCountry}</div>}
                  </div>
                </div>
              )}

              {shipment.consigneeName && (
                <div className="border-l-4 border-freight-green pl-4">
                  <h4 className="font-semibold text-freight-green mb-2">Consignee</h4>
                  <div className="space-y-1 text-sm">
                    <div className="font-medium">{shipment.consigneeName}</div>
                    {shipment.consigneeAddress && <div className="text-gray-600">{shipment.consigneeAddress}</div>}
                    {(shipment.consigneeCity || shipment.consigneeState || shipment.consigneeZipCode) && (
                      <div className="text-gray-600">
                        {[shipment.consigneeCity, shipment.consigneeState, shipment.consigneeZipCode].filter(Boolean).join(', ')}
                      </div>
                    )}
                    {shipment.consigneeCountry && <div className="text-gray-600">{shipment.consigneeCountry}</div>}
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
                  <span className="font-medium w-2/3 text-right">{shipment.cargoDescription}</span>
                </div>
              )}

              {shipment.commodity && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Commodity:</span>
                  <span className="font-medium">{shipment.commodity}</span>
                </div>
              )}

              {shipment.numberOfPackages && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Number of Packages:</span>
                  <span className="font-medium">{shipment.numberOfPackages} {shipment.kindOfPackages || ''}</span>
                </div>
              )}

              {(shipment.grossWeight || shipment.weight) && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Gross Weight:</span>
                  <span className="font-medium">
                    {shipment.grossWeight || shipment.weight} {shipment.weightUnit || 'KG'}
                  </span>
                </div>
              )}

              {shipment.netWeight && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Net Weight:</span>
                  <span className="font-medium">{shipment.netWeight} {shipment.weightUnit || 'KG'}</span>
                </div>
              )}

              {shipment.volume && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Volume:</span>
                  <span className="font-medium">{shipment.volume} {shipment.volumeUnit || 'CBM'}</span>
                </div>
              )}

              {shipment.measurement && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Measurement:</span>
                  <span className="font-medium">{shipment.measurement}</span>
                </div>
              )}

              {shipment.marksAndNumbers && (
                <div className="flex justify-between items-start">
                  <span className="text-gray-600 w-1/3">Marks & Numbers:</span>
                  <span className="font-medium w-2/3 text-right">{shipment.marksAndNumbers}</span>
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

          {/* Commercial Information */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg py-2">Commercial Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {shipment.freightCharges && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Freight Charges:</span>
                    <span className="font-medium">{shipment.freightCurrency || '$'}{shipment.freightCharges}</span>
                  </div>
                )}

                {shipment.freightPaymentTerms && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Payment Terms:</span>
                    <span className="font-medium">{shipment.freightPaymentTerms}</span>
                  </div>
                )}

                {shipment.prepaidCollectDesignation && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Prepaid/Collect:</span>
                    <Badge variant={shipment.prepaidCollectDesignation === 'PREPAID' ? 'default' : 'secondary'}>
                      {shipment.prepaidCollectDesignation}
                    </Badge>
                  </div>
                )}

                {shipment.totalValue && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Total Value:</span>
                    <span className="font-medium">{shipment.currency || '$'}{shipment.totalValue}</span>
                  </div>
                )}

                {shipment.declaredValue && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Declared Value:</span>
                    <span className="font-medium">{shipment.currency || '$'}{shipment.declaredValue}</span>
                  </div>
                )}

                {shipment.customsBroker && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Customs Broker:</span>
                    <span className="font-medium">{shipment.customsBroker}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Dates and Times */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg py-2">Important Dates</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {shipment.issueDate && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Issue Date:</span>
                    <span className="font-medium">{new Date(shipment.issueDate).toLocaleDateString()}</span>
                  </div>
                )}

                {shipment.onBoardDate && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">On Board Date:</span>
                    <span className="font-medium">{new Date(shipment.onBoardDate).toLocaleDateString()}</span>
                  </div>
                )}

                {shipment.dateOfShipment && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Shipment Date:</span>
                    <span className="font-medium">{new Date(shipment.dateOfShipment).toLocaleDateString()}</span>
                  </div>
                )}

                {shipment.etd && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">ETD:</span>
                    <span className="font-medium">{new Date(shipment.etd).toLocaleDateString()}</span>
                  </div>
                )}

                {shipment.eta && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">ETA:</span>
                    <span className="font-medium">{new Date(shipment.eta).toLocaleDateString()}</span>
                  </div>
                )}

                {shipment.atd && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">ATD:</span>
                    <span className="font-medium">{new Date(shipment.atd).toLocaleDateString()}</span>
                  </div>
                )}

                {shipment.ata && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">ATA:</span>
                    <span className="font-medium">{new Date(shipment.ata).toLocaleDateString()}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

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
              onClick={() => handleCopyField("All shipment data", JSON.stringify(shipment, null, 2))}
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
