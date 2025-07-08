import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { FileUp, Receipt } from "lucide-react";

interface IrsProofUploadProps {
  trigger?: React.ReactNode;
}

export default function IrsProofUpload({ trigger }: IrsProofUploadProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('irsProof', file);
      
      return await apiRequest("/api/profile/irs-proof/upload", {
        method: "POST",
        body: formData,
      });
    },
    onSuccess: () => {
      toast({
        title: "IRS Proof Uploaded",
        description: "Your IRS proof document has been uploaded and is pending verification.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      setIsOpen(false);
      setFile(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload IRS proof document.",
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast({
        title: "No File Selected",
        description: "Please select an IRS proof document to upload.",
        variant: "destructive",
      });
      return;
    }
    uploadMutation.mutate(file);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="w-full">
            <FileUp className="w-4 h-4 mr-2" />
            Upload IRS Proof
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Receipt className="w-5 h-5 mr-2 text-freight-blue" />
            Upload IRS Proof Document
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="irsProof">
              IRS Proof Document
            </Label>
            <Input
              id="irsProof"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileChange}
              required
            />
            <p className="text-sm text-gray-500">
              Accepted formats: PDF, JPG, PNG (max 10MB)
            </p>
          </div>
          
          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-sm text-blue-700">
              <Receipt className="w-4 h-4 inline mr-1" />
              Upload your IRS verification document (EIN confirmation letter, tax determination letter, etc.)
            </p>
          </div>
          
          <div className="flex space-x-2">
            <Button
              type="submit"
              className="flex-1 bg-freight-blue hover:bg-freight-blue/90"
              disabled={uploadMutation.isPending || !file}
            >
              {uploadMutation.isPending ? "Uploading..." : "Upload Document"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}