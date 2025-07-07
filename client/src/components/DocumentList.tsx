import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import { FileText, Eye, Download, Calendar, User, Hash } from "lucide-react";
import type { Document } from "@shared/schema";

interface DocumentListProps {
  shipmentId?: number;
  showAll?: boolean;
}

export default function DocumentList({ shipmentId, showAll = false }: DocumentListProps) {
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const { data: documents = [], isLoading } = useQuery({
    queryKey: shipmentId ? ["/api/shipments", shipmentId, "documents"] : ["/api/documents"],
    enabled: true,
  });

  const handleViewDocument = (document: Document) => {
    setSelectedDocument(document);
    setIsDetailOpen(true);
  };

  const handleDownload = async (document: Document) => {
    try {
      const response = await fetch(`/api/documents/${document.id}/download`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = document.fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const getCategoryBadgeColor = (category: string) => {
    switch (category) {
      case 'bill_of_lading':
        return 'bg-blue-100 text-blue-800';
      case 'commercial_invoice':
        return 'bg-green-100 text-green-800';
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
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-4 flex-1">
                  <FileText className="w-8 h-8 text-freight-blue" />
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className="font-medium text-gray-900">{document.fileName}</h4>
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
              {selectedDocument?.fileName}
            </DialogTitle>
          </DialogHeader>
          
          {selectedDocument && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-6">
                {/* Document Info */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Document Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-sm text-gray-600">Category:</span>
                        <Badge className={`ml-2 ${getCategoryBadgeColor(selectedDocument.category)}`}>
                          {formatCategoryName(selectedDocument.category)}
                        </Badge>
                      </div>
                      <div>
                        <span className="text-sm text-gray-600">Upload Date:</span>
                        <span className="ml-2 font-medium">
                          {new Date(selectedDocument.uploadedAt).toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-sm text-gray-600">File Size:</span>
                        <span className="ml-2 font-medium">
                          {selectedDocument.fileSize ? `${Math.round(selectedDocument.fileSize / 1024)} KB` : 'Unknown'}
                        </span>
                      </div>
                      <div>
                        <span className="text-sm text-gray-600">Processing Status:</span>
                        <Badge className="ml-2 bg-green-100 text-green-800">
                          {selectedDocument.processingStatus || 'Completed'}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Extracted Data */}
                {selectedDocument.extractedData && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Extracted Data</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <pre className="text-sm whitespace-pre-wrap text-gray-800 max-h-96 overflow-auto">
                          {typeof selectedDocument.extractedData === 'string' 
                            ? selectedDocument.extractedData 
                            : JSON.stringify(selectedDocument.extractedData, null, 2)
                          }
                        </pre>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* OCR Text (if available) */}
                {selectedDocument.ocrText && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">OCR Text Content</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <pre className="text-sm whitespace-pre-wrap text-gray-700 max-h-96 overflow-auto">
                          {selectedDocument.ocrText}
                        </pre>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end space-x-4 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => handleDownload(selectedDocument)}
                    className="text-freight-green border-freight-green hover:bg-freight-green hover:text-white"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Original
                  </Button>
                  <Button
                    onClick={() => setIsDetailOpen(false)}
                    className="bg-freight-blue hover:bg-freight-blue/90 text-white"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}