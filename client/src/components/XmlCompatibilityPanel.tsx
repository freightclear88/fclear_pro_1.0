import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Upload, RefreshCw, FileCode, Database, RotateCcw } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Shipment } from "@shared/schema";

interface XmlCompatibilityPanelProps {
  shipment: Shipment;
}

interface XmlStatus {
  has_xml_data: boolean;
  source_system: string;
  external_id?: string;
  last_xml_update?: string;
  xml_version?: string;
  supports_export: boolean;
  available_formats: string[];
  cross_compatible: boolean;
}

export function XmlCompatibilityPanel({ shipment }: XmlCompatibilityPanelProps) {
  const [selectedFormat, setSelectedFormat] = useState<string>('custom');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch XML compatibility status
  const { data: xmlStatus, isLoading } = useQuery<{ xml_status: XmlStatus }>({
    queryKey: ['/api/shipments', shipment.id, 'xml-status'],
    enabled: !!shipment.id
  });

  // XML Export mutation
  const exportXmlMutation = useMutation({
    mutationFn: async (format: string) => {
      const response = await fetch(`/api/shipments/${shipment.id}/xml?format=${format}`);
      if (!response.ok) {
        throw new Error('Export failed');
      }
      
      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${shipment.shipmentId}_${format}.xml`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onSuccess: () => {
      toast({
        title: "Export successful",
        description: `XML file downloaded in ${selectedFormat} format`,
      });
    },
    onError: (error) => {
      toast({
        title: "Export failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // XML Sync mutation
  const syncXmlMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('/api/xml/sync-shipment', {
        method: 'POST',
        body: JSON.stringify({
          shipmentId: shipment.shipmentId,
          xmlData: shipment.xmlData,
          sourceSystem: shipment.sourceSystem
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/shipments'] });
      toast({
        title: "Sync successful",
        description: "Shipment data synchronized with XML systems",
      });
    },
    onError: (error) => {
      toast({
        title: "Sync failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCode className="h-5 w-5" />
            XML Compatibility
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const status = xmlStatus?.xml_status;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileCode className="h-5 w-5" />
          XML Cross-Compatibility
        </CardTitle>
        <CardDescription>
          Export shipment data in industry-standard XML formats or sync with external systems
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Overview */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm font-medium text-gray-600">Source System</div>
            <Badge variant={status?.source_system === 'manual' ? 'secondary' : 'default'}>
              {status?.source_system || 'Manual'}
            </Badge>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-600">Cross-Compatible</div>
            <Badge variant={status?.cross_compatible ? 'default' : 'destructive'}>
              {status?.cross_compatible ? 'Yes' : 'No'}
            </Badge>
          </div>
        </div>

        {status?.has_xml_data && (
          <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
              <Database className="h-4 w-4" />
              <span className="text-sm font-medium">Original XML Data Available</span>
            </div>
            {status.external_id && (
              <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                External ID: {status.external_id}
              </div>
            )}
            {status.last_xml_update && (
              <div className="text-xs text-blue-600 dark:text-blue-400">
                Last Update: {new Date(status.last_xml_update).toLocaleString()}
              </div>
            )}
          </div>
        )}

        {/* Export Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            <span className="text-sm font-medium">Export XML</span>
          </div>
          
          <div className="flex gap-2">
            <Select value={selectedFormat} onValueChange={setSelectedFormat}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">Freightclear Custom</SelectItem>
                <SelectItem value="edifact">UN/EDIFACT</SelectItem>
                <SelectItem value="smdg">SMDG Standard</SelectItem>
              </SelectContent>
            </Select>
            
            <Button
              onClick={() => exportXmlMutation.mutate(selectedFormat)}
              disabled={exportXmlMutation.isPending}
              size="sm"
            >
              {exportXmlMutation.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Export
            </Button>
          </div>

          <div className="text-xs text-gray-500">
            Available formats: {status?.available_formats?.join(', ') || 'None'}
          </div>
        </div>

        {/* Sync Section */}
        {status?.has_xml_data && (
          <div className="space-y-3 pt-3 border-t">
            <div className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4" />
              <span className="text-sm font-medium">XML Synchronization</span>
            </div>
            
            <Button
              onClick={() => syncXmlMutation.mutate()}
              disabled={syncXmlMutation.isPending}
              variant="outline"
              size="sm"
              className="w-full"
            >
              {syncXmlMutation.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RotateCcw className="h-4 w-4 mr-2" />
              )}
              Sync with External Systems
            </Button>
            
            <div className="text-xs text-gray-500">
              Synchronize this shipment's data with external XML-based systems
            </div>
          </div>
        )}

        {/* Upload Section */}
        <div className="space-y-3 pt-3 border-t">
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            <span className="text-sm font-medium">XML Import</span>
          </div>
          
          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="text-xs text-gray-600 dark:text-gray-400">
              To import XML data for this shipment, use the XML Integration Manager in the admin panel.
              Supports UN/EDIFACT COPRAR, COPARN, and custom formats.
            </div>
          </div>
        </div>

        {/* Format Information */}
        <div className="space-y-2 pt-3 border-t">
          <div className="text-sm font-medium">Supported XML Standards</div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span>UN/EDIFACT COPRAR</span>
              <Badge variant="outline" className="text-xs">Container Reports</Badge>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span>UN/EDIFACT COPARN</span>
              <Badge variant="outline" className="text-xs">Container Announcements</Badge>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span>SMDG Standard</span>
              <Badge variant="outline" className="text-xs">Ship-to-Shore</Badge>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span>Freightclear Custom</span>
              <Badge variant="outline" className="text-xs">Enhanced Format</Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}