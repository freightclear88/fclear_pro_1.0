import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Copy, 
  ArrowLeft, 
  FileText, 
  Building2, 
  Users, 
  Globe, 
  Package, 
  Ship, 
  CreditCard,
  Calendar,
  MapPin,
  Phone,
  Mail,
  Hash,
  DollarSign
} from "lucide-react";
import { Link } from "wouter";
import type { IsfFiling } from "@shared/schema";

export default function IsfDetail() {
  const [, params] = useRoute("/isf/detail/:id");
  const { toast } = useToast();

  const { data: isfFiling, isLoading } = useQuery<IsfFiling>({
    queryKey: [`/api/isf/filings/${params?.id}`],
    enabled: !!params?.id,
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
    if (!isfFiling) return;
    
    const formatDate = (dateString: string | null) => {
      if (!dateString) return 'N/A';
      return new Date(dateString).toLocaleDateString();
    };

    const formatValue = (value: any) => {
      if (value === null || value === undefined) return 'N/A';
      if (typeof value === 'string' && value.trim() === '') return 'N/A';
      return value.toString();
    };

    const isfData = `
ISF FILING DETAILS - ${isfFiling.isfNumber}
=========================================

FILING INFORMATION:
- ISF Number: ${formatValue(isfFiling.isfNumber)}
- Status: ${formatValue(isfFiling.status)}
- Filing Date: ${formatDate(isfFiling.filingDate?.toString() || null)}

IMPORTER INFORMATION:
- Importer of Record: ${formatValue(isfFiling.importerOfRecord)}
- Name: ${formatValue(isfFiling.importerName)}
- Address: ${formatValue(isfFiling.importerAddress)}
- City: ${formatValue(isfFiling.importerCity)}
- State: ${formatValue(isfFiling.importerState)}
- ZIP: ${formatValue(isfFiling.importerZip)}
- Country: ${formatValue(isfFiling.importerCountry)}

CONSIGNEE INFORMATION:
- Consignee Number: ${formatValue(isfFiling.consigneeNumber)}
- Name: ${formatValue(isfFiling.consigneeName)}
- Address: ${formatValue(isfFiling.consigneeAddress)}
- City: ${formatValue(isfFiling.consigneeCity)}
- State: ${formatValue(isfFiling.consigneeState)}
- ZIP: ${formatValue(isfFiling.consigneeZip)}
- Country: ${formatValue(isfFiling.consigneeCountry)}

ISF 10+2 DATA ELEMENTS:
- Manufacturer Information: ${formatValue(isfFiling.manufacturerInformation)}
- Ship-to Party Information: ${formatValue(isfFiling.shipToPartyInformation)}
- Country of Origin: ${formatValue(isfFiling.countryOfOrigin)}
- HTSUS Number: ${formatValue(isfFiling.htsusNumber)}
- Commodity Description: ${formatValue(isfFiling.commodityDescription)}
- Container Stuffing Location: ${formatValue(isfFiling.containerStuffingLocation)}
- Consolidator Information: ${formatValue(isfFiling.consolidatorStufferInfo)}
- Buyer Information: ${formatValue(isfFiling.buyerInformation)}
- Seller Information: ${formatValue(isfFiling.sellerInformation)}

BOOKING PARTY:
- Name: ${formatValue(isfFiling.bookingPartyName)}
- Address: ${formatValue(isfFiling.bookingPartyAddress)}
- City: ${formatValue(isfFiling.bookingPartyCity)}
- Country: ${formatValue(isfFiling.bookingPartyCountry)}

SHIPMENT DETAILS:
- Bill of Lading: ${formatValue(isfFiling.billOfLading)}
- Vessel Name: ${formatValue(isfFiling.vesselName)}
- Voyage Number: ${formatValue(isfFiling.voyageNumber)}
- Container Numbers: ${formatValue(isfFiling.containerNumbers)}
- MBL SCAC Code: ${formatValue(isfFiling.mblScacCode)}
- HBL SCAC Code: ${formatValue(isfFiling.hblScacCode)}
- AMS Number: ${formatValue(isfFiling.amsNumber)}
- Estimated Arrival Date: ${formatDate(isfFiling.estimatedArrivalDate?.toString() || null)}
- Port of Entry: ${formatValue(isfFiling.portOfEntry)}
- Foreign Port of Unlading: ${formatValue(isfFiling.foreignPortOfUnlading)}

COMMERCIAL INFORMATION:
- Invoice Number: ${formatValue(isfFiling.invoiceNumber)}
- Invoice Date: ${formatDate(isfFiling.invoiceDate?.toString() || null)}
- Invoice Value: ${formatValue(isfFiling.invoiceValue)} ${formatValue(isfFiling.currency)}
- Terms: ${formatValue(isfFiling.terms)}
`;

    try {
      await navigator.clipboard.writeText(isfData.trim());
      toast({
        title: "Copied",
        description: "All ISF filing data copied in readable format",
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy ISF filing data",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'submitted':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'paid':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'processed':
        return 'bg-teal-100 text-teal-800 border-teal-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'draft':
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-teal"></div>
      </div>
    );
  }

  if (!isfFiling) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-600">ISF Filing Not Found</h2>
          <p className="text-gray-500 mt-2">The requested ISF filing could not be found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/fastisf">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to ISF
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">ISF Filing Details</h1>
            <p className="text-gray-500">ISF Number: {isfFiling.isfNumber}</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <Badge className={getStatusColor(isfFiling.status)}>
            {isfFiling.status.charAt(0).toUpperCase() + isfFiling.status.slice(1)}
          </Badge>
          <Button onClick={handleCopyAllData} variant="outline">
            <Copy className="w-4 h-4 mr-2" />
            Copy All Data
          </Button>
        </div>
      </div>

      {/* ISF Filing Overview */}
      <Card className="bg-gradient-to-r from-teal-50 to-cyan-50 border-teal-200">
        <CardHeader>
          <CardTitle className="flex items-center text-teal-700">
            <FileText className="w-5 h-5 mr-2" />
            ISF Filing Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">ISF Number</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopyField("ISF Number", isfFiling.isfNumber)}
                className="h-6 w-6 p-0"
              >
                <Copy className="w-3 h-3" />
              </Button>
            </div>
            <p className="text-sm text-gray-900 font-mono">{isfFiling.isfNumber}</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Filing Date</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopyField("Filing Date", isfFiling.filingDate?.toString() || 'N/A')}
                className="h-6 w-6 p-0"
              >
                <Copy className="w-3 h-3" />
              </Button>
            </div>
            <p className="text-sm text-gray-900">
              {isfFiling.filingDate ? new Date(isfFiling.filingDate).toLocaleDateString() : 'Not filed yet'}
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Port of Entry</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopyField("Port of Entry", isfFiling.portOfEntry || 'N/A')}
                className="h-6 w-6 p-0"
              >
                <Copy className="w-3 h-3" />
              </Button>
            </div>
            <p className="text-sm text-gray-900">{isfFiling.portOfEntry || 'N/A'}</p>
          </div>
        </CardContent>
      </Card>

      {/* Importer Information */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center text-blue-700">
            <Building2 className="w-5 h-5 mr-2" />
            Importer Information
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Importer of Record</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyField("Importer of Record", isfFiling.importerOfRecord)}
                  className="h-6 w-6 p-0"
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <p className="text-sm text-gray-900 font-mono">{isfFiling.importerOfRecord}</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Company Name</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyField("Importer Name", isfFiling.importerName)}
                  className="h-6 w-6 p-0"
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <p className="text-sm text-gray-900">{isfFiling.importerName}</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Address</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyField("Importer Address", `${isfFiling.importerAddress}, ${isfFiling.importerCity}, ${isfFiling.importerState} ${isfFiling.importerZip}, ${isfFiling.importerCountry}`)}
                  className="h-6 w-6 p-0"
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <div className="text-sm text-gray-900">
                <p>{isfFiling.importerAddress}</p>
                <p>{isfFiling.importerCity}, {isfFiling.importerState} {isfFiling.importerZip}</p>
                <p>{isfFiling.importerCountry}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Consignee Information */}
      <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
        <CardHeader>
          <CardTitle className="flex items-center text-green-700">
            <Users className="w-5 h-5 mr-2" />
            Consignee Information
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Consignee Number</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyField("Consignee Number", isfFiling.consigneeNumber)}
                  className="h-6 w-6 p-0"
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <p className="text-sm text-gray-900 font-mono">{isfFiling.consigneeNumber}</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Company Name</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyField("Consignee Name", isfFiling.consigneeName)}
                  className="h-6 w-6 p-0"
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <p className="text-sm text-gray-900">{isfFiling.consigneeName}</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Address</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyField("Consignee Address", `${isfFiling.consigneeAddress}, ${isfFiling.consigneeCity}, ${isfFiling.consigneeState} ${isfFiling.consigneeZip}, ${isfFiling.consigneeCountry}`)}
                  className="h-6 w-6 p-0"
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <div className="text-sm text-gray-900">
                <p>{isfFiling.consigneeAddress}</p>
                <p>{isfFiling.consigneeCity}, {isfFiling.consigneeState} {isfFiling.consigneeZip}</p>
                <p>{isfFiling.consigneeCountry}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ISF 10+2 Data Elements */}
      <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
        <CardHeader>
          <CardTitle className="flex items-center text-purple-700">
            <Package className="w-5 h-5 mr-2" />
            ISF 10+2 Required Data Elements
          </CardTitle>
          <CardDescription>
            The 10+2 security filing data elements required by CBP
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Row 1: Manufacturer, Ship-to Party, Country of Origin */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Manufacturer Information</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyField("Manufacturer Information", isfFiling.manufacturerInformation || 'N/A')}
                  className="h-6 w-6 p-0"
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <div className="text-xs text-gray-900 whitespace-pre-line bg-gray-50 p-2 rounded border">
                {isfFiling.manufacturerInformation || 'N/A'}
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Ship-to Party Information</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyField("Ship-to Party Information", isfFiling.shipToPartyInformation || 'N/A')}
                  className="h-6 w-6 p-0"
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <div className="text-xs text-gray-900 whitespace-pre-line bg-gray-50 p-2 rounded border">
                {isfFiling.shipToPartyInformation || 'N/A'}
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Country of Origin</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyField("Country of Origin", isfFiling.countryOfOrigin || 'N/A')}
                  className="h-6 w-6 p-0"
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <p className="text-sm text-gray-900">{isfFiling.countryOfOrigin || 'N/A'}</p>
            </div>
          </div>

          {/* Row 2: HTSUS, Container Stuffing, Consolidator */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">HTSUS Number</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyField("HTSUS Number", isfFiling.htsusNumber || 'N/A')}
                  className="h-6 w-6 p-0"
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <p className="text-sm text-gray-900 font-mono">{isfFiling.htsusNumber || 'N/A'}</p>
              {isfFiling.commodityDescription && (
                <div className="mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-600">Commodity Description</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyField("Commodity Description", isfFiling.commodityDescription || 'N/A')}
                      className="h-4 w-4 p-0"
                    >
                      <Copy className="w-2 h-2" />
                    </Button>
                  </div>
                  <p className="text-xs text-gray-800">{isfFiling.commodityDescription}</p>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Container Stuffing Location</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyField("Container Stuffing Location", isfFiling.containerStuffingLocation || 'N/A')}
                  className="h-6 w-6 p-0"
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <div className="text-xs text-gray-900 whitespace-pre-line bg-gray-50 p-2 rounded border">
                {isfFiling.containerStuffingLocation || 'N/A'}
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Consolidator Information</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyField("Consolidator Information", isfFiling.consolidatorStufferInfo || 'N/A')}
                  className="h-6 w-6 p-0"
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <div className="text-xs text-gray-900 whitespace-pre-line bg-gray-50 p-2 rounded border">
                {isfFiling.consolidatorStufferInfo || 'N/A'}
              </div>
            </div>
          </div>

          {/* Row 3: Buyer and Seller Information */}
          {(isfFiling.buyerInformation || isfFiling.sellerInformation) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {isfFiling.buyerInformation && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Buyer Information</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyField("Buyer Information", isfFiling.buyerInformation || 'N/A')}
                      className="h-6 w-6 p-0"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="text-xs text-gray-900 whitespace-pre-line bg-gray-50 p-2 rounded border">
                    {isfFiling.buyerInformation}
                  </div>
                </div>
              )}
              {isfFiling.sellerInformation && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Seller Information</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyField("Seller Information", isfFiling.sellerInformation || 'N/A')}
                      className="h-6 w-6 p-0"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="text-xs text-gray-900 whitespace-pre-line bg-gray-50 p-2 rounded border">
                    {isfFiling.sellerInformation}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Booking Party Information */}
      <Card className="bg-gradient-to-r from-orange-50 to-red-50 border-orange-200">
        <CardHeader>
          <CardTitle className="flex items-center text-orange-700">
            <Building2 className="w-5 h-5 mr-2" />
            Booking Party Information (+2 Element)
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Party Name</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyField("Booking Party Name", isfFiling.bookingPartyName || 'N/A')}
                  className="h-6 w-6 p-0"
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <p className="text-sm text-gray-900">{isfFiling.bookingPartyName || 'N/A'}</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Address</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyField("Booking Party Address", `${isfFiling.bookingPartyAddress}, ${isfFiling.bookingPartyCity}, ${isfFiling.bookingPartyCountry}`)}
                  className="h-6 w-6 p-0"
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <div className="text-sm text-gray-900">
                <p>{isfFiling.bookingPartyAddress || 'N/A'}</p>
                <p>{isfFiling.bookingPartyCity}, {isfFiling.bookingPartyCountry}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Shipment Details */}
      <Card className="bg-gradient-to-r from-cyan-50 to-blue-50 border-cyan-200">
        <CardHeader>
          <CardTitle className="flex items-center text-cyan-700">
            <Ship className="w-5 h-5 mr-2" />
            Shipment Details
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Bill of Lading</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyField("Bill of Lading", isfFiling.billOfLading || 'N/A')}
                  className="h-6 w-6 p-0"
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <p className="text-sm text-gray-900 font-mono">{isfFiling.billOfLading || 'N/A'}</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Vessel Name</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyField("Vessel Name", isfFiling.vesselName || 'N/A')}
                  className="h-6 w-6 p-0"
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <p className="text-sm text-gray-900">{isfFiling.vesselName || 'N/A'}</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Voyage Number</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyField("Voyage Number", isfFiling.voyageNumber || 'N/A')}
                  className="h-6 w-6 p-0"
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <p className="text-sm text-gray-900">{isfFiling.voyageNumber || 'N/A'}</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Container Numbers</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyField("Container Numbers", isfFiling.containerNumbers || 'N/A')}
                  className="h-6 w-6 p-0"
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <p className="text-sm text-gray-900 font-mono">{isfFiling.containerNumbers || 'N/A'}</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">MBL SCAC Code</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyField("MBL SCAC Code", isfFiling.mblScacCode || 'N/A')}
                  className="h-6 w-6 p-0"
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <p className="text-sm text-gray-900 font-mono">{isfFiling.mblScacCode || 'N/A'}</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">HBL SCAC Code</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyField("HBL SCAC Code", isfFiling.hblScacCode || 'N/A')}
                  className="h-6 w-6 p-0"
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <p className="text-sm text-gray-900 font-mono">{isfFiling.hblScacCode || 'N/A'}</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">AMS Number</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyField("AMS Number", isfFiling.amsNumber || 'N/A')}
                  className="h-6 w-6 p-0"
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <p className="text-sm text-gray-900 font-mono">{isfFiling.amsNumber || 'N/A'}</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Estimated Arrival Date</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyField("Estimated Arrival Date", isfFiling.estimatedArrivalDate?.toString() || 'N/A')}
                  className="h-6 w-6 p-0"
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <p className="text-sm text-gray-900">
                {isfFiling.estimatedArrivalDate ? new Date(isfFiling.estimatedArrivalDate).toLocaleDateString() : 'N/A'}
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Foreign Port of Unlading</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyField("Foreign Port of Unlading", isfFiling.foreignPortOfUnlading || 'N/A')}
                  className="h-6 w-6 p-0"
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <p className="text-sm text-gray-900">{isfFiling.foreignPortOfUnlading || 'N/A'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Commercial Information */}
      {(isfFiling.invoiceNumber || isfFiling.invoiceValue || isfFiling.terms) && (
        <Card className="bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200">
          <CardHeader>
            <CardTitle className="flex items-center text-yellow-700">
              <DollarSign className="w-5 h-5 mr-2" />
              Commercial Information
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {isfFiling.invoiceNumber && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Invoice Number</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyField("Invoice Number", isfFiling.invoiceNumber || 'N/A')}
                    className="h-6 w-6 p-0"
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
                <p className="text-sm text-gray-900 font-mono">{isfFiling.invoiceNumber}</p>
              </div>
            )}
            {isfFiling.invoiceValue && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Invoice Value</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyField("Invoice Value", `${isfFiling.invoiceValue} ${isfFiling.currency}`)}
                    className="h-6 w-6 p-0"
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
                <p className="text-sm text-gray-900">{isfFiling.invoiceValue} {isfFiling.currency}</p>
              </div>
            )}
            {isfFiling.terms && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Terms</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyField("Terms", isfFiling.terms || 'N/A')}
                    className="h-6 w-6 p-0"
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
                <p className="text-sm text-gray-900">{isfFiling.terms}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}