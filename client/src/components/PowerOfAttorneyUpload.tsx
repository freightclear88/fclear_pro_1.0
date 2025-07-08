import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { FileUp, FileText, Scale, X } from "lucide-react";

interface PowerOfAttorneyUploadProps {
  trigger?: React.ReactNode;
}

export default function PowerOfAttorneyUpload({ trigger }: PowerOfAttorneyUploadProps) {
  const [open, setOpen] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setUploadedFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg'],
    },
    maxFiles: 1,
    multiple: false,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/profile/upload-poa', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Power of Attorney Uploaded",
        description: "Your POA has been successfully uploaded and is pending validation.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      setOpen(false);
      setUploadedFile(null);
    },
    onError: (error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (uploadedFile) {
      uploadMutation.mutate(uploadedFile);
    }
  };

  const removeFile = () => {
    setUploadedFile(null);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="bg-freight-blue hover:bg-freight-blue/90 text-white">
            <FileUp className="w-4 h-4 mr-2" />
            Upload POA
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Scale className="w-5 h-5 mr-2 text-freight-blue" />
            Upload Power of Attorney
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">Upload Power of Attorney</h4>
            <p className="text-sm text-blue-800">
              Upload your signed Power of Attorney document. Accepted formats: PDF, PNG, JPG, JPEG.
            </p>
          </div>

          {!uploadedFile ? (
            <Card className="border-2 border-dashed border-gray-300 hover:border-freight-blue transition-colors">
              <CardContent className="p-6">
                <div {...getRootProps()} className="cursor-pointer text-center">
                  <input {...getInputProps()} />
                  <div className="space-y-2">
                    <FileText className="w-12 h-12 mx-auto text-gray-400" />
                    {isDragActive ? (
                      <p className="text-freight-blue font-medium">Drop your POA document here</p>
                    ) : (
                      <>
                        <p className="text-gray-600">
                          <span className="font-medium text-freight-blue">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-gray-500">PDF, PNG, JPG, JPEG (max 10MB)</p>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border border-freight-blue bg-freight-blue/5">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <FileText className="w-8 h-8 text-freight-blue" />
                    <div>
                      <p className="font-medium text-gray-900">{uploadedFile.name}</p>
                      <p className="text-sm text-gray-500">
                        {Math.round(uploadedFile.size / 1024)} KB
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={removeFile}
                    className="text-gray-500 hover:text-red-500"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex space-x-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!uploadedFile || uploadMutation.isPending}
              className="flex-1 bg-freight-green hover:bg-freight-green/90 text-white"
            >
              {uploadMutation.isPending ? "Uploading..." : "Upload POA"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}