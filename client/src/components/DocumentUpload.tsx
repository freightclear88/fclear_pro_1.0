import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { FileUp, FileText, Ship, Plane, Truck, Package, Scale, Receipt } from "lucide-react";

interface DocumentUploadProps {
  shipmentId?: number;
  trigger?: React.ReactNode;
  onShipmentCreated?: (shipment: any) => void;
}

const DOCUMENT_CATEGORIES = [
  { value: "bill_of_lading", label: "Bill of Lading", icon: Ship, creates: "ocean" },
  { value: "arrival_notice", label: "Arrival Notice", icon: Ship, creates: "ocean" },
  { value: "commercial_invoice", label: "Commercial Invoice", icon: FileText, creates: null },
  { value: "packing_list", label: "Packing List", icon: Package, creates: null },
  { value: "power_of_attorney", label: "Power of Attorney", icon: Scale, creates: null },
  { value: "airway_bill", label: "Airway Bill", icon: Plane, creates: "air" },
  { value: "isf_data_sheet", label: "ISF Data Sheet", icon: Ship, creates: "ocean" },
  { value: "delivery_order", label: "Delivery Order", icon: Truck, creates: "last_mile" },
  { value: "shipping_invoice", label: "Shipping Invoice", icon: Receipt, creates: null },
  { value: "other", label: "Other Document", icon: FileText, creates: null },
];

const SUB_CATEGORIES = [
  { value: "last_mile", label: "Last Mile" },
  { value: "customs_clearance", label: "Customs Clearance" },
  { value: "port_delivery", label: "Port Delivery" },
  { value: "warehouse_receipt", label: "Warehouse Receipt" },
  { value: "final_delivery", label: "Final Delivery" },
];

interface FileWithType extends File {
  documentType?: string;
  subCategory?: string;
}

