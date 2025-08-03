import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Download, Upload, CheckCircle, XCircle, ExternalLink, Ship, Package, Loader2 } from "lucide-react";

interface OneViewStatusData {
  success: boolean;
  integration_status: string;
  supported_formats: string[];
  total_exportable_shipments: number;
  last_updated: string;
}

interface BatchExportResult {
  shipmentId: number;
  xml: string;
  success: boolean;
  error?: string;
}

interface BatchExportResponse {
  success: boolean;
  results: BatchExportResult[];
  totalShipments: number;
  successfulExports: number;
  failedExports: number;
}

export default function OneViewIntegrationManager() {
  const [selectedFormat, setSelectedFormat] = useState<'oneview-standard' | 'edifact' | 'cargo-xml'>('oneview-standard');
  const [selectedShipments, setSelectedShipments] = useState<number[]>([]);
  const [batchExportMode, setBatchExportMode] = useState(false);
  const { toast } = useToast();

  // Fetch OneView integration status
  const { data: statusData, isLoading: statusLoading, refetch: refetchStatus } = useQuery<OneViewStatusData>({
    queryKey: ['/api/xml/oneview/status'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch all shipments for batch export selection
  const { data: allShipments, isLoading: shipmentsLoading } = useQuery<any[]>({
    queryKey: ['/api/shipments'],
    enabled: batchExportMode,
  });

  // Single shipment export mutation
  const exportSingleMutation = useMutation({
    mutationFn: async ({ shipmentId, format }: { shipmentId: number; format: string }) => {
      const response = await fetch(`/api/xml/oneview/export/${shipmentId}?format=${format}`);
      if (!response.ok) {
        throw new Error('Export failed');
      }
      return response.blob();
    },
    onSuccess: (blob, variables) => {
      // Download the file
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `oneview-shipment-${variables.shipmentId}-${variables.format}.xml`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Export Successful",
        description: `Shipment ${variables.shipmentId} exported to OneView ${variables.format} format`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export shipment",
        variant: "destructive",
      });
    },
  });

  // Batch export mutation
  const batchExportMutation = useMutation({
    mutationFn: async ({ shipmentIds, format }: { shipmentIds: number[]; format: string }) => {
      const response = await apiRequest('POST', '/api/xml/oneview/batch-export', {
        shipmentIds,
        format
      });
      return response.json() as Promise<BatchExportResponse>;
    },
    onSuccess: (data) => {
      toast({
        title: "Batch Export Complete",
        description: `${data.successfulExports}/${data.totalShipments} shipments exported successfully`,
      });
      setSelectedShipments([]);
      setBatchExportMode(false);
    },
    onError: (error: any) => {
      toast({
        title: "Batch Export Failed",
        description: error.message || "Failed to export shipments",
        variant: "destructive",
      });
    },
  });

  const handleSingleExport = (shipmentId: number) => {
    exportSingleMutation.mutate({ shipmentId, format: selectedFormat });
  };

  const handleBatchExport = () => {
    if (selectedShipments.length === 0) {
      toast({
        title: "No Shipments Selected",
        description: "Please select at least one shipment to export",
        variant: "destructive",
      });
      return;
    }
    batchExportMutation.mutate({ shipmentIds: selectedShipments, format: selectedFormat });
  };

  const toggleShipmentSelection = (shipmentId: number) => {
    setSelectedShipments(prev => 
      prev.includes(shipmentId) 
        ? prev.filter(id => id !== shipmentId)
        : [...prev, shipmentId]
    );
  };

  const selectAllShipments = () => {
    if (allShipments?.length) {
      const allIds = allShipments.map((s: any) => s.id);
      setSelectedShipments(allIds);
    }
  };

  const clearSelection = () => {
    setSelectedShipments([]);
  };

  const formatDisplayName = (format: string) => {
    switch (format) {
      case 'oneview-standard':
        return 'OneView Standard';
      case 'edifact':
        return 'UN/EDIFACT';
      case 'cargo-xml':
        return 'Cargo XML (Air)';
      default:
        return format;
    }
  };

  if (statusLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Ship className="w-5 h-5 mr-2 text-freight-blue" />
            Descartes OneView Integration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="ml-2">Loading OneView integration status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <Ship className="w-5 h-5 mr-2 text-freight-blue" />
            Descartes OneView Integration
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant={statusData?.integration_status === 'active' ? 'default' : 'destructive'}>
              {statusData?.integration_status === 'active' ? 'Active' : 'Inactive'}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchStatus()}
              className="text-freight-blue border-freight-blue hover:bg-freight-blue hover:text-white"
            >
              Refresh Status
            </Button>
          </div>
        </CardTitle>
        <CardDescription>
          Export shipment data to Descartes OneView freight management platform. 
          Supports multiple XML formats including OneView Standard, UN/EDIFACT, and Cargo XML.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-freight-blue/10 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Available Shipments</p>
                <p className="text-2xl font-bold text-freight-blue">
                  {statusData?.total_exportable_shipments || 0}
                </p>
              </div>
              <Package className="w-8 h-8 text-freight-blue" />
            </div>
          </div>
          
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Supported Formats</p>
                <p className="text-2xl font-bold text-green-600">
                  {statusData?.supported_formats?.length || 0}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>
          
          <div className="bg-orange-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Last Updated</p>
                <p className="text-sm font-medium text-orange-600">
                  {statusData?.last_updated ? new Date(statusData.last_updated).toLocaleString() : 'N/A'}
                </p>
              </div>
              <ExternalLink className="w-8 h-8 text-orange-600" />
            </div>
          </div>
        </div>

        {/* Export Format Selection */}
        <div className="space-y-3">
          <Label htmlFor="format-select">Export Format</Label>
          <Select value={selectedFormat} onValueChange={(value: any) => setSelectedFormat(value)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select export format" />
            </SelectTrigger>
            <SelectContent>
              {statusData?.supported_formats?.map((format) => (
                <SelectItem key={format} value={format}>
                  {formatDisplayName(format)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-gray-500">
            {selectedFormat === 'oneview-standard' && 'Standard OneView XML format optimized for Forwarder Enterprise'}
            {selectedFormat === 'edifact' && 'UN/EDIFACT COPRAR format for standardized maritime messaging'}
            {selectedFormat === 'cargo-xml' && 'IATA Cargo XML format specifically designed for air shipments'}
          </p>
        </div>

        {/* Export Controls */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-4">
            <Button
              variant={batchExportMode ? "default" : "outline"}
              onClick={() => setBatchExportMode(!batchExportMode)}
              className={batchExportMode ? "bg-freight-blue text-white" : "text-freight-blue border-freight-blue"}
            >
              {batchExportMode ? "Exit Batch Mode" : "Batch Export Mode"}
            </Button>
            
            {batchExportMode && (
              <div className="flex items-center space-x-2">
                <Badge variant="secondary">
                  {selectedShipments.length} selected
                </Badge>
                <Button size="sm" variant="outline" onClick={selectAllShipments}>
                  Select All
                </Button>
                <Button size="sm" variant="outline" onClick={clearSelection}>
                  Clear
                </Button>
              </div>
            )}
          </div>
          
          {batchExportMode && (
            <Button
              onClick={handleBatchExport}
              disabled={batchExportMutation.isPending || selectedShipments.length === 0}
              className="bg-freight-blue text-white hover:bg-freight-blue/90"
            >
              {batchExportMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Export Selected ({selectedShipments.length})
                </>
              )}
            </Button>
          )}
        </div>

        {/* Shipments Table for Batch Mode */}
        {batchExportMode && (
          <div className="space-y-3">
            <h4 className="font-medium text-freight-dark">Select Shipments for Export</h4>
            {shipmentsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="ml-2">Loading shipments...</span>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={allShipments?.length > 0 && selectedShipments.length === allShipments.length}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              selectAllShipments();
                            } else {
                              clearSelection();
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>Shipment ID</TableHead>
                      <TableHead>Origin</TableHead>
                      <TableHead>Destination</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Transport Mode</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allShipments?.map((shipment: any) => (
                      <TableRow key={shipment.id} className="hover:bg-gray-50">
                        <TableCell>
                          <Checkbox
                            checked={selectedShipments.includes(shipment.id)}
                            onCheckedChange={() => toggleShipmentSelection(shipment.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{shipment.shipmentId}</TableCell>
                        <TableCell>{shipment.origin}</TableCell>
                        <TableCell>{shipment.destination}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{shipment.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{shipment.transportMode}</Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSingleExport(shipment.id)}
                            disabled={exportSingleMutation.isPending}
                            className="text-freight-blue border-freight-blue hover:bg-freight-blue hover:text-white"
                          >
                            {exportSingleMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}

        {/* Integration Information */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">About Descartes OneView Integration</h4>
          <p className="text-sm text-blue-800 mb-3">
            This integration allows you to export shipment data directly to Descartes OneView, 
            a comprehensive freight management platform used by logistics providers worldwide.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <h5 className="font-medium text-blue-900">OneView Standard</h5>
              <p className="text-blue-700">Optimized for OneView Forwarder Enterprise with complete shipment data</p>
            </div>
            <div>
              <h5 className="font-medium text-blue-900">UN/EDIFACT</h5>
              <p className="text-blue-700">Industry standard COPRAR format for maritime container messaging</p>
            </div>
            <div>
              <h5 className="font-medium text-blue-900">Cargo XML</h5>
              <p className="text-blue-700">IATA standard format specifically designed for air cargo operations</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}