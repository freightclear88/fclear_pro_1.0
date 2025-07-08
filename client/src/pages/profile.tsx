import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import { User, Mail, Building, LogOut, Ship, FileText, MapPin, Hash, Edit, Save, X, Star, AlertCircle, Upload, Scale, Receipt, CheckCircle, XCircle, Clock } from "lucide-react";
import PowerOfAttorneyUpload from "@/components/PowerOfAttorneyUpload";
import IrsProofUpload from "@/components/IrsProofUpload";
import PowerOfAttorneyWizard from "@/components/PowerOfAttorneyWizard";

export default function Profile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [showPOAWizard, setShowPOAWizard] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    companyName: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    country: "United States",
    taxId: "",
    taxIdType: "EIN"
  });

  const { data: shipments = [] } = useQuery({
    queryKey: ["/api/shipments"],
  });

  const { data: userProfile } = useQuery({
    queryKey: ["/api/profile"],
    enabled: !!user,
  });

  const { data: stats } = useQuery({
    queryKey: ["/api/dashboard/stats"],
  });

  // Check POA status from user profile
  const poaStatus = userProfile?.powerOfAttorneyStatus || 'pending';
  const irsProofStatus = userProfile?.irsProofStatus || 'pending';
  
  // Debug logging
  console.log('POA Debug:', {
    poaStatus,
    documentPath: userProfile?.powerOfAttorneyDocumentPath,
    shouldShowButton: poaStatus === 'pending' && !userProfile?.powerOfAttorneyDocumentPath
  });

  // Update form data when profile loads
  useEffect(() => {
    if (userProfile) {
      setFormData({
        firstName: userProfile.firstName || "",
        lastName: userProfile.lastName || "",
        companyName: userProfile.companyName || "",
        address: userProfile.address || "",
        city: userProfile.city || "",
        state: userProfile.state || "",
        zipCode: userProfile.zipCode || "",
        country: userProfile.country || "United States",
        taxId: userProfile.taxId || "",
        taxIdType: userProfile.taxIdType || "EIN"
      });
    }
  }, [userProfile]);

  // Delete POA mutation
  const deletePOAMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/profile/poa', {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete POA');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/profile'] });
      toast({
        title: "POA Deleted",
        description: "Power of Attorney has been deleted successfully. You can now create a new one.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return await apiRequest("/api/profile", {
        method: "PUT",
        body: JSON.stringify(data),
        headers: {
          "Content-Type": "application/json",
        },
      });
    },
    onSuccess: () => {
      toast({
        title: "Profile Updated",
        description: "Your business information has been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      setIsEditing(false);
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateProfileMutation.mutate(formData);
  };

  const handleCancel = () => {
    if (userProfile) {
      setFormData({
        firstName: userProfile.firstName || "",
        lastName: userProfile.lastName || "",
        companyName: userProfile.companyName || "",
        address: userProfile.address || "",
        city: userProfile.city || "",
        state: userProfile.state || "",
        zipCode: userProfile.zipCode || "",
        country: userProfile.country || "United States",
        taxId: userProfile.taxId || "",
        taxIdType: userProfile.taxIdType || "EIN"
      });
    }
    setIsEditing(false);
  };

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-freight-dark flex items-center">
            <User className="w-6 h-6 mr-2 text-freight-blue" />
            Profile
          </h2>
          <p className="text-gray-600">Manage your business information and account settings</p>
        </div>
        <Button 
          onClick={handleLogout}
          variant="outline"
          className="text-freight-dark hover:text-freight-orange"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>

      {/* Power of Attorney Status */}
      <Card className="mb-6 border-l-4 border-l-freight-blue">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                {poaStatus === 'validated' ? (
                  <Star className="w-6 h-6 text-green-500 fill-green-500" />
                ) : poaStatus === 'uploaded' ? (
                  <AlertCircle className="w-6 h-6 text-yellow-500" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-red-500" />
                )}
                <div>
                  <h3 className="font-semibold text-lg">Power of Attorney</h3>
                  <p className="text-sm text-gray-600">
                    {poaStatus === 'validated' 
                      ? 'Your Power of Attorney is validated and active'
                      : poaStatus === 'uploaded'
                      ? 'Your Power of Attorney is uploaded and pending validation'
                      : 'Power of Attorney required for customs clearance'
                    }
                  </p>
                </div>
              </div>
              <Badge variant={poaStatus === 'validated' ? 'default' : poaStatus === 'pending' ? 'secondary' : poaStatus === 'rejected' ? 'destructive' : 'destructive'} className={
                poaStatus === 'validated' 
                  ? 'bg-green-100 text-green-800 hover:bg-green-100'
                  : poaStatus === 'pending'
                  ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100'
                  : poaStatus === 'rejected'
                  ? 'bg-red-100 text-red-800 hover:bg-red-100'
                  : 'bg-red-100 text-red-800 hover:bg-red-100'
              }>
                {poaStatus === 'validated' ? 'Validated' : poaStatus === 'pending' ? 'Pending Review' : poaStatus === 'rejected' ? 'Rejected' : 'Required'}
              </Badge>
            </div>
            
            <div className="flex items-center space-x-2">
              {(poaStatus === 'pending' && !userProfile?.powerOfAttorneyDocumentPath) && (
                <>
                  <Button
                    onClick={() => setShowPOAWizard(true)}
                    className="bg-freight-green hover:bg-freight-green/90 text-white"
                  >
                    <Scale className="w-4 h-4 mr-2" />
                    Create POA
                  </Button>
                  <PowerOfAttorneyUpload />
                </>
              )}
              {(poaStatus === 'uploaded' || poaStatus === 'validated') && (
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => window.open('/api/profile/poa/view', '_blank')}
                    className="text-purple-600 border-purple-600 hover:bg-purple-600 hover:text-white"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    View POA
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => deletePOAMutation.mutate()}
                    disabled={deletePOAMutation.isPending}
                    className="text-red-600 border-red-600 hover:bg-red-600 hover:text-white"
                  >
                    <X className="w-4 h-4 mr-2" />
                    {deletePOAMutation.isPending ? 'Deleting...' : 'Delete POA'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* IRS Proof Status */}
      <Card className="mb-6 border-l-4 border-l-freight-orange">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                {irsProofStatus === 'validated' ? (
                  <CheckCircle className="w-6 h-6 text-green-500" />
                ) : irsProofStatus === 'uploaded' ? (
                  <Clock className="w-6 h-6 text-yellow-500" />
                ) : (
                  <XCircle className="w-6 h-6 text-red-500" />
                )}
                <div>
                  <h3 className="font-semibold text-lg">IRS Proof</h3>
                  <p className="text-sm text-gray-600">
                    {irsProofStatus === 'validated' 
                      ? 'Your IRS proof document is validated'
                      : irsProofStatus === 'uploaded'
                      ? 'Your IRS proof document is pending verification'
                      : 'IRS verification document required'
                    }
                  </p>
                </div>
              </div>
              <Badge variant={irsProofStatus === 'validated' ? 'default' : irsProofStatus === 'pending' ? 'secondary' : irsProofStatus === 'rejected' ? 'destructive' : 'destructive'} className={
                irsProofStatus === 'validated'
                  ? 'bg-green-100 text-green-800 hover:bg-green-100'
                  : irsProofStatus === 'pending'
                  ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100'
                  : irsProofStatus === 'rejected'
                  ? 'bg-red-100 text-red-800 hover:bg-red-100'
                  : 'bg-red-100 text-red-800 hover:bg-red-100'
              }>
                {irsProofStatus === 'validated' ? 'Validated' : irsProofStatus === 'pending' ? 'Pending Review' : irsProofStatus === 'rejected' ? 'Rejected' : 'Required'}
              </Badge>
            </div>
            
            <div className="flex items-center space-x-2">
              {(irsProofStatus === 'pending' || irsProofStatus === 'rejected') && (
                <IrsProofUpload />
              )}
              {(irsProofStatus === 'uploaded' || irsProofStatus === 'validated') && (
                <Button
                  onClick={() => window.open('/api/profile/irs-proof/view', '_blank')}
                  className="btn-outline-accent"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  View Document
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Business Information */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center">
                <Building className="w-5 h-5 mr-2 text-freight-blue" />
                Business Information
              </CardTitle>
              {!isEditing ? (
                <Button
                  onClick={() => setIsEditing(true)}
                  variant="outline"
                  size="sm"
                  className="text-freight-blue border-freight-blue hover:bg-freight-blue hover:text-white"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              ) : (
                <div className="flex space-x-2">
                  <Button
                    onClick={handleSave}
                    disabled={updateProfileMutation.isPending}
                    size="sm"
                    className="bg-freight-green hover:bg-freight-green/90 text-white"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {updateProfileMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                  <Button
                    onClick={handleCancel}
                    variant="outline"
                    size="sm"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              {!isEditing ? (
                <>
                  {/* Display Mode */}
                  <div className="flex items-center space-x-4 mb-6">
                    <Avatar className="w-16 h-16">
                      <AvatarImage 
                        src={user?.profileImageUrl} 
                        alt="Profile"
                      />
                      <AvatarFallback className="bg-freight-blue text-white text-xl">
                        {(userProfile?.firstName?.[0] || user?.firstName?.[0] || "") + (userProfile?.lastName?.[0] || user?.lastName?.[0] || "")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="text-lg font-semibold">
                        {userProfile?.firstName || user?.firstName || ""} {userProfile?.lastName || user?.lastName || ""}
                      </h3>
                      <p className="text-gray-600 flex items-center">
                        <Mail className="w-4 h-4 mr-1" />
                        {user?.email}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Company Name</Label>
                      <p className="text-lg">{userProfile?.companyName || "Not specified"}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Tax ID ({userProfile?.taxIdType || "EIN"})</Label>
                      <p className="text-lg flex items-center">
                        <Hash className="w-4 h-4 mr-1" />
                        {userProfile?.taxId || "Not specified"}
                      </p>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-gray-600 flex items-center">
                      <MapPin className="w-4 h-4 mr-1" />
                      Business Address
                    </Label>
                    <div className="mt-1">
                      {userProfile?.address ? (
                        <div className="text-gray-800">
                          <p>{userProfile.address}</p>
                          <p>{userProfile.city}, {userProfile.state} {userProfile.zipCode}</p>
                          <p>{userProfile.country}</p>
                        </div>
                      ) : (
                        <p className="text-gray-500">Address not specified</p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Edit Mode */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        placeholder="Enter first name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        value={formData.lastName}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        placeholder="Enter last name"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="companyName">Company Name</Label>
                    <Input
                      id="companyName"
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                      placeholder="Enter company name"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="taxIdType">Tax ID Type</Label>
                      <Select value={formData.taxIdType} onValueChange={(value) => setFormData({ ...formData, taxIdType: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EIN">EIN (Employer Identification Number)</SelectItem>
                          <SelectItem value="SSN">SSN (Social Security Number)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="taxId">Tax ID Number</Label>
                      <Input
                        id="taxId"
                        value={formData.taxId}
                        onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                        placeholder={formData.taxIdType === "EIN" ? "XX-XXXXXXX" : "XXX-XX-XXXX"}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="address">Business Address</Label>
                    <Textarea
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Enter full business address"
                      rows={2}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        placeholder="City"
                      />
                    </div>
                    <div>
                      <Label htmlFor="state">State</Label>
                      <Input
                        id="state"
                        value={formData.state}
                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                        placeholder="State"
                      />
                    </div>
                    <div>
                      <Label htmlFor="zipCode">ZIP Code</Label>
                      <Input
                        id="zipCode"
                        value={formData.zipCode}
                        onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                        placeholder="ZIP"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="country">Country</Label>
                    <Select value={formData.country} onValueChange={(value) => setFormData({ ...formData, country: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="United States">United States</SelectItem>
                        <SelectItem value="Canada">Canada</SelectItem>
                        <SelectItem value="Mexico">Mexico</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Account Summary */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Ship className="w-5 h-5 mr-2 text-freight-blue" />
                Account Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Shipments:</span>
                <Badge variant="outline" className="text-freight-blue">
                  {stats?.activeShipments || 0}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Documents:</span>
                <Badge variant="outline" className="text-freight-green">
                  {stats?.pendingDocuments || 0}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Account Status:</span>
                <Badge className="bg-freight-green text-white">
                  Active
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="w-5 h-5 mr-2 text-freight-blue" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {shipments.length > 0 ? (
                <div className="space-y-3">
                  {shipments.slice(0, 3).map((shipment: any) => (
                    <div key={shipment.id} className="text-sm">
                      <p className="font-medium">{shipment.shipmentId}</p>
                      <p className="text-gray-600">{shipment.origin} → {shipment.destination}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No recent activity</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* POA Wizard */}
      <PowerOfAttorneyWizard
        isOpen={showPOAWizard}
        onClose={() => setShowPOAWizard(false)}
        user={userProfile}
      />
    </div>
  );
}