import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Scale, FileText, ChevronRight, ChevronLeft, Download } from "lucide-react";
import { format } from "date-fns";

interface PowerOfAttorneyWizardProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
}

interface POAFormData {
  // Principal (User) Information
  principalName: string;
  principalCompanyName: string;
  principalAddress: string;
  principalCity: string;
  principalState: string;
  principalZip: string;
  principalEmail: string;
  principalPhone: string;
  
  // Agent Information (WCS International Inc.)
  agentName: string;
  agentTitle: string;
  agentCompany: string;
  agentAddress: string;
  
  // Powers Granted
  customsDeclarations: boolean;
  importDocuments: boolean;
  paymentOfDuties: boolean;
  representBeforeCBP: boolean;
  releaseOfGoods: boolean;
  otherPowers: string;
  
  // Acknowledgment and Signature
  acknowledgment: boolean;
  electronicSignature: string;
  signatureDate: string;
}

export default function PowerOfAttorneyWizard({ isOpen, onClose, user }: PowerOfAttorneyWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<POAFormData>({
    // Pre-populate with user data
    principalName: user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : '',
    principalCompanyName: user?.companyName || '',
    principalAddress: user?.address || '',
    principalCity: user?.city || '',
    principalState: user?.state || '',
    principalZip: user?.zipCode || '',
    principalEmail: user?.email || '',
    principalPhone: user?.phone || '',
    
    // Default agent information (WCS International Inc.)
    agentName: 'WCS International Inc.',
    agentTitle: 'Customs Broker',
    agentCompany: 'WCS International Inc.',
    agentAddress: '371 Merrick Rd, suite 305, Rockville Centre, NY 11570',
    
    // Powers
    customsDeclarations: true,
    importDocuments: true,
    paymentOfDuties: true,
    representBeforeCBP: true,
    releaseOfGoods: true,
    otherPowers: '',
    
    // Signature
    acknowledgment: false,
    electronicSignature: '',
    signatureDate: format(new Date(), 'yyyy-MM-dd'),
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const generatePOAMutation = useMutation({
    mutationFn: async (data: POAFormData) => {
      const response = await fetch('/api/profile/generate-poa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to generate POA');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Power of Attorney Generated",
        description: "Your POA has been generated and saved to your profile.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      onClose();
      setCurrentStep(1);
    },
    onError: (error) => {
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateField = (field: keyof POAFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const nextStep = () => {
    if (currentStep < 4) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = () => {
    if (!formData.acknowledgment || !formData.electronicSignature) {
      toast({
        title: "Required Fields Missing",
        description: "Please complete acknowledgment and electronic signature.",
        variant: "destructive",
      });
      return;
    }
    generatePOAMutation.mutate(formData);
  };

  const steps = [
    { number: 1, title: "Principal Information", description: "Your contact details" },
    { number: 2, title: "Agent Information", description: "Freightclear representative" },
    { number: 3, title: "Powers Granted", description: "Customs authorities" },
    { number: 4, title: "Signature", description: "Electronic signature" },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Scale className="w-5 h-5 mr-2 text-freight-blue" />
            Power of Attorney Form Wizard
          </DialogTitle>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-6">
          {steps.map((step, index) => (
            <div key={step.number} className="flex items-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                currentStep >= step.number 
                  ? 'bg-freight-blue text-white' 
                  : 'bg-gray-200 text-gray-600'
              }`}>
                {step.number}
              </div>
              {index < steps.length - 1 && (
                <div className={`w-12 h-1 mx-2 ${
                  currentStep > step.number ? 'bg-freight-blue' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="space-y-6">
          {currentStep === 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Principal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="principalName">Full Name *</Label>
                    <Input
                      id="principalName"
                      value={formData.principalName}
                      onChange={(e) => updateField('principalName', e.target.value)}
                      placeholder="Enter your full legal name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="principalEmail">Email *</Label>
                    <Input
                      id="principalEmail"
                      type="email"
                      value={formData.principalEmail}
                      onChange={(e) => updateField('principalEmail', e.target.value)}
                      placeholder="your@email.com"
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="principalCompanyName">Company Name *</Label>
                  <Input
                    id="principalCompanyName"
                    value={formData.principalCompanyName}
                    onChange={(e) => updateField('principalCompanyName', e.target.value)}
                    placeholder="Enter your company name"
                  />
                </div>
                
                <div>
                  <Label htmlFor="principalAddress">Address *</Label>
                  <Input
                    id="principalAddress"
                    value={formData.principalAddress}
                    onChange={(e) => updateField('principalAddress', e.target.value)}
                    placeholder="Street address"
                  />
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="principalCity">City *</Label>
                    <Input
                      id="principalCity"
                      value={formData.principalCity}
                      onChange={(e) => updateField('principalCity', e.target.value)}
                      placeholder="City"
                    />
                  </div>
                  <div>
                    <Label htmlFor="principalState">State *</Label>
                    <Input
                      id="principalState"
                      value={formData.principalState}
                      onChange={(e) => updateField('principalState', e.target.value)}
                      placeholder="State"
                    />
                  </div>
                  <div>
                    <Label htmlFor="principalZip">ZIP Code *</Label>
                    <Input
                      id="principalZip"
                      value={formData.principalZip}
                      onChange={(e) => updateField('principalZip', e.target.value)}
                      placeholder="ZIP"
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="principalPhone">Phone Number</Label>
                  <Input
                    id="principalPhone"
                    value={formData.principalPhone}
                    onChange={(e) => updateField('principalPhone', e.target.value)}
                    placeholder="(555) 123-4567"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep === 2 && (
            <Card>
              <CardHeader>
                <CardTitle>Agent Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-blue-800">
                    The following representative from Freightclear will be authorized to act on your behalf:
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="agentName">Agent Name</Label>
                    <Input
                      id="agentName"
                      value={formData.agentName}
                      onChange={(e) => updateField('agentName', e.target.value)}
                      readOnly
                      className="bg-gray-50"
                    />
                  </div>
                  <div>
                    <Label htmlFor="agentTitle">Title</Label>
                    <Input
                      id="agentTitle"
                      value={formData.agentTitle}
                      onChange={(e) => updateField('agentTitle', e.target.value)}
                      readOnly
                      className="bg-gray-50"
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="agentCompany">Company</Label>
                  <Input
                    id="agentCompany"
                    value={formData.agentCompany}
                    onChange={(e) => updateField('agentCompany', e.target.value)}
                    readOnly
                    className="bg-gray-50"
                  />
                </div>
                
                <div>
                  <Label htmlFor="agentAddress">Address</Label>
                  <Input
                    id="agentAddress"
                    value={formData.agentAddress}
                    onChange={(e) => updateField('agentAddress', e.target.value)}
                    readOnly
                    className="bg-gray-50"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep === 3 && (
            <Card>
              <CardHeader>
                <CardTitle>Powers Granted</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600 mb-4">
                  Select the authorities you wish to grant to your customs broker:
                </p>
                
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="customsDeclarations"
                      checked={formData.customsDeclarations}
                      onCheckedChange={(checked) => updateField('customsDeclarations', checked)}
                    />
                    <Label htmlFor="customsDeclarations">File customs declarations and entry documents</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="importDocuments"
                      checked={formData.importDocuments}
                      onCheckedChange={(checked) => updateField('importDocuments', checked)}
                    />
                    <Label htmlFor="importDocuments">Sign import documents on my behalf</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="paymentOfDuties"
                      checked={formData.paymentOfDuties}
                      onCheckedChange={(checked) => updateField('paymentOfDuties', checked)}
                    />
                    <Label htmlFor="paymentOfDuties">Make payment of duties, taxes, and fees</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="representBeforeCBP"
                      checked={formData.representBeforeCBP}
                      onCheckedChange={(checked) => updateField('representBeforeCBP', checked)}
                    />
                    <Label htmlFor="representBeforeCBP">Represent me before U.S. Customs and Border Protection</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="releaseOfGoods"
                      checked={formData.releaseOfGoods}
                      onCheckedChange={(checked) => updateField('releaseOfGoods', checked)}
                    />
                    <Label htmlFor="releaseOfGoods">Authorize release of goods from customs custody</Label>
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="otherPowers">Other Powers (Optional)</Label>
                  <Textarea
                    id="otherPowers"
                    value={formData.otherPowers}
                    onChange={(e) => updateField('otherPowers', e.target.value)}
                    placeholder="Specify any additional powers you wish to grant..."
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep === 4 && (
            <Card>
              <CardHeader>
                <CardTitle>Electronic Signature</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-yellow-800">
                    By providing your electronic signature below, you acknowledge that this Power of Attorney 
                    will have the same legal effect as if you had signed it with a handwritten signature.
                  </p>
                </div>
                
                <div className="flex items-center space-x-2 mb-4">
                  <Checkbox
                    id="acknowledgment"
                    checked={formData.acknowledgment}
                    onCheckedChange={(checked) => updateField('acknowledgment', checked)}
                  />
                  <Label htmlFor="acknowledgment" className="text-sm">
                    I acknowledge that I have read, understood, and agree to the terms and conditions of this Power of Attorney
                  </Label>
                </div>
                
                <div>
                  <Label htmlFor="electronicSignature">Electronic Signature *</Label>
                  <Input
                    id="electronicSignature"
                    value={formData.electronicSignature}
                    onChange={(e) => updateField('electronicSignature', e.target.value)}
                    placeholder="Type your full legal name"
                    className="font-serif text-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Your typed name serves as your electronic signature
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="signatureDate">Date</Label>
                  <Input
                    id="signatureDate"
                    type="date"
                    value={formData.signatureDate}
                    onChange={(e) => updateField('signatureDate', e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-6 border-t">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 1}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>
          
          <div className="flex space-x-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            
            {currentStep < 4 ? (
              <Button onClick={nextStep} className="bg-freight-blue hover:bg-freight-blue/90 text-white">
                Next
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button 
                onClick={handleSubmit}
                disabled={generatePOAMutation.isPending || !formData.acknowledgment || !formData.electronicSignature}
                className="bg-freight-green hover:bg-freight-green/90 text-white"
              >
                {generatePOAMutation.isPending ? (
                  "Generating..."
                ) : (
                  <>
                    <FileText className="w-4 h-4 mr-2" />
                    Generate POA
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}