import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { 
  FileUp, 
  FileText, 
  Ship, 
  Plane, 
  CheckCircle, 
  AlertCircle, 
  X, 
  Info,
  Upload,
  Clock
} from "lucide-react";

interface IsfDocumentUploadProps {
  onFilesChange: (files: File[], documentTypes?: string[]) => void;
  isScanning?: boolean;
  processedDocuments?: Array<{
    fileName: string;
    extractedFields: number;
    error?: string;
  }>;
}

const ISF_DOCUMENT_TYPES = [
  { 
    value: "bill_of_lading", 
    label: "Bill of Lading (Ocean B/L)", 
    icon: Ship, 
    description: "Ocean Bill of Lading with vessel, container, and port information",
    priority: 1,
    examples: ["Master Bill of Lading", "House Bill of Lading", "Express Release B/L"]
  },
  { 
    value: "isf_info_sheet", 
    label: "ISF Information Sheet", 
    icon: FileText, 
    description: "ISF 10+2 data sheet with importer, consignee, and HTS information",
    priority: 1,
    examples: ["ISF Worksheet", "10+2 Data Sheet", "Importer Security Filing Form"]
  },
  { 
    value: "commercial_invoice", 
    label: "Commercial Invoice", 
    icon: FileText, 
    description: "Invoice with seller/buyer details, commodity description, and values",
    priority: 2,
    examples: ["Proforma Invoice", "Final Invoice", "Customs Invoice"]
  },
  { 
    value: "packing_list", 
    label: "Packing List", 
    icon: FileText, 
    description: "Detailed packing information with quantities and descriptions",
    priority: 3,
    examples: ["Detailed Packing List", "Container Load Plan", "Cargo Manifest"]
  },
  { 
    value: "arrival_notice", 
    label: "Arrival Notice", 
    icon: Ship, 
    description: "Steamship line notice with vessel and arrival information",
    priority: 2,
    examples: ["Vessel Arrival Notice", "Cargo Arrival Notification", "Discharge Notice"]
  },
  { 
    value: "other_shipping_doc", 
    label: "Other Shipping Document", 
    icon: FileText, 
    description: "Any other relevant shipping or customs documentation",
    priority: 4,
    examples: ["Certificate of Origin", "Insurance Certificate", "Inspection Certificate"]
  },
];

interface FileWithType {
  name: string;
  size: number;
  type: string;
  lastModified: number;
  documentType?: string;
  originalFile: File;
}

