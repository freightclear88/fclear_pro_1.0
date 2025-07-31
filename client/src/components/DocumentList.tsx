import { useQuery } from "@tanstack/react-query";
import { Document } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Eye, Download, Calendar, Hash, X, ExternalLink, Truck } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface DocumentListProps {
  shipmentId?: number;
  showAll?: boolean;
}

export default function DocumentList({ shipmentId, showAll = false }: DocumentListProps) {
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [viewingDocument, setViewingDocument] = useState<Document | null>(null);
  const [isPdfViewerOpen, setIsPdfViewerOpen] = useState(false);
  const { toast } = useToast();

  const { data: documents = [], isLoading } = useQuery<Document[]>({
    queryKey: shipmentId ? ['/api/shipments', shipmentId, 'documents'] : ['/api/documents'],
    enabled: true,
  });

  const handleViewDocument = (document: Document) => {
    // Show document detail dialog with extracted data
    setSelectedDocument(document);
    setIsDetailOpen(true);
  };

  const handleViewPdf = (document: Document) => {
    // Show PDF viewer dialog for in-app viewing
    setViewingDocument(document);
    setIsPdfViewerOpen(true);
  };

  const handleDownload = async (doc: Document) => {
    try {
      const response = await fetch(`/api/documents/${doc.id}/download`);
      if (!response.ok) {
        throw new Error('Download failed');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = doc.originalName || doc.fileName;
      window.document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      window.document.body.removeChild(a);
      
      toast({
        title: "Download Complete",
        description: `Downloaded ${doc.originalName || doc.fileName}`,
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
    if (!category) return 'bg-gray-100 text-gray-800';
    switch (category) {
      case 'bill_of_lading':
        return 'bg-blue-100 text-blue-800';
      case 'delivery_order':
        return 'bg-green-100 text-green-800';
      case 'commercial_invoice':
        return 'bg-green-100 text-green-800';
      case 'packing_list':
        return 'bg-yellow-100 text-yellow-800';
      case 'power_of_attorney':
        return 'bg-purple-100 text-purple-800';
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
    if (!category) return 'Unknown';
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
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center text-lg py-2">
            <FileText className="w-5 h-5 mr-3 text-freight-blue" />
            {shipmentId ? "Shipment Documents" : "All Documents"} ({documents.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {documents.map((doc: Document) => (
              <div
                key={doc.id}
                className="border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center space-x-4 flex-1">
                    <FileText className="w-8 h-8 text-freight-blue" />
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <h4 className="font-medium text-gray-900">{doc.originalName || doc.fileName}</h4>
                        <Badge className={getCategoryBadgeColor(doc.category)}>
                          {formatCategoryName(doc.category)}
                        </Badge>
                        {doc.subCategory && (
                          <Badge variant="outline" className={
                            doc.subCategory === 'last_mile' 
                              ? "bg-green-50 text-green-700 border-green-200 flex items-center gap-1"
                              : "bg-orange-50 text-orange-700 border-orange-200"
                          }>
                            {doc.subCategory === 'last_mile' && (
                              <Truck className="w-3 h-3" />
                            )}
                            {formatCategoryName(doc.subCategory)}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <span className="flex items-center">
                          <Calendar className="w-3 h-3 mr-1" />
                          {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : 'N/A'}
                        </span>
                        <span className="flex items-center">
                          <Hash className="w-3 h-3 mr-1" />
                          {doc.fileSize ? `${Math.round(doc.fileSize / 1024)} KB` : 'Size unknown'}
                        </span>
                        {doc.status && (
                          <span className={`px-2 py-1 rounded text-xs ${
                            doc.status === 'processed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {doc.status}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {/* In-app PDF/Image/Text viewing button */}
                    {(doc.fileType === 'application/pdf' || 
                      doc.fileType?.startsWith('image/') ||
                      doc.fileType === 'text/plain') && (
                      <Button
                        size="sm"
                        onClick={() => handleViewPdf(doc)}
                        className="btn-outline-secondary"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View {doc.fileType === 'application/pdf' ? 'PDF' : 'File'}
                      </Button>
                    )}
                    
                    {/* Data viewing button */}
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedDocument(doc);
                        setIsDetailOpen(true);
                      }}
                      className="btn-outline-accent"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      View Data
                    </Button>
                    
                    <Button
                      size="sm"
                      onClick={() => handleDownload(doc)}
                      className="btn-outline-primary"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  </div>
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
                  <p className="text-sm text-gray-900">{selectedDocument.createdAt ? new Date(selectedDocument.createdAt).toLocaleString() : 'N/A'}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">Status:</span>
                  <p className="text-sm text-gray-900">{selectedDocument.status || 'Pending'}</p>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">Document Information</h3>
                <div className="bg-white border rounded-lg p-4 text-sm text-gray-600">
                  This document has been processed and its data has been extracted into the associated shipment.
                  View the shipment details to see the extracted information.
                </div>
              </div>

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

      {/* PDF Viewer Dialog */}
      <Dialog open={isPdfViewerOpen} onOpenChange={setIsPdfViewerOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] w-[90vw] h-[90vh]">
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center">
                <FileText className="w-5 h-5 mr-2 text-freight-blue" />
                {viewingDocument?.originalName || viewingDocument?.fileName}
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  size="sm"
                  onClick={() => window.open(`/api/documents/${viewingDocument?.id}/view`, '_blank')}
                  className="btn-outline-primary"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open in New Tab
                </Button>
                <Button
                  size="sm"
                  onClick={() => viewingDocument && handleDownload(viewingDocument)}
                  className="btn-outline-primary"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsPdfViewerOpen(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden">
            {viewingDocument && (
              <div className="w-full h-full bg-gray-100 rounded border">
                {viewingDocument.fileType === 'application/pdf' ? (
                  <iframe
                    src={`/api/documents/${viewingDocument.id}/view`}
                    className="w-full h-full border-0 rounded"
                    title={viewingDocument.originalName || viewingDocument.fileName}
                  />
                ) : viewingDocument.fileType?.startsWith('image/') ? (
                  <div className="w-full h-full flex items-center justify-center p-4">
                    <img
                      src={`/api/documents/${viewingDocument.id}/view`}
                      alt={viewingDocument.originalName || viewingDocument.fileName}
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                ) : (
                  <iframe
                    src={`/api/documents/${viewingDocument.id}/view`}
                    className="w-full h-full border-0 rounded bg-white"
                    title={viewingDocument.originalName || viewingDocument.fileName}
                  />
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}