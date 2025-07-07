import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { CloudUpload, FileText, Receipt, Bell, Plane, Info, Folder } from "lucide-react";

interface DocumentUploadProps {
  shipmentId: number;
}

const documentCategories = [
  { id: "bill_of_lading", label: "Bill of Lading", icon: FileText, color: "text-freight-orange" },
  { id: "commercial_invoice", label: "Commercial Invoice", icon: Receipt, color: "text-freight-blue" },
  { id: "arrival_notice", label: "Arrival Notice", icon: Bell, color: "text-freight-green" },
  { id: "airway_bill", label: "Airway Bill", icon: Plane, color: "text-freight-orange" },
  { id: "isf_information", label: "ISF Info Sheet", icon: Info, color: "text-freight-blue" },
  { id: "other", label: "Other", icon: Folder, color: "text-gray-500" },
];

export default function DocumentUpload({ shipmentId }: DocumentUploadProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async ({ file, category }: { file: File; category: string }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", category);

      const response = await apiRequest("POST", `/api/shipments/${shipmentId}/documents`, formData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Document uploaded successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/shipments", shipmentId, "documents"] });
      setSelectedCategory("");
      setUploadProgress(0);
    },
    onError: (error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
      setUploadProgress(0);
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    if (!selectedCategory) {
      toast({
        title: "Category Required",
        description: "Please select a document category first",
        variant: "destructive",
      });
      return;
    }

    const file = acceptedFiles[0];
    setUploadProgress(0);
    uploadMutation.mutate({ file, category: selectedCategory });
  }, [selectedCategory, uploadMutation, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: false,
  });

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold text-freight-dark mb-4 flex items-center">
          <CloudUpload className="mr-2 text-freight-orange" />
          Document Upload
        </h3>
        
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center mb-4 transition-all cursor-pointer
            ${isDragActive 
              ? "border-freight-green bg-green-50" 
              : selectedCategory 
                ? "border-freight-blue bg-blue-50 hover:border-freight-orange hover:bg-orange-50" 
                : "border-gray-300 bg-gray-50"
            }
          `}
        >
          <input {...getInputProps()} />
          <CloudUpload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-lg font-medium text-gray-700 mb-2">
            Drop files here or click to browse
          </p>
          <p className="text-sm text-gray-500">
            Supported formats: PDF, JPG, PNG (Max 10MB)
          </p>
        </div>

        {uploadMutation.isPending && (
          <div className="mb-4">
            <Progress value={uploadProgress} className="w-full" />
            <p className="text-sm text-gray-600 mt-2">Uploading document...</p>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {documentCategories.map((category) => {
            const Icon = category.icon;
            return (
              <div
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`
                  border rounded-lg p-3 transition-colors cursor-pointer
                  ${selectedCategory === category.id
                    ? "border-freight-orange bg-orange-50"
                    : "border-gray-200 hover:border-freight-orange"
                  }
                `}
              >
                <div className="flex items-center space-x-2">
                  <Icon className={`w-4 h-4 ${category.color}`} />
                  <span className="text-sm font-medium">{category.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
