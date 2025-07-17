import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Search, Upload, FileText, User, DollarSign, Calendar, Send, Loader2 } from "lucide-react";

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  companyName?: string;
}

interface InvoiceForm {
  targetUserId: string;
  invoiceNumber: string;
  invoiceAmount: string;
  dueDate: string;
  description: string;
  shipmentId: string;
  emailSubject: string;
  emailMessage: string;
  invoiceFile: File | null;
}

export default function AdminInvoiceUpload() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [invoiceForm, setInvoiceForm] = useState<InvoiceForm>({
    targetUserId: "",
    invoiceNumber: "",
    invoiceAmount: "",
    dueDate: "",
    description: "",
    shipmentId: "",
    emailSubject: "",
    emailMessage: "",
    invoiceFile: null,
  });

  // Fetch all users for search
  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ['/api/admin/users'],
  });

  // Fetch user shipments when user is selected
  const { data: userShipments = [] } = useQuery({
    queryKey: ['/api/admin/user-shipments', selectedUser?.id],
    enabled: !!selectedUser?.id,
  });

  // Filter users based on search query
  const filteredUsers = allUsers.filter(user => {
    const searchLower = searchQuery.toLowerCase();
    return (
      user.email.toLowerCase().includes(searchLower) ||
      `${user.firstName} ${user.lastName}`.toLowerCase().includes(searchLower) ||
      (user.companyName && user.companyName.toLowerCase().includes(searchLower))
    );
  });

  const uploadInvoiceMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      return await apiRequest('/api/admin/upload-invoice', {
        method: 'POST',
        body: formData,
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Invoice Uploaded Successfully",
        description: `Invoice sent to ${data.targetUser.email}`,
      });
      
      // Reset form
      setInvoiceForm({
        targetUserId: "",
        invoiceNumber: "",
        invoiceAmount: "",
        dueDate: "",
        description: "",
        shipmentId: "",
        emailSubject: "",
        emailMessage: "",
        invoiceFile: null,
      });
      setSelectedUser(null);
      setSearchQuery("");
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload invoice",
        variant: "destructive",
      });
    },
  });

  const handleUserSelect = (user: User) => {
    setSelectedUser(user);
    setInvoiceForm(prev => ({
      ...prev,
      targetUserId: user.id,
      emailSubject: `New Invoice from Freightclear - ${invoiceForm.invoiceNumber || '[Invoice Number]'}`,
      emailMessage: `Dear ${user.firstName},\n\nPlease find your new invoice attached. You can view and pay this invoice by logging into your Freightclear Workflows account.\n\nThank you for your business!\n\nBest regards,\nFreightclear Team`
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setInvoiceForm(prev => ({ ...prev, invoiceFile: file }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!invoiceForm.invoiceFile) {
      toast({
        title: "File Required",
        description: "Please select an invoice file to upload",
        variant: "destructive",
      });
      return;
    }

    if (!selectedUser) {
      toast({
        title: "User Required",
        description: "Please select a target user for the invoice",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append('invoice', invoiceForm.invoiceFile);
    formData.append('targetUserId', invoiceForm.targetUserId);
    formData.append('invoiceNumber', invoiceForm.invoiceNumber);
    formData.append('invoiceAmount', invoiceForm.invoiceAmount);
    formData.append('dueDate', invoiceForm.dueDate);
    formData.append('description', invoiceForm.description);
    formData.append('shipmentId', invoiceForm.shipmentId);
    formData.append('emailSubject', invoiceForm.emailSubject);
    formData.append('emailMessage', invoiceForm.emailMessage);

    uploadInvoiceMutation.mutate(formData);
  };

  return (
    <div className="space-y-6">
      {/* User Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Select Target User
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="userSearch">Search by name, email, or company</Label>
              <Input
                id="userSearch"
                placeholder="Enter name, email, or company name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>

            {searchQuery && (
              <div className="max-h-40 overflow-y-auto border rounded-lg">
                {filteredUsers.length === 0 ? (
                  <p className="p-4 text-gray-500 text-center">No users found</p>
                ) : (
                  <div className="space-y-1">
                    {filteredUsers.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => handleUserSelect(user)}
                        className={`w-full text-left p-3 hover:bg-gray-50 border-b ${
                          selectedUser?.id === user.id ? 'bg-blue-50 border-blue-200' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="font-medium">{user.firstName} {user.lastName}</p>
                            <p className="text-sm text-gray-500">{user.email}</p>
                            {user.companyName && (
                              <p className="text-sm text-gray-400">{user.companyName}</p>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {selectedUser && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-green-800">
                  <User className="w-4 h-4" />
                  <span className="font-medium">Selected User:</span>
                  <span>{selectedUser.firstName} {selectedUser.lastName} ({selectedUser.email})</span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Invoice Upload Form */}
      {selectedUser && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Upload Invoice
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="invoiceFile">Invoice File</Label>
                  <Input
                    id="invoiceFile"
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={handleFileChange}
                    className="cursor-pointer"
                  />
                </div>

                <div>
                  <Label htmlFor="invoiceNumber">Invoice Number</Label>
                  <Input
                    id="invoiceNumber"
                    value={invoiceForm.invoiceNumber}
                    onChange={(e) => setInvoiceForm(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                    placeholder="INV-001"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="invoiceAmount">Amount (USD)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="invoiceAmount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={invoiceForm.invoiceAmount}
                      onChange={(e) => setInvoiceForm(prev => ({ ...prev, invoiceAmount: e.target.value }))}
                      placeholder="0.00"
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="dueDate">Due Date</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="dueDate"
                      type="date"
                      value={invoiceForm.dueDate}
                      onChange={(e) => setInvoiceForm(prev => ({ ...prev, dueDate: e.target.value }))}
                      className="pl-10"
                    />
                  </div>
                </div>

                {userShipments.length > 0 && (
                  <div className="md:col-span-2">
                    <Label htmlFor="shipmentId">Link to Shipment (Optional)</Label>
                    <Select
                      value={invoiceForm.shipmentId}
                      onValueChange={(value) => setInvoiceForm(prev => ({ ...prev, shipmentId: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a shipment" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">No shipment</SelectItem>
                        {userShipments.map((shipment: any) => (
                          <SelectItem key={shipment.id} value={shipment.id.toString()}>
                            {shipment.shipmentId} - {shipment.description}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="md:col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={invoiceForm.description}
                    onChange={(e) => setInvoiceForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Freight charges, customs duties, storage fees..."
                    rows={2}
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="emailSubject">Email Subject</Label>
                  <Input
                    id="emailSubject"
                    value={invoiceForm.emailSubject}
                    onChange={(e) => setInvoiceForm(prev => ({ ...prev, emailSubject: e.target.value }))}
                    placeholder="Email subject line"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="emailMessage">Email Message</Label>
                  <Textarea
                    id="emailMessage"
                    value={invoiceForm.emailMessage}
                    onChange={(e) => setInvoiceForm(prev => ({ ...prev, emailMessage: e.target.value }))}
                    placeholder="Custom message to include in the email notification"
                    rows={4}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="submit"
                  disabled={uploadInvoiceMutation.isPending}
                  className="btn-primary flex-1"
                >
                  {uploadInvoiceMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Upload & Send Invoice
                    </>
                  )}
                </Button>
                
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSelectedUser(null);
                    setSearchQuery("");
                    setInvoiceForm({
                      targetUserId: "",
                      invoiceNumber: "",
                      invoiceAmount: "",
                      dueDate: "",
                      description: "",
                      shipmentId: "",
                      emailSubject: "",
                      emailMessage: "",
                      invoiceFile: null,
                    });
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}