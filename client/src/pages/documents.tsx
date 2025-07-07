import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import DocumentList from "@/components/DocumentList";
import DocumentUpload from "@/components/DocumentUpload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Upload, Plus } from "lucide-react";

export default function Documents() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-freight-blue mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading documents...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Documents</h1>
          <p className="text-gray-600 mt-1">
            Manage and view all your uploaded documents with extracted data
          </p>
        </div>
        <DocumentUpload
          trigger={
            <Button className="bg-freight-blue hover:bg-freight-blue/90 text-white">
              <Upload className="w-4 h-4 mr-2" />
              Upload Documents
            </Button>
          }
        />
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">
              All uploaded files
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processed Today</CardTitle>
            <Plus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">
              OCR completed
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processing</CardTitle>
            <Upload className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">
              Currently processing
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Document Categories */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileText className="w-5 h-5 mr-2 text-freight-blue" />
            Document Types
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="text-center p-4 border rounded-lg hover:bg-blue-50 transition-colors">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-medium text-sm">Bill of Lading</h3>
              <p className="text-xs text-gray-500">Ocean shipments</p>
            </div>
            
            <div className="text-center p-4 border rounded-lg hover:bg-purple-50 transition-colors">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                <FileText className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="font-medium text-sm">Airway Bill</h3>
              <p className="text-xs text-gray-500">Air shipments</p>
            </div>
            
            <div className="text-center p-4 border rounded-lg hover:bg-orange-50 transition-colors">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                <FileText className="w-6 h-6 text-orange-600" />
              </div>
              <h3 className="font-medium text-sm">Arrival Notice</h3>
              <p className="text-xs text-gray-500">Port notifications</p>
            </div>
            
            <div className="text-center p-4 border rounded-lg hover:bg-green-50 transition-colors">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                <FileText className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="font-medium text-sm">Commercial Invoice</h3>
              <p className="text-xs text-gray-500">Payment documents</p>
            </div>
            
            <div className="text-center p-4 border rounded-lg hover:bg-indigo-50 transition-colors">
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                <FileText className="w-6 h-6 text-indigo-600" />
              </div>
              <h3 className="font-medium text-sm">ISF Data Sheet</h3>
              <p className="text-xs text-gray-500">Security filing</p>
            </div>
            
            <div className="text-center p-4 border rounded-lg hover:bg-gray-50 transition-colors">
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                <FileText className="w-6 h-6 text-gray-600" />
              </div>
              <h3 className="font-medium text-sm">Other Documents</h3>
              <p className="text-xs text-gray-500">Miscellaneous</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* All Documents List */}
      <DocumentList showAll={true} />
    </div>
  );
}