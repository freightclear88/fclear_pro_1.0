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
  Download
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

export default function XmlSources() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<XmlSource | null>(null);
  const [viewingJobs, setViewingJobs] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    authType: 'none' as const,
    authConfig: {},
    schedule: '0 */6 * * *', // Every 6 hours by default
  });
  const [testResult, setTestResult] = useState<any>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch XML sources
  const { data: sources = [], isLoading } = useQuery({
    queryKey: ['/api/xml-sources'],
  });

  // Fetch job history for specific source
  const { data: jobHistory = [] } = useQuery({
    queryKey: ['/api/xml-sources', viewingJobs, 'jobs'],
    enabled: !!viewingJobs,
  });

  // Create XML source mutation
  const createSourceMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/xml-sources', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/xml-sources'] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({
        title: "Success",
        description: "XML source created and scheduled successfully",
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

  // Update XML source mutation
  const updateSourceMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest('PUT', `/api/xml-sources/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/xml-sources'] });
      setEditingSource(null);
      toast({
        title: "Success",
        description: "XML source updated successfully",
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

  // Delete XML source mutation
  const deleteSourceMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/xml-sources/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/xml-sources'] });
      toast({
        title: "Success",
        description: "XML source deleted successfully",
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

  // Test connection mutation
  const testConnectionMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/xml-sources/test', data),
    onSuccess: (result) => {
      setTestResult(result);
    },
    onError: (error: any) => {
      setTestResult({
        success: false,
        message: error.message || "Test failed",
      });
    },
  });

  // Manual retrieve mutation
  const manualRetrieveMutation = useMutation({
    mutationFn: (id: number) => apiRequest('POST', `/api/xml-sources/${id}/retrieve`),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/xml-sources'] });
      toast({
        title: result.success ? "Success" : "Error",
        description: result.message,
        variant: result.success ? "default" : "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      url: '',
      authType: 'none',
      authConfig: {},
      schedule: '0 */6 * * *',
    });
    setTestResult(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingSource) {
      updateSourceMutation.mutate({ id: editingSource.id, ...formData });
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

  const handleTestConnection = () => {
    testConnectionMutation.mutate({
      url: formData.url,
      authType: formData.authType,
      authConfig: formData.authConfig,
    });
  };

  const toggleSourceStatus = async (source: XmlSource) => {
    updateSourceMutation.mutate({
      id: source.id,
      isActive: !source.isActive,
    });
  };

  const formatCronDescription = (cron: string) => {
    const parts = cron.split(' ');
    if (cron === '0 */6 * * *') return 'Every 6 hours';
    if (cron === '0 */12 * * *') return 'Every 12 hours';
    if (cron === '0 0 * * *') return 'Daily at midnight';
    if (cron === '0 */1 * * *') return 'Every hour';
    return `Custom: ${cron}`;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">XML Source Management</h1>
          <p className="text-muted-foreground">
            Configure and schedule automatic XML shipment retrieval from external sources
          </p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              Add XML Source
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingSource ? 'Edit XML Source' : 'Add New XML Source'}
              </DialogTitle>
              <DialogDescription>
                Configure an external XML source for automated shipment data retrieval
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Source Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Partner Portal XML Feed"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="schedule">Schedule (Cron)</Label>
                  <Select
                    value={formData.schedule}
                    onValueChange={(value) => setFormData({ ...formData, schedule: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0 */1 * * *">Every hour</SelectItem>
                      <SelectItem value="0 */6 * * *">Every 6 hours</SelectItem>
                      <SelectItem value="0 */12 * * *">Every 12 hours</SelectItem>
                      <SelectItem value="0 0 * * *">Daily at midnight</SelectItem>
                      <SelectItem value="0 0 * * 0">Weekly (Sunday)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="url">XML Source URL</Label>
                <Input
                  id="url"
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder="https://partner.example.com/api/shipments.xml"
                  required
                />
              </div>

              <div>
                <Label htmlFor="authType">Authentication Type</Label>
                <Select
                  value={formData.authType}
                  onValueChange={(value: any) => setFormData({ ...formData, authType: value, authConfig: {} })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Authentication</SelectItem>
                    <SelectItem value="basic">Basic Auth (Username/Password)</SelectItem>
                    <SelectItem value="bearer">Bearer Token</SelectItem>
                    <SelectItem value="apikey">API Key Header</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.authType === 'basic' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      value={formData.authConfig.username || ''}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        authConfig: { ...formData.authConfig, username: e.target.value }
                      })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.authConfig.password || ''}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        authConfig: { ...formData.authConfig, password: e.target.value }
                      })}
                      required
                    />
                  </div>
                </div>
              )}

              {formData.authType === 'bearer' && (
                <div>
                  <Label htmlFor="token">Bearer Token</Label>
                  <Input
                    id="token"
                    type="password"
                    value={formData.authConfig.token || ''}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      authConfig: { ...formData.authConfig, token: e.target.value }
                    })}
                    placeholder="your-bearer-token"
                    required
                  />
                </div>
              )}

              {formData.authType === 'apikey' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="headerName">Header Name</Label>
                    <Input
                      id="headerName"
                      value={formData.authConfig.headerName || ''}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        authConfig: { ...formData.authConfig, headerName: e.target.value }
                      })}
                      placeholder="X-API-Key"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="apiKey">API Key</Label>
                    <Input
                      id="apiKey"
                      type="password"
                      value={formData.authConfig.apiKey || ''}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        authConfig: { ...formData.authConfig, apiKey: e.target.value }
                      })}
                      placeholder="your-api-key"
                      required
                    />
                  </div>
                </div>
              )}

              {formData.url && (
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleTestConnection}
                    disabled={testConnectionMutation.isPending}
                  >
                    <TestTube className="mr-2 h-4 w-4" />
                    {testConnectionMutation.isPending ? 'Testing...' : 'Test Connection'}
                  </Button>
                  
                  {testResult && (
                    <div className={`mt-2 p-3 rounded border ${testResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                      <div className="flex items-center space-x-2">
                        {testResult.success ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                        <span className={testResult.success ? 'text-green-800' : 'text-red-800'}>
                          {testResult.message}
                        </span>
                      </div>
                      {testResult.preview && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-sm text-muted-foreground">
                            View XML Preview
                          </summary>
                          <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                            {testResult.preview}
                          </pre>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              )}

              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsCreateDialogOpen(false);
                    setEditingSource(null);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createSourceMutation.isPending || updateSourceMutation.isPending}
                >
                  {(createSourceMutation.isPending || updateSourceMutation.isPending) ? 'Saving...' : 'Save'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Sources List */}
      <div className="grid gap-4">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p>Loading XML sources...</p>
          </div>
        ) : sources.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <Download className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No XML sources configured</h3>
              <p className="text-muted-foreground mb-4">
                Set up automated XML retrieval from external shipping platforms
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Your First XML Source
              </Button>
            </CardContent>
          </Card>
        ) : (
          sources.map((source: XmlSource) => (
            <Card key={source.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center space-x-2">
                      <span>{source.name}</span>
                      <Badge variant={source.isActive ? "default" : "secondary"}>
                        {source.isActive ? "Active" : "Paused"}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="space-y-1">
                      <div>URL: {source.url}</div>
                      <div className="flex items-center space-x-4 text-xs">
                        <span className="flex items-center space-x-1">
                          <Clock className="h-3 w-3" />
                          <span>{formatCronDescription(source.schedule)}</span>
                        </span>
                        {source.lastRetrieved && (
                          <span className="flex items-center space-x-1">
                            <Calendar className="h-3 w-3" />
                            <span>Last: {new Date(source.lastRetrieved).toLocaleString()}</span>
                          </span>
                        )}
                      </div>
                    </CardDescription>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleSourceStatus(source)}
                      disabled={updateSourceMutation.isPending}
                    >
                      {source.isActive ? (
                        <>
                          <Pause className="mr-1 h-3 w-3" />
                          Pause
                        </>
                      ) : (
                        <>
                          <Play className="mr-1 h-3 w-3" />
                          Resume
                        </>
                      )}
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => manualRetrieveMutation.mutate(source.id)}
                      disabled={manualRetrieveMutation.isPending}
                    >
                      <Download className="mr-1 h-3 w-3" />
                      Retrieve Now
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setViewingJobs(source.id)}
                    >
                      <Eye className="mr-1 h-3 w-3" />
                      History
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(source)}
                    >
                      <Settings className="mr-1 h-3 w-3" />
                      Edit
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteSourceMutation.mutate(source.id)}
                      disabled={deleteSourceMutation.isPending}
                    >
                      <Trash2 className="mr-1 h-3 w-3" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))
        )}
      </div>

      {/* Job History Dialog */}
      <Dialog open={!!viewingJobs} onOpenChange={() => setViewingJobs(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Job Execution History</DialogTitle>
            <DialogDescription>
              Recent executions for this XML source
            </DialogDescription>
          </DialogHeader>
          
          <div className="max-h-96 overflow-y-auto">
            {jobHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No execution history yet
              </div>
            ) : (
              <div className="space-y-2">
                {jobHistory.map((job: XmlJob) => (
                  <div
                    key={job.id}
                    className={`p-3 rounded border ${job.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {job.success ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                        <span className="text-sm font-medium">
                          {new Date(job.executedAt).toLocaleString()}
                        </span>
                      </div>
                      <Badge variant={job.success ? "default" : "destructive"}>
                        {job.success ? "Success" : "Failed"}
                      </Badge>
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {job.message}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}