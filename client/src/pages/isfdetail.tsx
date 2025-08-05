import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Copy, FileText, Ship, Calendar, MapPin, Building2, CheckCircle, Clock, AlertCircle, DollarSign, Package, Globe, Download, Eye, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { IsfFiling, Document } from "@shared/schema";

export default function IsfDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch ISF filing details
  const { data: isfFiling, isLoading, error } = useQuery<IsfFiling>({
    queryKey: [`/api/isf/filings/${id}`],
    enabled: !!id,
  });

  // Fetch documents associated with this ISF filing
  const { data: documents = [] } = useQuery<Document[]>({
    queryKey: [`/api/documents/isf/${id}`],
    enabled: !!id,
  });

  // Convert ISF to Shipment mutation
  const convertToShipmentMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/isf/filings/${id}/convert-to-shipment`);
      console.log("Conversion response:", response);
      return response;
    },
    onSuccess: (data) => {
      console.log("Conversion successful:", data);
      toast({
        title: "Conversion Successful",
        description: `ISF filing converted to shipment ${data.shipment.shipmentId}. ${data.documentsLinked} document(s) linked.`,
      });
      // Refresh queries
      queryClient.invalidateQueries({ queryKey: ['/api/shipments'] });
      queryClient.invalidateQueries({ queryKey: [`/api/isf/filings/${id}`] });
      // Navigate to the new shipment (use numeric ID)
      setTimeout(() => {
        setLocation(`/shipments/detail/${data.shipment.id}`);
      }, 1000); // Small delay to allow queries to refresh
    },
    onError: (error: any) => {
      console.error("Conversion error:", error);
      toast({
        title: "Conversion Failed",
        description: error.message || "Failed to convert ISF filing to shipment",
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "Copied to clipboard",
        description: `${fieldName} copied successfully`,
      });
    });
  };

  const copyAllData = () => {
    if (!isfFiling) return;

    const formatDate = (date: Date | string | null) => {
      if (!date) return "";
      return new Date(date).toLocaleDateString();
    };

    const formatField = (label: string, value: string | null | undefined) => {
      if (!value) return "";
      return `${label}: ${value}\n`;
    };

    let allData = `=== ISF FILING DATA ===\n\n`;
    
    // Filing Information
    allData += `FILING INFORMATION:\n`;
    allData += formatField("ISF Number", isfFiling.isfNumber);
    allData += formatField("Status", isfFiling.status);
    allData += formatField("Filing Date", isfFiling.filingDate ? formatDate(isfFiling.filingDate) : null);
    allData += formatField("Submitted At", isfFiling.submittedAt ? new Date(isfFiling.submittedAt).toLocaleString() : null);
    allData += `\n`;

    // Consignee Information
    allData += `CONSIGNEE INFORMATION:\n`;
    allData += formatField("Consignee", isfFiling.consignee);
    allData += formatField("Consignee Address", isfFiling.consigneeAddress);
    allData += formatField("City", isfFiling.consigneeCity);
    allData += formatField("State", isfFiling.consigneeState);
    allData += formatField("ZIP Code", isfFiling.consigneeZip);
    allData += formatField("Country", isfFiling.consigneeCountry);
    allData += `\n`;

    // ISF 10 Required Elements
    allData += `ISF 10 REQUIRED ELEMENTS:\n`;
    allData += formatField("1. Seller Information", isfFiling.sellerInformation);
    allData += formatField("2. Buyer Information", isfFiling.buyerInformation);
    allData += formatField("3. Importer of Record Number", isfFiling.importerOfRecord);
    allData += formatField("4. Consignee", isfFiling.consignee);
    allData += formatField("5. Manufacturer Information", isfFiling.manufacturerInformation);
    allData += formatField("6. Ship to Party Information", isfFiling.shipToPartyInformation);
    allData += formatField("7. Country of Origin", isfFiling.countryOfOrigin);
    allData += formatField("8. HTSUS Number", isfFiling.htsusNumber);
    allData += formatField("8. Commodity Description", isfFiling.commodityDescription);
    allData += formatField("9. Container Stuffing Location", isfFiling.containerStuffingLocation);
    allData += formatField("10. Consolidator/Stuffer Info", isfFiling.consolidatorStufferInfo);
    allData += `\n`;

    // Shipment Details
    allData += `SHIPMENT DETAILS:\n`;
    allData += formatField("Bill of Lading", isfFiling.billOfLading);
    allData += formatField("Vessel Name", isfFiling.vesselName);
    allData += formatField("Voyage Number", isfFiling.voyageNumber);
    allData += formatField("Container Numbers", isfFiling.containerNumbers);
    allData += formatField("Foreign Port of Lading", isfFiling.foreignPortOfUnlading);
    allData += formatField("Port of Entry", isfFiling.portOfEntry);
    allData += formatField("Estimated Arrival Date", isfFiling.estimatedArrivalDate ? formatDate(isfFiling.estimatedArrivalDate) : null);
    allData += formatField("MBL SCAC Code", isfFiling.mblScacCode);
    allData += formatField("HBL SCAC Code", isfFiling.hblScacCode);
    allData += formatField("AMS Number", isfFiling.amsNumber);
    allData += `\n`;

    // Associated Documents
    if (documents.length > 0) {
      allData += `ASSOCIATED DOCUMENTS:\n`;
      documents.forEach((doc, index) => {
        allData += `${index + 1}. ${doc.fileName}\n`;
        allData += `   Category: ${doc.category?.replace(/_/g, ' ').replace(/\b\w/g, (letter: string) => letter.toUpperCase()) || 'N/A'}\n`;
        allData += `   Size: ${(doc.fileSize / 1024).toFixed(1)} KB\n`;
        allData += `   Date: ${new Date(doc.createdAt || doc.uploadDate).toLocaleDateString()}\n`;
      });
    }

    navigator.clipboard.writeText(allData).then(() => {
      toast({
        title: "All data copied to clipboard",
        description: "Complete ISF filing data has been copied successfully",
      });
    }).catch(() => {
      toast({
        title: "Copy failed",
        description: "Unable to copy data to clipboard",
        variant: "destructive",
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
          <div className="flex items-center justify-between group hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-200 -mx-2 px-2 py-1 rounded">
            <span className="break-all">{value}</span>
            <Button
              variant="ghost"
              size="sm"
              className="ml-2 shrink-0 hover:bg-blue-100 hover:text-blue-700 dark:hover:bg-blue-900 dark:hover:text-blue-300 text-gray-500 hover:text-blue-600"
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
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'paid':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'processed':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'completed':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
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
              onClick={() => convertToShipmentMutation.mutate()}
              disabled={convertToShipmentMutation.isPending}
              className="bg-freight-blue hover:bg-freight-blue/90 text-white"
            >
              {convertToShipmentMutation.isPending ? (
                <>Converting...</>
              ) : (
                <>
                  <Ship className="h-4 w-4 mr-2" />
                  Convert to Shipment
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
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
                <CopyableField label="ISF Number" value={isfFiling.isfNumber} className="font-bold text-blue-600 dark:text-blue-400" />
                <CopyableField label="Status" value={isfFiling.status} />
                <CopyableField label="Filing Date" value={isfFiling.filingDate ? new Date(isfFiling.filingDate).toLocaleDateString() : null} />
                <CopyableField label="Submitted At" value={isfFiling.submittedAt ? new Date(isfFiling.submittedAt).toLocaleString() : null} />
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
                <CopyableField label="Consignee" value={isfFiling.consignee} />
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
                <CopyableField label="1. Seller Information" value={isfFiling.sellerInformation} />
                <CopyableField label="2. Buyer Information" value={isfFiling.buyerInformation} />
                <CopyableField label="3. Importer of Record Number" value={isfFiling.importerOfRecord} />
                <CopyableField label="4. Consignee" value={isfFiling.consignee} />
                <CopyableField label="5. Manufacturer Information" value={isfFiling.manufacturerInformation} />
                <CopyableField label="6. Ship to Party Information" value={isfFiling.shipToPartyInformation} />
                <CopyableField label="7. Country of Origin" value={isfFiling.countryOfOrigin} />
                <CopyableField label="8. HTSUS Number" value={isfFiling.htsusNumber} />
                <CopyableField label="8. Commodity Description" value={isfFiling.commodityDescription} />
                <CopyableField label="9. Container Stuffing Location" value={isfFiling.containerStuffingLocation} />
                <CopyableField label="10. Consolidator/Stuffer Info" value={isfFiling.consolidatorStufferInfo} />
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
                <CopyableField label="Foreign Port of Lading" value={isfFiling.foreignPortOfUnlading} />
                <CopyableField label="Port of Entry" value={isfFiling.portOfEntry} />
                <CopyableField label="Estimated Arrival Date" value={isfFiling.estimatedArrivalDate ? new Date(isfFiling.estimatedArrivalDate).toLocaleDateString() : null} />
                <CopyableField label="MBL SCAC Code" value={isfFiling.mblScacCode} />
                <CopyableField label="HBL SCAC Code" value={isfFiling.hblScacCode} />
                <CopyableField label="AMS Number" value={isfFiling.amsNumber} />
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Associated Documents */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Associated Documents
            </CardTitle>
            <CardDescription>
              Documents submitted with this ISF filing
            </CardDescription>
          </CardHeader>
          <CardContent>
            {documents.length > 0 ? (
              <div className="space-y-4">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    <div className="flex items-center space-x-3">
                      <FileText className="h-5 w-5 text-blue-600" />
                      <div>
                        <p className="font-medium text-sm">{doc.fileName}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {doc.category?.replace(/_/g, ' ').replace(/\b\w/g, (letter: string) => letter.toUpperCase())} • {(doc.fileSize / 1024).toFixed(1)} KB • {new Date(doc.createdAt || doc.uploadDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="hover:bg-blue-100 hover:text-blue-700 dark:hover:bg-blue-900 dark:hover:text-blue-300"
                        onClick={() => window.open(`/api/documents/${doc.id}/view`, '_blank')}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="hover:bg-blue-100 hover:text-blue-700 dark:hover:bg-blue-900 dark:hover:text-blue-300"
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = `/api/documents/${doc.id}/download`;
                          link.download = doc.fileName;
                          link.click();
                        }}
                      >
                        <Download className="w-4 h-4 mr-1" />
                        Download
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No documents associated with this ISF filing</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Copy All Data Button */}
        <div className="flex justify-center pt-6">
          <Button
            onClick={() => copyAllData()}
            className="bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white px-8 py-3"
            size="lg"
          >
            <Copy className="w-5 h-5 mr-2" />
            Copy All Data
          </Button>
        </div>

      </div>
    </div>
  );
}