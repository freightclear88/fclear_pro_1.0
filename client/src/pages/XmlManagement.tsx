import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { 
  Plus, 
  Settings, 
  Play, 
  Pause, 
  Trash2, 
  TestTube, 
  Clock, 
  CheckCircle, 
  XCircle,
  Eye,
  Calendar,
  Download,
  Upload,
  FileText,
  Database,
  ExternalLink,
  Loader2
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

interface XmlSource {
  id: number;
  name: string;
  url: string;
  authType: 'none' | 'basic' | 'bearer' | 'apikey';
  authConfig?: any;
  schedule: string;
  isActive: boolean;
  lastRetrieved?: string;
  userId: number;
  createdAt: string;
  updatedAt: string;
}

interface XmlJob {
  id: number;
  sourceId: number;
  executedAt: string;
  success: boolean;
  message: string;
  details?: any;
}

export default function XmlManagement() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<XmlSource | null>(null);
  const [viewingJobs, setViewingJobs] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    authType: 'none' as 'none' | 'basic' | 'bearer' | 'apikey',
    authConfig: {},
    schedule: '0 */6 * * *', // Every 6 hours by default
  });
  const [testResult, setTestResult] = useState<any>(null);
  
  // XML Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // XML Sources queries and mutations
  const { data: sources = [], isLoading: sourcesLoading } = useQuery<XmlSource[]>({
    queryKey: ['/api/xml-sources'],
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['/api/xml-sources/jobs', viewingJobs],
    enabled: !!viewingJobs,
  });

  const createSourceMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/xml-sources', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/xml-sources'] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({
        title: "XML Source Created",
        description: "Source has been added and scheduled successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create XML source",
        variant: "destructive",
      });
    },
  });

  const updateSourceMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => 
      apiRequest('PUT', `/api/xml-sources/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/xml-sources'] });
      setEditingSource(null);
      resetForm();
      toast({
        title: "XML Source Updated",
        description: "Source has been updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update XML source",
        variant: "destructive",
      });
    },
  });

  const deleteSourceMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/xml-sources/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/xml-sources'] });
      toast({
        title: "XML Source Deleted",
        description: "Source has been removed successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete XML source",
        variant: "destructive",
      });
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/xml-sources/test', data),
    onSuccess: (result: any) => {
      setTestResult(result);
      toast({
        title: result.success ? "Connection Successful" : "Connection Failed",
        description: result.message,
        variant: result.success ? "default" : "destructive",
      });
    },
    onError: (error: any) => {
      setTestResult({ success: false, message: error.message });
      toast({
        title: "Test Failed",
        description: error.message || "Failed to test connection",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      url: '',
      authType: 'none' as 'none' | 'basic' | 'bearer' | 'apikey',
      authConfig: {},
      schedule: '0 */6 * * *',
    });
    setTestResult(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSource) {
      updateSourceMutation.mutate({ id: editingSource.id, data: formData });
    } else {
      createSourceMutation.mutate(formData);
    }
  };

  const handleEdit = (source: XmlSource) => {
    setEditingSource(source);
    setFormData({
      name: source.name,
      url: source.url,
      authType: source.authType,
      authConfig: source.authConfig || {},
      schedule: source.schedule,
    });
    setIsCreateDialogOpen(true);
  };

  const getScheduleDescription = (schedule: string) => {
    const scheduleMap: Record<string, string> = {
      '0 * * * *': 'Every hour',
      '0 */6 * * *': 'Every 6 hours',
      '0 */12 * * *': 'Every 12 hours',
      '0 0 * * *': 'Daily at midnight',
      '0 0 * * 1': 'Weekly on Monday',
      '0 0 1 * *': 'Monthly on 1st',
    };
    return scheduleMap[schedule] || 'Custom schedule';
  };

  // XML Upload handlers
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === 'application/xml' || file.type === 'text/xml' || file.name.endsWith('.xml')) {
        setSelectedFile(file);
        setUploadResult(null);
      } else {
        toast({
          title: "Invalid File Type",
          description: "Please select an XML file",
          variant: "destructive",
        });
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast({
        title: "No File Selected",
        description: "Please select an XML file to upload",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('xmlFile', selectedFile);

      const response = await fetch('/api/shipments/xml/process', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Upload failed');
      }

      const result = await response.json();
      setUploadResult(result);

      toast({
        title: "XML Processing Complete",
        description: `Successfully processed ${selectedFile.name}`,
      });

    } catch (error: any) {
      console.error('XML upload error:', error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to process XML file",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">XML Management</h1>
          <p className="text-muted-foreground">
            Upload XML files manually or set up automated retrieval from external sources
          </p>
        </div>
      </div>

      <Tabs defaultValue="upload" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload">Manual Upload</TabsTrigger>
          <TabsTrigger value="sources">Automated Sources</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Manual XML Upload
              </CardTitle>
              <CardDescription>
                Upload XML shipment files for immediate processing and data extraction
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="xml-file">Select XML File</Label>
                  <Input
                    id="xml-file"
                    type="file"
                    accept=".xml,application/xml,text/xml"
                    onChange={handleFileSelect}
                    className="mt-1"
                  />
                  {selectedFile && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </p>
                  )}
                </div>

                <Button 
                  onClick={handleUpload} 
                  disabled={!selectedFile || isUploading}
                  className="w-full"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing XML...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload and Process XML
                    </>
                  )}
                </Button>
              </div>

              {uploadResult && (
                <Card className="border-green-200 bg-green-50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      Processing Complete
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-2 text-sm">
                      <div><strong>Shipment ID:</strong> {uploadResult.shipmentId}</div>
                      <div><strong>Message:</strong> {uploadResult.message}</div>
                    </div>
                    
                    {uploadResult.shipment && (
                      <div className="space-y-2">
                        <h4 className="font-medium">Extracted Data:</h4>
                        <div className="bg-white p-4 rounded border text-xs">
                          <div className="grid grid-cols-2 gap-4">
                            {uploadResult.shipment.shipment && (
                              <div>
                                <strong>Shipment:</strong> {uploadResult.shipment.shipment.reference || 'N/A'}
                              </div>
                            )}
                            {uploadResult.shipment.parties?.length > 0 && (
                              <div>
                                <strong>Parties:</strong> {uploadResult.shipment.parties.length} found
                              </div>
                            )}
                            {uploadResult.shipment.containers?.length > 0 && (
                              <div>
                                <strong>Containers:</strong> {uploadResult.shipment.containers.length} found
                              </div>
                            )}
                            {uploadResult.shipment.locations?.length > 0 && (
                              <div>
                                <strong>Locations:</strong> {uploadResult.shipment.locations.length} found
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          <Button size="sm" asChild>
                            <a href={`/shipments/xml/${uploadResult.shipmentId}`}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </a>
                          </Button>
                          <Button size="sm" variant="outline" asChild>
                            <a href={`/api/shipments/xml/${uploadResult.shipmentId}/export/xml`}>
                              <Download className="mr-2 h-4 w-4" />
                              Export XML
                            </a>
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sources" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Automated XML Sources</h2>
              <p className="text-muted-foreground">
                Configure external sources for automated XML retrieval
              </p>
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => { resetForm(); setEditingSource(null); }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Source
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingSource ? 'Edit XML Source' : 'Add XML Source'}
                  </DialogTitle>
                  <DialogDescription>
                    Configure an external XML source for automated retrieval
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Source Name</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g., Main EDI Provider"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="schedule">Schedule</Label>
                      <Select
                        value={formData.schedule}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, schedule: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0 * * * *">Every hour</SelectItem>
                          <SelectItem value="0 */6 * * *">Every 6 hours</SelectItem>
                          <SelectItem value="0 */12 * * *">Every 12 hours</SelectItem>
                          <SelectItem value="0 0 * * *">Daily at midnight</SelectItem>
                          <SelectItem value="0 0 * * 1">Weekly on Monday</SelectItem>
                          <SelectItem value="0 0 1 * *">Monthly on 1st</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="url">URL</Label>
                    <Input
                      id="url"
                      type="url"
                      value={formData.url}
                      onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                      placeholder="https://api.example.com/xml/shipments"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="authType">Authentication Type</Label>
                    <Select
                      value={formData.authType}
                      onValueChange={(value: any) => setFormData(prev => ({ ...prev, authType: value, authConfig: {} }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Authentication</SelectItem>
                        <SelectItem value="basic">Basic Auth</SelectItem>
                        <SelectItem value="bearer">Bearer Token</SelectItem>
                        <SelectItem value="apikey">API Key</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {(formData.authType as string) === 'basic' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="username">Username</Label>
                        <Input
                          id="username"
                          value={(formData.authConfig as any)?.username || ''}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            authConfig: { ...prev.authConfig, username: e.target.value }
                          }))}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="password">Password</Label>
                        <Input
                          id="password"
                          type="password"
                          value={(formData.authConfig as any)?.password || ''}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            authConfig: { ...prev.authConfig, password: e.target.value }
                          }))}
                          required
                        />
                      </div>
                    </div>
                  )}

                  {(formData.authType as string) === 'bearer' && (
                    <div>
                      <Label htmlFor="token">Bearer Token</Label>
                      <Input
                        id="token"
                        type="password"
                        value={(formData.authConfig as any)?.token || ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          authConfig: { ...prev.authConfig, token: e.target.value }
                        }))}
                        required
                      />
                    </div>
                  )}

                  {(formData.authType as string) === 'apikey' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="headerName">Header Name</Label>
                        <Input
                          id="headerName"
                          value={(formData.authConfig as any)?.headerName || ''}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            authConfig: { ...prev.authConfig, headerName: e.target.value }
                          }))}
                          placeholder="X-API-Key"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="apiKey">API Key</Label>
                        <Input
                          id="apiKey"
                          type="password"
                          value={(formData.authConfig as any)?.apiKey || ''}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            authConfig: { ...prev.authConfig, apiKey: e.target.value }
                          }))}
                          required
                        />
                      </div>
                    </div>
                  )}

                  {testResult && (
                    <div className={`p-3 rounded border ${testResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                      <div className="flex items-center gap-2">
                        {testResult.success ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                        <span className="text-sm font-medium">
                          {testResult.success ? 'Connection Successful' : 'Connection Failed'}
                        </span>
                      </div>
                      <p className="text-sm mt-1">{testResult.message}</p>
                    </div>
                  )}

                  <DialogFooter className="gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => testConnectionMutation.mutate(formData)}
                      disabled={!formData.url || testConnectionMutation.isPending}
                    >
                      {testConnectionMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <TestTube className="mr-2 h-4 w-4" />
                      )}
                      Test Connection
                    </Button>
                    <Button
                      type="submit"
                      disabled={createSourceMutation.isPending || updateSourceMutation.isPending}
                    >
                      {(createSourceMutation.isPending || updateSourceMutation.isPending) ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : editingSource ? (
                        'Update Source'
                      ) : (
                        'Create Source'
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {sourcesLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : sources.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No XML Sources Configured</h3>
                <p className="text-muted-foreground mb-4">
                  Set up automated XML retrieval from external sources
                </p>
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Your First Source
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {sources.map((source: XmlSource) => (
                <Card key={source.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {source.name}
                          <Badge variant={source.isActive ? "default" : "secondary"}>
                            {source.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </CardTitle>
                        <CardDescription className="flex items-center gap-4 mt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {getScheduleDescription(source.schedule)}
                          </span>
                          {source.lastRetrieved && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Last: {new Date(source.lastRetrieved).toLocaleDateString()}
                            </span>
                          )}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setViewingJobs(source.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(source)}
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteSourceMutation.mutate(source.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <ExternalLink className="h-3 w-3" />
                      <span className="truncate">{source.url}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}