export default function IsfDocumentUpload({ 
  onFilesChange, 
  isScanning = false, 
  processedDocuments = [] 
}: IsfDocumentUploadProps) {
  const [uploadedFiles, setUploadedFiles] = useState<FileWithType[]>([]);
  const [showInstructions, setShowInstructions] = useState(true);
  const { toast } = useToast();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length + uploadedFiles.length > 10) {
      toast({
        title: "Too many files",
        description: "Maximum 10 files allowed for ISF document upload",
        variant: "destructive",
      });
      return;
    }

    const filesWithType: FileWithType[] = acceptedFiles.map(file => ({
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
      documentType: "",
      originalFile: file
    }));

    setUploadedFiles(prev => [...prev, ...filesWithType]);
  }, [uploadedFiles, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png']
    },
    maxFiles: 10,
    disabled: isScanning
  });

  const updateFileDocumentType = (fileIndex: number, documentType: string) => {
    setUploadedFiles(prev => {
      const updated = [...prev];
      updated[fileIndex] = { ...updated[fileIndex], documentType };
      return updated;
    });
  };

  const removeFile = (fileIndex: number) => {
    setUploadedFiles(prev => prev.filter((_, index) => index !== fileIndex));
  };

  const handleUpload = () => {
    const filesWithoutTypes = uploadedFiles.filter(f => !f.documentType);
    if (filesWithoutTypes.length > 0) {
      toast({
        title: "Document types required",
        description: "Please specify the document type for all uploaded files",
        variant: "destructive",
      });
      return;
    }

    const files = uploadedFiles.map(f => f.originalFile);
    const documentTypes = uploadedFiles.map(f => f.documentType).filter(Boolean) as string[];
    
    // Pass both files and document types to the parent handler
    onFilesChange(files, documentTypes);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getPriorityBadge = (priority: number) => {
    switch (priority) {
      case 1:
        return <Badge variant="default" className="text-xs">Priority</Badge>;
      case 2:
        return <Badge variant="secondary" className="text-xs">Recommended</Badge>;
      case 3:
        return <Badge variant="secondary" className="text-xs">Helpful</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">Optional</Badge>;
    }
  };

  return (
    <Card className="border-2 border-dashed border-teal-200 bg-gradient-to-br from-teal-50 to-cyan-50">
      <CardHeader>
        <CardTitle className="flex items-center text-teal-700">
          <FileUp className="w-5 h-5 mr-2" />
          Upload ISF Documents
        </CardTitle>
        <CardDescription>
          Upload shipping documents for comprehensive ISF 10+2 data extraction. Most important: Bill of Lading and ISF Information Sheet.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Instructions Panel */}
        {showInstructions && (
          <Alert className="bg-blue-50 border-blue-200">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              <div className="space-y-2">
                <p className="font-medium">Document Upload Guide:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  {ISF_DOCUMENT_TYPES.slice(0, 4).map((docType) => (
                    <div key={docType.value} className="flex items-start space-x-2">
                      <docType.icon className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-600" />
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{docType.label}</span>
                          {getPriorityBadge(docType.priority)}
                        </div>
                        <p className="text-xs text-blue-700 mt-1">{docType.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowInstructions(false)}
                  className="text-blue-600 hover:text-blue-800 p-0 h-auto"
                >
                  Hide instructions
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {!showInstructions && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowInstructions(true)}
            className="text-teal-600 border-teal-200 hover:bg-teal-50"
          >
            <Info className="w-4 h-4 mr-2" />
            Show upload guide
          </Button>
        )}

        {/* File Drop Zone */}
        <div 
          {...getRootProps()} 
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            isDragActive 
              ? "border-teal-400 bg-teal-100" 
              : "border-teal-300 bg-teal-50 hover:bg-teal-100"
          } ${isScanning ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <input {...getInputProps()} />
          {isScanning ? (
            <div className="flex flex-col items-center space-y-4">
              {/* Gradient Wave Animation */}
              <div className="relative w-32 h-16 overflow-hidden rounded-lg">
                <div className="absolute inset-0 bg-gradient-to-r from-green-400 via-teal-500 to-blue-500 wave-animation"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-green-300 via-teal-400 to-blue-400 wave-animation wave-delay-1"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-green-200 via-teal-300 to-blue-300 wave-animation wave-delay-2"></div>
              </div>
              <p className="text-sm text-teal-600 font-medium">Processing documents...</p>
              <p className="text-xs text-gray-500">Extracting ISF data with AI</p>
            </div>
          ) : uploadedFiles.length > 0 ? (
            <>
              <CheckCircle className="w-8 h-8 mb-2 text-green-500 mx-auto" />
              <p className="text-sm text-gray-700 font-medium">{uploadedFiles.length} document(s) uploaded</p>
              <p className="text-xs text-gray-500">Specify document types below</p>
            </>
          ) : (
            <>
              <Upload className="w-8 h-8 mb-2 text-gray-400 mx-auto" />
              <p className="mb-2 text-sm text-gray-500">
                {isDragActive ? (
                  "Drop files here..."
                ) : (
                  <>
                    <span className="font-semibold">Click to upload</span> or drag and drop ISF documents
                  </>
                )}
              </p>
              <p className="text-xs text-gray-500">PDF, Excel, Word, JPG, PNG (max 10 files, 10MB each)</p>
            </>
          )}
        </div>

        {/* Uploaded Files List */}
        {uploadedFiles.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-700">Specify Document Types ({uploadedFiles.length}/10)</h4>
              <Button 
                onClick={handleUpload}
                disabled={uploadedFiles.some(f => !f.documentType) || isScanning}
                className="bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600"
                size="sm"
              >
                Process Documents
              </Button>
            </div>
            
            <div className="space-y-2">
              {uploadedFiles.map((file, index) => (
                <div key={`${file.name}-${index}`} className="flex items-center space-x-3 p-3 bg-white rounded-lg border">
                  <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                    <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                  </div>
                  <div className="flex-shrink-0 w-64">
                    <Select
                      value={file.documentType}
                      onValueChange={(value) => updateFileDocumentType(index, value)}
                    >
                      <SelectTrigger className="h-8 text-xs w-full">
                        <SelectValue placeholder="Select document type" />
                      </SelectTrigger>
                      <SelectContent>
                        {ISF_DOCUMENT_TYPES.map((docType) => (
                          <SelectItem key={docType.value} value={docType.value}>
                            <div className="flex items-center space-x-2">
                              <docType.icon className="w-3 h-3" />
                              <span>{docType.label}</span>
                              {getPriorityBadge(docType.priority)}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(index)}
                    className="h-8 w-8 p-0 text-gray-400 hover:text-red-500"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Document Processing Summary */}
        {processedDocuments.length > 0 && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Document Processing Results:</h4>
            <div className="space-y-1">
              {processedDocuments.map((doc, index) => (
                <div key={index} className="flex items-center justify-between text-xs">
                  <span className="text-gray-600 truncate flex-1">{doc.fileName}</span>
                  <div className="flex items-center space-x-2 flex-shrink-0">
                    <Badge variant={doc.error ? "destructive" : "secondary"} className="text-xs">
                      {doc.error ? "Error" : `${doc.extractedFields} fields`}
                    </Badge>
                    {doc.error ? (
                      <AlertCircle className="w-3 h-3 text-red-500" />
                    ) : (
                      <CheckCircle className="w-3 h-3 text-green-500" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}


      </CardContent>
    </Card>
  );
}