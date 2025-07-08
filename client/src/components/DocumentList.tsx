import { useQuery } from "@tanstack/react-query";
import { Document } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Eye, Download, Calendar, Hash } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface DocumentListProps {
  shipmentId?: number;
  showAll?: boolean;
}

export default function DocumentList({ shipmentId, showAll = false }: DocumentListProps) {
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const { toast } = useToast();

  const { data: documents = [], isLoading } = useQuery({
    queryKey: shipmentId ? ['/api/shipments', shipmentId, 'documents'] : ['/api/documents'],
    enabled: true,
  });

  const handleViewDocument = (document: Document) => {
    setSelectedDocument(document);
    setIsDetailOpen(true);
  };

  const handleDownload = async (document: Document) => {
    try {
      const response = await fetch(`/api/documents/${document.id}/download`);
      if (!response.ok) {
        throw new Error('Download failed');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = document.originalName || document.fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Download Complete",
        description: `Downloaded ${document.originalName || document.fileName}`,
      });
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Could not download the document",
        variant: "destructive",
      });
    }
  };

  const getCategoryBadgeColor = (category: string) => {
    switch (category) {
      case 'bill_of_lading':
        return 'bg-blue-100 text-blue-800';
      case 'commercial_invoice':
        return 'bg-green-100 text-green-800';
      case 'packing_list':
        return 'bg-yellow-100 text-yellow-800';
      case 'airway_bill':
        return 'bg-purple-100 text-purple-800';
      case 'arrival_notice':
        return 'bg-orange-100 text-orange-800';
      case 'isf_data_sheet':
        return 'bg-indigo-100 text-indigo-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatCategoryName = (category: string) => {
    return category.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-gray-500">Loading documents...</p>
        </CardContent>
      </Card>
    );
  }

  if (documents.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-gray-500">
            {shipmentId ? "No documents uploaded for this shipment" : "No documents found"}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileText className="w-5 h-5 mr-2 text-freight-blue" />
            {shipmentId ? "Shipment Documents" : "All Documents"} ({documents.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {documents.map((document: Document) => (
              <div
                key={document.id}
                className="border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center space-x-4 flex-1">
                    <FileText className="w-8 h-8 text-freight-blue" />
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <h4 className="font-medium text-gray-900">{document.originalName || document.fileName}</h4>
                        <Badge className={getCategoryBadgeColor(document.category)}>
                          {formatCategoryName(document.category)}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <span className="flex items-center">
                          <Calendar className="w-3 h-3 mr-1" />
                          {new Date(document.uploadedAt).toLocaleDateString()}
                        </span>
                        <span className="flex items-center">
                          <Hash className="w-3 h-3 mr-1" />
                          {document.fileSize ? `${Math.round(document.fileSize / 1024)} KB` : 'Size unknown'}
                        </span>
                        {document.processingStatus && (
                          <span className={`px-2 py-1 rounded text-xs ${
                            document.processingStatus === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {document.processingStatus}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleViewDocument(document)}
                      className="text-freight-blue border-freight-blue hover:bg-freight-blue hover:text-white"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View Data
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownload(document)}
                      className="text-freight-green border-freight-green hover:bg-freight-green hover:text-white"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </div>
                
                {(document.extractedData || document.ocrText) && (
                  <div className="px-4 pb-4 border-t bg-gray-50">
                    <h5 className="text-sm font-medium text-gray-700 mb-2 mt-2">Extracted Data:</h5>
                    {document.extractedData && typeof document.extractedData === 'object' ? (
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {Object.entries(document.extractedData).map(([key, value]) => (
                          <div key={key} className="flex justify-between">
                            <span className="font-medium text-gray-600">
                              {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:
                            </span>
                            <span className="text-gray-800 truncate ml-2">{String(value) || 'N/A'}</span>
                          </div>
                        ))}
                      </div>
                    ) : document.ocrText ? (
                      <div className="bg-white p-2 rounded border text-sm font-mono text-gray-600 max-h-20 overflow-y-auto">
                        {document.ocrText}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Document Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <FileText className="w-5 h-5 mr-2 text-freight-blue" />
              Document Details: {selectedDocument?.originalName || selectedDocument?.fileName}
            </DialogTitle>
          </DialogHeader>
          
          {selectedDocument && (
            <div className="space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <span className="text-sm font-medium text-gray-600">File Size:</span>
                  <p className="text-sm text-gray-900">{selectedDocument.fileSize ? `${Math.round(selectedDocument.fileSize / 1024)} KB` : 'Unknown'}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">Category:</span>
                  <p className="text-sm text-gray-900">{formatCategoryName(selectedDocument.category)}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">Upload Date:</span>
                  <p className="text-sm text-gray-900">{new Date(selectedDocument.uploadedAt).toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">Processing Status:</span>
                  <p className="text-sm text-gray-900">{selectedDocument.processingStatus || 'Pending'}</p>
                </div>
              </div>

              {selectedDocument.extractedData && (
                <div>
                  <h3 className="text-lg font-semibold mb-2">Extracted Data</h3>
                  <div className="bg-white border rounded-lg p-4">
                    {typeof selectedDocument.extractedData === 'object' ? (
                      <div className="space-y-2">
                        {Object.entries(selectedDocument.extractedData).map(([key, value]) => (
                          <div key={key} className="flex justify-between items-center py-1 border-b border-gray-100 last:border-b-0">
                            <span className="font-medium text-gray-600">
                              {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:
                            </span>
                            <span className="text-gray-900">{String(value) || 'N/A'}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <pre className="whitespace-pre-wrap text-sm font-mono">{selectedDocument.extractedData}</pre>
                    )}
                  </div>
                </div>
              )}

              {selectedDocument.ocrText && !selectedDocument.extractedData && (
                <div>
                  <h3 className="text-lg font-semibold mb-2">OCR Text</h3>
                  <div className="bg-white border rounded-lg p-4">
                    <pre className="whitespace-pre-wrap text-sm font-mono">{selectedDocument.ocrText}</pre>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  onClick={() => handleDownload(selectedDocument)}
                  className="bg-freight-green hover:bg-freight-green/90 text-white"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
                <Button
                  onClick={() => setIsDetailOpen(false)}
                  variant="outline"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}