export default function DocumentUpload({ shipmentId, trigger, onShipmentCreated }: DocumentUploadProps) {
  const [open, setOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>("");
  const [uploadedFiles, setUploadedFiles] = useState<FileWithType[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const filesWithType: FileWithType[] = acceptedFiles.map(file => ({
      ...file,
      documentType: "", // Will be set by user
      subCategory: ""
    }));
    setUploadedFiles(filesWithType);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg', '.gif'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    multiple: true,
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ files }: { files: FileWithType[] }) => {
      const formData = new FormData();
      
      files.forEach((file, index) => {
        formData.append('documents', file);
        formData.append(`documentTypes`, file.documentType || 'other');
        if (file.subCategory) {
          formData.append(`subCategories`, file.subCategory);
        } else {
          formData.append(`subCategories`, '');
        }
      });
      
      if (shipmentId) {
        formData.append('shipmentId', shipmentId.toString());
      }

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Upload Successful",
        description: data.shipment 
          ? `Documents uploaded and new ${data.shipment.transportMode} shipment created: ${data.shipment.shipmentId}`
          : `${uploadedFiles.length} document(s) uploaded successfully`,
      });
      
      if (data.shipment && onShipmentCreated) {
        onShipmentCreated(data.shipment);
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/shipments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      if (shipmentId) {
        queryClient.invalidateQueries({ queryKey: ["/api/documents/shipment", shipmentId] });
      }
      
      setUploadedFiles([]);
      setSelectedCategory("");
      setSelectedSubCategory("");
      setOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateFileType = (fileIndex: number, documentType: string) => {
    setUploadedFiles(prev => prev.map((file, index) => 
      index === fileIndex ? { ...file, documentType } : file
    ));
  };

  const updateFileSubCategory = (fileIndex: number, subCategory: string) => {
    setUploadedFiles(prev => prev.map((file, index) => 
      index === fileIndex ? { ...file, subCategory } : file
    ));
  };

  const removeFile = (fileIndex: number) => {
    setUploadedFiles(prev => prev.filter((_, index) => index !== fileIndex));
  };

  const handleUpload = () => {
    if (uploadedFiles.length === 0) {
      toast({
        title: "No Files Selected",
        description: "Please select files to upload",
        variant: "destructive",
      });
      return;
    }

    // Check if all files have document types assigned
    const filesWithoutType = uploadedFiles.filter(file => !file.documentType);
    if (filesWithoutType.length > 0) {
      toast({
        title: "Document Types Required",
        description: "Please select a document type for all uploaded files",
        variant: "destructive",
      });
      return;
    }

    // Auto-assign "last_mile" subcategory for delivery orders if not set
    const filesWithSubCategories = uploadedFiles.map(file => {
      if (file.documentType === "delivery_order" && !file.subCategory) {
        return { ...file, subCategory: "last_mile" };
      }
      return file;
    });

    uploadMutation.mutate({ files: filesWithSubCategories });
  };

  const selectedCategoryData = DOCUMENT_CATEGORIES.find(cat => cat.value === selectedCategory);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="btn-primary">
            <FileUp className="w-4 h-4 mr-2" />
            Upload Documents
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {shipmentId ? `Add Documents to Shipment` : "Upload Documents & Create Shipment"}
          </DialogTitle>
          {!shipmentId && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-2">
              <div className="flex items-start space-x-3">
                <FileUp className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900">Multi-Document Processing</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    Upload multiple documents (Bill of Lading, Commercial Invoice, Packing List, etc.) 
                    and our AI will automatically extract and populate all relevant shipment data from each document.
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogHeader>
        
        <div className="space-y-6">

          {/* File Upload Area */}
          <div className="space-y-4">
            <Label>Upload Files (up to 10 documents)</Label>
            <Card>
              <CardContent className="p-6">
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                    isDragActive 
                      ? 'border-freight-orange bg-freight-orange/10' 
                      : 'border-gray-300 hover:border-freight-orange hover:bg-freight-orange/5'
                  }`}
                >
                  <input {...getInputProps()} />
                  <FileUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <div className="space-y-2">
                    <p className="text-lg font-medium text-gray-700">
                      {isDragActive ? "Drop files here..." : "Drag & drop files here"}
                    </p>
                    <p className="text-sm text-gray-500">
                      or click to select files
                    </p>
                    <p className="text-xs text-gray-400">
                      Supports PDF, DOC, DOCX, and image files • Upload multiple documents for comprehensive data extraction
                    </p>
                  </div>
                </div>
                
                {uploadedFiles.length > 0 && (
                  <div className="mt-6">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                      <h4 className="font-semibold text-blue-900 mb-2">
                        Files Selected ({uploadedFiles.length})
                      </h4>
                      <div className="space-y-1">
                        {uploadedFiles.map((file, index) => (
                          <div key={index} className="flex items-center space-x-2 text-sm">
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                              {index + 1}
                            </span>
                            <span className="text-blue-800 font-medium">{file.name}</span>
                            <span className="text-blue-600">
                              ({(file.size / 1024 / 1024).toFixed(1)} MB)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <h4 className="font-medium text-gray-700 mb-4">
                      Select Document Type for Each File
                    </h4>
                    <div className="space-y-4">
                      {uploadedFiles.map((file, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-4 bg-white">
                          <div className="flex items-start space-x-3">
                            <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-bold mt-1">
                              {index + 1}
                            </div>
                            <div className="flex-1 space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <p className="text-base font-semibold text-gray-900 mb-1">{file.name}</p>
                                  <p className="text-sm text-gray-600">
                                    Size: {(file.size / 1024 / 1024).toFixed(1)} MB
                                  </p>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeFile(index)}
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                >
                                  ×
                                </Button>
                              </div>
                              
                              <div className="bg-gray-50 p-3 rounded-lg mb-3">
                                <p className="text-sm font-medium text-gray-700 mb-1">File:</p>
                                <p className="text-lg font-bold text-freight-blue break-all">{file.name}</p>
                              </div>
                              
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <Label className="text-sm font-medium text-gray-700">Document Type *</Label>
                                  <Select 
                                    value={file.documentType || ""} 
                                    onValueChange={(value) => updateFileType(index, value)}
                                  >
                                    <SelectTrigger className="h-9">
                                      <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {DOCUMENT_CATEGORIES.map((category) => {
                                        const Icon = category.icon;
                                        return (
                                          <SelectItem key={category.value} value={category.value}>
                                            <div className="flex items-center space-x-2">
                                              <Icon className="w-4 h-4" />
                                              <span className="text-sm">{category.label}</span>
                                            </div>
                                          </SelectItem>
                                        );
                                      })}
                                    </SelectContent>
                                  </Select>
                                </div>
                                
                                {file.documentType === "delivery_order" && (
                                  <div className="space-y-1">
                                    <Label className="text-sm font-medium text-gray-700">Sub-Category</Label>
                                    <Select 
                                      value={file.subCategory || ""} 
                                      onValueChange={(value) => updateFileSubCategory(index, value)}
                                    >
                                      <SelectTrigger className="h-9">
                                        <SelectValue placeholder="Optional" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {SUB_CATEGORIES.map((subCategory) => (
                                          <SelectItem key={subCategory.value} value={subCategory.value}>
                                            <span className="text-sm">{subCategory.label}</span>
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}
                              </div>
                              
                              {file.documentType && DOCUMENT_CATEGORIES.find(cat => cat.value === file.documentType)?.creates && !shipmentId && (
                                <div className="bg-blue-50 border border-blue-200 rounded p-2">
                                  <div className="flex items-center space-x-1 text-blue-700">
                                    {DOCUMENT_CATEGORIES.find(cat => cat.value === file.documentType)?.creates === "air" ? (
                                      <Plane className="w-3 h-3" />
                                    ) : DOCUMENT_CATEGORIES.find(cat => cat.value === file.documentType)?.creates === "ocean" ? (
                                      <Ship className="w-3 h-3" />
                                    ) : (
                                      <Truck className="w-3 h-3" />
                                    )}
                                    <span className="text-xs">
                                      Creates {DOCUMENT_CATEGORIES.find(cat => cat.value === file.documentType)?.creates} shipment
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-4">
            <Button
              type="button"
              className="btn-outline-primary"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={uploadMutation.isPending || uploadedFiles.length === 0 || uploadedFiles.some(f => !f.documentType)}
              className="btn-primary"
            >
              {uploadMutation.isPending ? 
                `Uploading ${uploadedFiles.length} document${uploadedFiles.length > 1 ? 's' : ''}...` : 
                `Upload ${uploadedFiles.length} Document${uploadedFiles.length > 1 ? 's' : ''}`
              }
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}