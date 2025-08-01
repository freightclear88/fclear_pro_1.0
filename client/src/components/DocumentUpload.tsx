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

export default function DocumentUpload({ shipmentId, trigger, onShipmentCreated }: DocumentUploadProps) {
  const [open, setOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>("");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setUploadedFiles(acceptedFiles);
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
    mutationFn: async ({ files, category, subCategory }: { files: File[], category: string, subCategory?: string }) => {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('documents', file);
      });
      formData.append('category', category);
      
      if (subCategory) {
        formData.append('subCategory', subCategory);
      }
      
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

  const handleUpload = () => {
    if (uploadedFiles.length === 0) {
      toast({
        title: "No Files Selected",
        description: "Please select files to upload",
        variant: "destructive",
      });
      return;
    }

    if (!selectedCategory) {
      toast({
        title: "Category Required",
        description: "Please select a document category",
        variant: "destructive",
      });
      return;
    }

    // Auto-assign "last_mile" subcategory for delivery orders
    let finalSubCategory = selectedSubCategory;
    if (selectedCategory === "delivery_order" && !finalSubCategory) {
      finalSubCategory = "last_mile";
    }
    
    uploadMutation.mutate({ 
      files: uploadedFiles, 
      category: selectedCategory,
      subCategory: finalSubCategory || undefined
    });
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
          {/* Document Category Selection */}
          <div className="space-y-2">
            <Label htmlFor="category">Document Category *</Label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select document type" />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_CATEGORIES.map((category) => {
                  const Icon = category.icon;
                  return (
                    <SelectItem key={category.value} value={category.value}>
                      <div className="flex items-center space-x-2">
                        <Icon className="w-4 h-4" />
                        <span>{category.label}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            
            {selectedCategoryData && selectedCategoryData.creates && !shipmentId && (
              <div className="bg-freight-blue/10 border border-freight-blue/20 rounded-lg p-3 mt-2">
                <div className="flex items-center space-x-2 text-freight-blue">
                  {selectedCategoryData.creates === "air" ? (
                    <Plane className="w-4 h-4" />
                  ) : selectedCategoryData.creates === "ocean" ? (
                    <Ship className="w-4 h-4" />
                  ) : (
                    <Truck className="w-4 h-4" />
                  )}
                  <span className="text-sm font-medium">
                    This will create a new {selectedCategoryData.creates} shipment
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Sub-Category Selection - Show for delivery_order */}
          {selectedCategory === "delivery_order" && (
            <div className="space-y-2">
              <Label htmlFor="subCategory">Sub-Category</Label>
              <Select value={selectedSubCategory} onValueChange={setSelectedSubCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select sub-category (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {SUB_CATEGORIES.map((subCategory) => (
                    <SelectItem key={subCategory.value} value={subCategory.value}>
                      {subCategory.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {selectedSubCategory === "last_mile" && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-2">
                  <div className="flex items-center space-x-2 text-green-700">
                    <Truck className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      This delivery order will be categorized for last mile delivery tracking
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* File Upload Area */}
          <div className="space-y-2">
            <Label>Upload Files</Label>
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
                  <div className="mt-4">
                    <h4 className="font-medium text-gray-700 mb-2">
                      Selected Files ({uploadedFiles.length})
                    </h4>
                    <div className="space-y-2">
                      {uploadedFiles.map((file, index) => (
                        <div key={index} className="flex items-center space-x-2 p-2 bg-gray-50 rounded">
                          <FileText className="w-4 h-4 text-freight-blue" />
                          <span className="text-sm text-gray-700 flex-1">{file.name}</span>
                          <span className="text-xs text-gray-500">
                            {(file.size / 1024 / 1024).toFixed(1)} MB
                          </span>
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
              disabled={uploadMutation.isPending || uploadedFiles.length === 0 || !selectedCategory}
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