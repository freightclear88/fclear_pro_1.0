import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { FileUp, Upload, Download, Eye, CheckCircle, XCircle, AlertCircle, BarChart3, Copy, FileText } from "lucide-react";
import { useDropzone } from "react-dropzone";

interface XMLTemplate {
  name: string;
  description: string;
  example: string;
}

interface XMLTemplates {
  [key: string]: XMLTemplate;
}

interface XMLProcessingResult {
  success: boolean;
  shipmentId?: string;
  error?: string;
}

interface XMLUploadSummary {
  total: number;
  successful: number;
  failed: number;
  fileName?: string;
}

interface XMLIntegrationStats {
  total_xml_shipments: number;
  recent_activity: Array<{
    shipment_id: string;
    status: string;
    transport_mode: string;
    created_at: string;
    source: string;
  }>;
  status_distribution: {
    [key: string]: number;
  };
}

export default function XMLIntegrationManager() {
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [xmlContent, setXmlContent] = useState<string>("");
  const [sourceSystem, setSourceSystem] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [lastUploadResult, setLastUploadResult] = useState<{
    results: XMLProcessingResult[];
    summary: XMLUploadSummary;
  } | null>(null);

  // Fetch XML templates
  const { data: templatesData, isLoading: templatesLoading } = useQuery({
    queryKey: ["/api/xml/templates"],
    retry: false,
  });

  // Fetch XML integration statistics
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/xml/integration/status"],
    retry: false,
  });

  // XML content upload mutation
  const xmlUploadMutation = useMutation({
    mutationFn: async (data: { xmlContent: string; sourceSystem: string; userId?: string }) => {
      const response = await apiRequest("POST", "/api/xml/shipments/upload", data);
      return await response.json();
    },
    onSuccess: (data) => {
      setLastUploadResult(data);
      setUploadProgress(100);
      toast({
        title: "XML Processing Complete",
        description: `Successfully processed ${data.summary.successful} shipments`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/shipments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/xml/integration/status"] });
    },
    onError: (error) => {
      toast({
        title: "XML Processing Failed",
        description: error.message,
        variant: "destructive",
      });
      setUploadProgress(0);
    },
  });

  // XML file upload mutation
  const xmlFileUploadMutation = useMutation({
    mutationFn: async (data: { file: File; sourceSystem: string; userId?: string }) => {
      const formData = new FormData();
      formData.append('xmlFile', data.file);
      formData.append('sourceSystem', data.sourceSystem);
      if (data.userId) {
        formData.append('userId', data.userId);
      }

      const response = await fetch("/api/xml/shipments/upload-file", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "File upload failed");
      }

      return await response.json();
    },
    onSuccess: (data) => {
      setLastUploadResult(data);
      setUploadProgress(100);
      toast({
        title: "XML File Processing Complete",
        description: `Successfully processed ${data.summary.successful} shipments from ${data.summary.fileName}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/shipments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/xml/integration/status"] });
    },
    onError: (error) => {
      toast({
        title: "XML File Processing Failed",
        description: error.message,
        variant: "destructive",
      });
      setUploadProgress(0);
    },
  });

  // File dropzone configuration
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'text/xml': ['.xml'],
      'application/xml': ['.xml'],
      'text/plain': ['.txt'],
    },
    maxFiles: 1,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0 && sourceSystem) {
        const file = acceptedFiles[0];
        setUploadProgress(10);
        xmlFileUploadMutation.mutate({ file, sourceSystem, userId: userId || undefined });
      } else if (!sourceSystem) {
        toast({
          title: "Source System Required",
          description: "Please select a source system before uploading files",
          variant: "destructive",
        });
      }
    },
  });

  // Handle XML content submission
  const handleXMLSubmit = () => {
    if (!xmlContent.trim()) {
      toast({
        title: "XML Content Required",
        description: "Please enter XML content to process",
        variant: "destructive",
      });
      return;
    }

    if (!sourceSystem) {
      toast({
        title: "Source System Required",
        description: "Please select a source system",
        variant: "destructive",
      });
      return;
    }

    setUploadProgress(10);
    xmlUploadMutation.mutate({ xmlContent, sourceSystem, userId: userId || undefined });
  };

  // Load template into editor
  const loadTemplate = (templateKey: string) => {
    if (templatesData?.templates?.[templateKey]) {
      setXmlContent(templatesData.templates[templateKey].example);
      setSelectedTemplate(templateKey);
    }
  };

  // Copy template to clipboard
  const copyTemplate = (templateKey: string) => {
    if (templatesData?.templates?.[templateKey]) {
      navigator.clipboard.writeText(templatesData.templates[templateKey].example);
      toast({
        title: "Template Copied",
        description: "XML template copied to clipboard",
      });
    }
  };

  const templates: XMLTemplates = templatesData?.templates || {};
  const stats: XMLIntegrationStats = statsData?.statistics || {
    total_xml_shipments: 0,
    recent_activity: [],
    status_distribution: {}
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">XML Integration Manager</h2>
          <p className="text-muted-foreground">
            Process shipment data from external systems using industry-standard XML formats
          </p>
        </div>
        <Badge variant="outline" className="px-3 py-1">
          <BarChart3 className="w-4 h-4 mr-2" />
          {stats.total_xml_shipments} XML Shipments
        </Badge>
      </div>

      <Tabs defaultValue="upload" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upload">Upload XML</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="status">Integration Status</TabsTrigger>
        </TabsList>

        {/* Upload Tab */}
        <TabsContent value="upload" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* File Upload Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileUp className="w-5 h-5 mr-2 text-blue-600" />
                  File Upload
                </CardTitle>
                <CardDescription>
                  Drag and drop XML files or click to browse
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sourceSystem">Source System</Label>
                  <Select value={sourceSystem} onValueChange={setSourceSystem}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select source system" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="maersk">Maersk Line</SelectItem>
                      <SelectItem value="msc">Mediterranean Shipping Company</SelectItem>
                      <SelectItem value="cosco">COSCO Shipping</SelectItem>
                      <SelectItem value="hapag-lloyd">Hapag-Lloyd</SelectItem>
                      <SelectItem value="oocl">OOCL</SelectItem>
                      <SelectItem value="evergreen">Evergreen Line</SelectItem>
                      <SelectItem value="freight-forwarder">Freight Forwarder</SelectItem>
                      <SelectItem value="customs-broker">Customs Broker</SelectItem>
                      <SelectItem value="terminal-operator">Terminal Operator</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="userId">User ID (Optional)</Label>
                  <Input
                    id="userId"
                    placeholder="Leave blank for system user"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                  />
                </div>

                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                    isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <input {...getInputProps()} />
                  <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  {isDragActive ? (
                    <p className="text-blue-600 font-medium">Drop the XML file here</p>
                  ) : (
                    <div>
                      <p className="text-gray-600 font-medium mb-2">
                        Drag & drop XML file here, or click to select
                      </p>
                      <p className="text-sm text-gray-500">
                        Supports .xml and .txt files
                      </p>
                    </div>
                  )}
                </div>

                {xmlFileUploadMutation.isPending && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Processing...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} className="w-full" />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Manual XML Entry Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="w-5 h-5 mr-2 text-green-600" />
                  Manual XML Entry
                </CardTitle>
                <CardDescription>
                  Paste or type XML content directly
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="xmlContent">XML Content</Label>
                  <Textarea
                    id="xmlContent"
                    placeholder="Paste your XML content here..."
                    value={xmlContent}
                    onChange={(e) => setXmlContent(e.target.value)}
                    rows={12}
                    className="font-mono text-sm"
                  />
                </div>

                <Button
                  onClick={handleXMLSubmit}
                  disabled={xmlUploadMutation.isPending || !xmlContent.trim() || !sourceSystem}
                  className="w-full"
                >
                  {xmlUploadMutation.isPending ? (
                    <>Processing XML...</>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Process XML Content
                    </>
                  )}
                </Button>

                {xmlUploadMutation.isPending && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Processing...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} className="w-full" />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Results Section */}
          {lastUploadResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
                  Processing Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {lastUploadResult.summary.successful}
                    </div>
                    <div className="text-sm text-muted-foreground">Successful</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {lastUploadResult.summary.failed}
                    </div>
                    <div className="text-sm text-muted-foreground">Failed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {lastUploadResult.summary.total}
                    </div>
                    <div className="text-sm text-muted-foreground">Total</div>
                  </div>
                </div>

                {lastUploadResult.results.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Detailed Results:</h4>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {lastUploadResult.results.map((result, index) => (
                        <div
                          key={index}
                          className={`flex items-center justify-between p-2 rounded text-sm ${
                            result.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                          }`}
                        >
                          <div className="flex items-center">
                            {result.success ? (
                              <CheckCircle className="w-4 h-4 mr-2" />
                            ) : (
                              <XCircle className="w-4 h-4 mr-2" />
                            )}
                            <span>
                              {result.success ? `Shipment: ${result.shipmentId}` : result.error}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-6">
          {templatesLoading ? (
            <div className="text-center py-8">Loading templates...</div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              {Object.entries(templates).map(([key, template]) => (
                <Card key={key}>
                  <CardHeader>
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <CardDescription>{template.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadTemplate(key)}
                        className="flex-1"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Load Template
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyTemplate(key)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
                          <DialogHeader>
                            <DialogTitle>{template.name}</DialogTitle>
                            <DialogDescription>{template.description}</DialogDescription>
                          </DialogHeader>
                          <div className="mt-4">
                            <pre className="bg-gray-50 p-4 rounded-lg text-sm overflow-auto">
                              <code>{template.example}</code>
                            </pre>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {templatesData?.supported_formats && (
            <Card>
              <CardHeader>
                <CardTitle>Supported XML Formats</CardTitle>
                <CardDescription>
                  The system automatically detects and processes these XML formats
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {templatesData.supported_formats.map((format: string, index: number) => (
                    <Badge key={index} variant="secondary" className="justify-center">
                      {format}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Status Tab */}
        <TabsContent value="status" className="space-y-6">
          {statsLoading ? (
            <div className="text-center py-8">Loading integration status...</div>
          ) : (
            <div className="grid gap-6">
              {/* Statistics Overview */}
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center">
                      <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="text-2xl font-bold">{stats.total_xml_shipments}</div>
                    <p className="text-xs text-muted-foreground">Total XML Shipments</p>
                  </CardContent>
                </Card>
                {Object.entries(stats.status_distribution).map(([status, count]) => (
                  <Card key={status}>
                    <CardContent className="p-6">
                      <div className="text-2xl font-bold">{count}</div>
                      <p className="text-xs text-muted-foreground capitalize">
                        {status.replace('_', ' ')}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent XML Integration Activity</CardTitle>
                  <CardDescription>
                    Latest shipments processed through XML integration
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {stats.recent_activity.length > 0 ? (
                    <div className="space-y-2">
                      {stats.recent_activity.map((activity, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div>
                            <div className="font-medium">{activity.shipment_id}</div>
                            <div className="text-sm text-muted-foreground">
                              {activity.transport_mode} • {activity.source} format
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge variant="outline">{activity.status}</Badge>
                            <div className="text-sm text-muted-foreground mt-1">
                              {new Date(activity.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No XML integration activity yet
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}