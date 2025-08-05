import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Copy, FileText, Ship, Calendar, MapPin, Building2, CheckCircle, Clock, AlertCircle, DollarSign, Package, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { IsfFiling } from "@shared/schema";

export default function IsfDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Fetch ISF filing details
  const { data: isfFiling, isLoading, error } = useQuery<IsfFiling>({
    queryKey: [`/api/isf/filings/${id}`],
    enabled: !!id,
  });

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "Copied to clipboard",
        description: `${fieldName} copied successfully`,
      });
    });
  };

  // Reusable component for copyable fields
  const CopyableField = ({ 
    label, 
    value, 
    className = "" 
  }: { 
    label: string; 
    value: string | null | undefined; 
    className?: string;
  }) => {
    if (!value) return null;
    
    return (
      <TableRow>
        <TableCell className="font-medium w-1/3">{label}</TableCell>
        <TableCell className={`font-mono ${className}`}>
          <div className="flex items-center justify-between group">
            <span className="break-all">{value}</span>
            <Button
              variant="ghost"
              size="sm"
              className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0"
              onClick={() => copyToClipboard(value, label)}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted':
        return 'bg-blue-100 text-blue-800';
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'processed':
        return 'bg-purple-100 text-purple-800';
      case 'completed':
        return 'bg-emerald-100 text-emerald-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'submitted':
        return <Clock className="h-4 w-4" />;
      case 'paid':
      case 'processed':
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'rejected':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-64 mb-6"></div>
            <div className="space-y-4">
              <div className="h-32 bg-gray-200 rounded"></div>
              <div className="h-48 bg-gray-200 rounded"></div>
              <div className="h-48 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !isfFiling) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <Card>
            <CardContent className="flex items-center justify-center p-8">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">ISF Filing Not Found</h2>
                <p className="text-gray-600 mb-4">The requested ISF filing could not be found.</p>
                <Button onClick={() => setLocation("/fastisf")}>
                  Back to Fast ISF
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">ISF Filing Details</h1>
            <p className="text-gray-600 mt-1">ISF Number: {isfFiling.isfNumber}</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge className={`${getStatusColor(isfFiling.status || 'draft')} flex items-center gap-1`}>
              {getStatusIcon(isfFiling.status || 'draft')}
              {(isfFiling.status || 'draft').toUpperCase()}
            </Badge>
            <Button
              variant="outline"
              onClick={() => setLocation("/fastisf")}
            >
              Back to Fast ISF
            </Button>
          </div>
        </div>

        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Filing Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                <CopyableField label="ISF Number" value={isfFiling.isfNumber} className="font-bold text-blue-600" />
                <CopyableField label="Status" value={isfFiling.status} />
                <CopyableField label="Filing Date" value={isfFiling.filingDate ? new Date(isfFiling.filingDate).toLocaleDateString() : null} />
                <CopyableField label="Submitted At" value={isfFiling.submittedAt ? new Date(isfFiling.submittedAt).toLocaleString() : null} />
                <CopyableField label="Filing Fee" value={isfFiling.paymentAmount ? `$${isfFiling.paymentAmount}` : null} />
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Importer Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Importer Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                <CopyableField label="Importer of Record" value={isfFiling.importerOfRecord} />
                <CopyableField label="Importer Name" value={isfFiling.importerName} />
                <CopyableField label="Importer Address" value={isfFiling.importerAddress} />
                <CopyableField label="City" value={isfFiling.importerCity} />
                <CopyableField label="State" value={isfFiling.importerState} />
                <CopyableField label="ZIP Code" value={isfFiling.importerZip} />
                <CopyableField label="Country" value={isfFiling.importerCountry} />
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Consignee Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Consignee Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                <CopyableField label="Consignee Number" value={isfFiling.consigneeNumber} />
                <CopyableField label="Consignee Name" value={isfFiling.consigneeName} />
                <CopyableField label="Consignee Address" value={isfFiling.consigneeAddress} />
                <CopyableField label="City" value={isfFiling.consigneeCity} />
                <CopyableField label="State" value={isfFiling.consigneeState} />
                <CopyableField label="ZIP Code" value={isfFiling.consigneeZip} />
                <CopyableField label="Country" value={isfFiling.consigneeCountry} />
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* 10 Required Elements */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ship className="h-5 w-5" />
              ISF 10 Required Elements
            </CardTitle>
            <CardDescription>
              10 mandatory data elements required for ISF filing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                <CopyableField label="3. Manufacturer Information" value={isfFiling.manufacturerInformation} />
                <CopyableField label="4. Ship to Party Information" value={isfFiling.shipToPartyInformation} />
                <CopyableField label="5. Country of Origin" value={isfFiling.countryOfOrigin} />
                <CopyableField label="6. HTSUS Number" value={isfFiling.htsusNumber} />
                <CopyableField label="6. Commodity Description" value={isfFiling.commodityDescription} />
                <CopyableField label="7. Container Stuffing Location" value={isfFiling.containerStuffingLocation} />
                <CopyableField label="8. Consolidator/Stuffer Info" value={isfFiling.consolidatorStufferInfo} />
                <CopyableField label="9. Buyer Information" value={isfFiling.buyerInformation} />
                <CopyableField label="10. Seller Information" value={isfFiling.sellerInformation} />
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Shipment Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Shipment Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                <CopyableField label="Bill of Lading" value={isfFiling.billOfLading} />
                <CopyableField label="Vessel Name" value={isfFiling.vesselName} />
                <CopyableField label="Voyage Number" value={isfFiling.voyageNumber} />
                <CopyableField label="Container Numbers" value={isfFiling.containerNumbers} />
                <CopyableField label="Port of Entry" value={isfFiling.portOfEntry} />
                <CopyableField label="Estimated Arrival Date" value={isfFiling.estimatedArrivalDate ? new Date(isfFiling.estimatedArrivalDate).toLocaleDateString() : null} />
                <CopyableField label="MBL SCAC Code" value={isfFiling.mblScacCode} />
                <CopyableField label="HBL SCAC Code" value={isfFiling.hblScacCode} />
                <CopyableField label="AMS Number" value={isfFiling.amsNumber} />
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* +2 Additional Elements */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              +2 Additional Elements
            </CardTitle>
            <CardDescription>
              Additional data elements required for complete ISF filing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                <CopyableField label="Booking Party Name" value={isfFiling.bookingPartyName} />
                <CopyableField label="Booking Party Address" value={isfFiling.bookingPartyAddress} />
                <CopyableField label="Booking Party City" value={isfFiling.bookingPartyCity} />
                <CopyableField label="Booking Party Country" value={isfFiling.bookingPartyCountry} />
                <CopyableField label="Foreign Port of Unlading" value={isfFiling.foreignPortOfUnlading} />
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Commercial Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Commercial Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                <CopyableField label="Invoice Number" value={isfFiling.invoiceNumber} />
                <CopyableField label="Invoice Date" value={isfFiling.invoiceDate ? new Date(isfFiling.invoiceDate).toLocaleDateString() : null} />
                <CopyableField label="Invoice Value" value={isfFiling.invoiceValue ? `${isfFiling.currency || 'USD'} ${isfFiling.invoiceValue}` : null} />
                <CopyableField label="Terms" value={isfFiling.terms} />
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Payment Information */}
        {isfFiling.paymentAmount && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Payment Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableBody>
                  <CopyableField label="Filing Fee" value={`$${isfFiling.paymentAmount}`} className="font-bold text-green-600" />
                  <CopyableField label="Payment Status" value={isfFiling.paymentStatus} />
                  <CopyableField label="Transaction ID" value={isfFiling.paymentTransactionId} />
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}