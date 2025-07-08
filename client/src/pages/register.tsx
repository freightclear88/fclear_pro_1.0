import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { UserPlus, Building2, Mail, Phone, MapPin, User } from "lucide-react";
import freightclearLogo from "@assets/cropped-freigthclear_alt_logo2_1751903859339.png";

interface RegisterFormData {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  companyName: string;
  companyAddress: string;
}

export default function Register() {
  const { toast } = useToast();
  const [formData, setFormData] = useState<RegisterFormData>({
    email: "",
    firstName: "",
    lastName: "",
    phone: "",
    companyName: "",
    companyAddress: "",
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterFormData) => {
      return await apiRequest("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: "Registration Successful",
        description: "Your account has been created. You can now log in.",
      });
      // Redirect to login
      window.location.href = "/api/login";
    },
    onError: (error: Error) => {
      toast({
        title: "Registration Failed",
        description: error.message || "Please check your information and try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.email || !formData.firstName || !formData.lastName || 
        !formData.phone || !formData.companyName || !formData.companyAddress) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    registerMutation.mutate(formData);
  };

  const updateField = (field: keyof RegisterFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-lg">
        <CardHeader className="text-center pb-6">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <img src={freightclearLogo} alt="Freightclear Logo" className="h-10" />
            <span className="text-2xl font-bold text-freight-dark">Freight Flow</span>
          </div>
          <CardTitle className="flex items-center justify-center space-x-2 text-2xl text-freight-dark">
            <UserPlus className="w-6 h-6 text-freight-blue" />
            <span>Create Your Account</span>
          </CardTitle>
          <p className="text-gray-600 mt-2">
            Join freight professionals who trust Freight Flow for their shipping needs
          </p>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-freight-dark flex items-center">
                <User className="w-5 h-5 mr-2 text-freight-blue" />
                Personal Information
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => updateField('firstName', e.target.value)}
                    placeholder="Enter your first name"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => updateField('lastName', e.target.value)}
                    placeholder="Enter your last name"
                    required
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email" className="flex items-center">
                    <Mail className="w-4 h-4 mr-1" />
                    Email Address *
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateField('email', e.target.value)}
                    placeholder="your@company.com"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="phone" className="flex items-center">
                    <Phone className="w-4 h-4 mr-1" />
                    Phone Number *
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => updateField('phone', e.target.value)}
                    placeholder="+1 (555) 123-4567"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Company Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-freight-dark flex items-center">
                <Building2 className="w-5 h-5 mr-2 text-freight-blue" />
                Company Information
              </h3>
              
              <div>
                <Label htmlFor="companyName">Company Name *</Label>
                <Input
                  id="companyName"
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => updateField('companyName', e.target.value)}
                  placeholder="Your Company Inc."
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="companyAddress" className="flex items-center">
                  <MapPin className="w-4 h-4 mr-1" />
                  Company Address *
                </Label>
                <Input
                  id="companyAddress"
                  type="text"
                  value={formData.companyAddress}
                  onChange={(e) => updateField('companyAddress', e.target.value)}
                  placeholder="123 Business Ave, City, State 12345"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col space-y-4 pt-4">
              <Button
                type="submit"
                className="w-full bg-freight-blue hover:bg-freight-blue/90 text-white py-3 text-lg font-semibold"
                disabled={registerMutation.isPending}
              >
                {registerMutation.isPending ? "Creating Account..." : "Create Account"}
              </Button>
              
              <div className="text-center">
                <span className="text-gray-600">Already have an account? </span>
                <Button
                  type="button"
                  variant="link"
                  className="text-freight-blue hover:text-freight-blue/80 p-0"
                  onClick={() => window.location.href = "/api/login"}
                >
                  Sign In
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}