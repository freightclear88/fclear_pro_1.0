import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { FileText, CheckCircle, ArrowLeft, ArrowRight, User, Building, Signature, Download } from "lucide-react";

interface PowerOfAttorneyWizardProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
}

interface POAFormData {
  // Principal (User) Information
  principalName: string;
  principalAddress: string;
  principalCity: string;
  principalState: string;
  principalZip: string;
  principalEmail: string;
  principalPhone: string;
  
  // Agent Information (Freightclear)
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

const STEPS = [
  { id: 1, title: "Personal Information", icon: User },
  { id: 2, title: "Agent Authorization", icon: Building },
  { id: 3, title: "Powers & Permissions", icon: FileText },
  { id: 4, title: "Review & Sign", icon: Signature },
];

export default function PowerOfAttorneyWizard({ isOpen, onClose, user }: PowerOfAttorneyWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<POAFormData>({
    principalName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
    principalAddress: '',
    principalCity: '',
    principalState: '',
    principalZip: '',
    principalEmail: user?.email || '',
    principalPhone: '',
    agentName: 'Freightclear Logistics',
    agentTitle: 'Customs Broker',
    agentCompany: 'Freightclear Inc.',
    agentAddress: '123 Harbor Blvd, Los Angeles, CA 90731',
    customsDeclarations: true,
    importDocuments: true,
    paymentOfDuties: true,
    representBeforeCBP: true,
    releaseOfGoods: true,
    otherPowers: '',
    acknowledgment: false,
    electronicSignature: '',
    signatureDate: new Date().toISOString().split('T')[0],
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const submitPOAMutation = useMutation({
    mutationFn: async (data: POAFormData) => {
      return await apiRequest('/api/power-of-attorney/submit', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
          'Content-Type': 'application/json',
        },
      });
    },
    onSuccess: () => {
      toast({
        title: "Power of Attorney Submitted",
        description: "Your POA form has been successfully signed and submitted for validation.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      onClose();
      setCurrentStep(1);
    },
    onError: (error) => {
      toast({
        title: "Submission Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateFormData = (field: keyof POAFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const nextStep = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const isStepValid = () => {
    switch (currentStep) {
      case 1:
        return formData.principalName && formData.principalAddress && formData.principalCity && 
               formData.principalState && formData.principalZip && formData.principalEmail;
      case 2:
        return true; // Agent info is pre-filled
      case 3:
        return formData.customsDeclarations || formData.importDocuments || formData.paymentOfDuties ||
               formData.representBeforeCBP || formData.releaseOfGoods;
      case 4:
        return formData.acknowledgment && formData.electronicSignature;
      default:
        return false;
    }
  };

  const handleSubmit = () => {
    if (isStepValid()) {
      submitPOAMutation.mutate(formData);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="principalName">Full Legal Name *</Label>
                <Input
                  id="principalName"
                  value={formData.principalName}
                  onChange={(e) => updateFormData('principalName', e.target.value)}
                  placeholder="Enter your full legal name"
                />
              </div>
              <div>
                <Label htmlFor="principalEmail">Email Address *</Label>
                <Input
                  id="principalEmail"
                  type="email"
                  value={formData.principalEmail}
                  onChange={(e) => updateFormData('principalEmail', e.target.value)}
                  placeholder="your@email.com"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="principalAddress">Street Address *</Label>
              <Input
                id="principalAddress"
                value={formData.principalAddress}
                onChange={(e) => updateFormData('principalAddress', e.target.value)}
                placeholder="123 Main Street"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="principalCity">City *</Label>
                <Input
                  id="principalCity"
                  value={formData.principalCity}
                  onChange={(e) => updateFormData('principalCity', e.target.value)}
                  placeholder="City"
                />
              </div>
              <div>
                <Label htmlFor="principalState">State *</Label>
                <Input
                  id="principalState"
                  value={formData.principalState}
                  onChange={(e) => updateFormData('principalState', e.target.value)}
                  placeholder="State"
                />
              </div>
              <div>
                <Label htmlFor="principalZip">ZIP Code *</Label>
                <Input
                  id="principalZip"
                  value={formData.principalZip}
                  onChange={(e) => updateFormData('principalZip', e.target.value)}
                  placeholder="12345"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="principalPhone">Phone Number</Label>
              <Input
                id="principalPhone"
                value={formData.principalPhone}
                onChange={(e) => updateFormData('principalPhone', e.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="bg-freight-blue/5 p-4 rounded-lg border border-freight-blue/20">
              <h3 className="font-semibold text-freight-blue mb-2">Authorized Agent Information</h3>
              <p className="text-sm text-gray-600 mb-4">
                By proceeding, you authorize Freightclear to act as your customs broker and agent for import operations.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Agent Name</Label>
                  <Input value={formData.agentName} disabled className="bg-gray-50" />
                </div>
                <div>
                  <Label>Title</Label>
                  <Input value={formData.agentTitle} disabled className="bg-gray-50" />
                </div>
                <div>
                  <Label>Company</Label>
                  <Input value={formData.agentCompany} disabled className="bg-gray-50" />
                </div>
                <div>
                  <Label>Business Address</Label>
                  <Input value={formData.agentAddress} disabled className="bg-gray-50" />
                </div>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-4">Powers and Permissions</h3>
              <p className="text-sm text-gray-600 mb-4">
                Select the powers you wish to grant to Freightclear as your authorized agent:
              </p>
              
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="customsDeclarations"
                    checked={formData.customsDeclarations}
                    onCheckedChange={(checked) => updateFormData('customsDeclarations', checked)}
                  />
                  <Label htmlFor="customsDeclarations">File customs declarations and import entries</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="importDocuments"
                    checked={formData.importDocuments}
                    onCheckedChange={(checked) => updateFormData('importDocuments', checked)}
                  />
                  <Label htmlFor="importDocuments">Sign and submit import documents on my behalf</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="paymentOfDuties"
                    checked={formData.paymentOfDuties}
                    onCheckedChange={(checked) => updateFormData('paymentOfDuties', checked)}
                  />
                  <Label htmlFor="paymentOfDuties">Make payment of duties, taxes, and fees</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="representBeforeCBP"
                    checked={formData.representBeforeCBP}
                    onCheckedChange={(checked) => updateFormData('representBeforeCBP', checked)}
                  />
                  <Label htmlFor="representBeforeCBP">Represent me before U.S. Customs and Border Protection</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="releaseOfGoods"
                    checked={formData.releaseOfGoods}
                    onCheckedChange={(checked) => updateFormData('releaseOfGoods', checked)}
                  />
                  <Label htmlFor="releaseOfGoods">Arrange for release and delivery of goods</Label>
                </div>
              </div>
              
              <div className="mt-4">
                <Label htmlFor="otherPowers">Additional Powers (Optional)</Label>
                <Textarea
                  id="otherPowers"
                  value={formData.otherPowers}
                  onChange={(e) => updateFormData('otherPowers', e.target.value)}
                  placeholder="Specify any additional powers you wish to grant..."
                  rows={3}
                />
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-4">Review and Electronic Signature</h3>
              
              {/* Summary */}
              <Card className="mb-4">
                <CardHeader>
                  <CardTitle className="text-lg">Power of Attorney Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div><strong>Principal:</strong> {formData.principalName}</div>
                  <div><strong>Agent:</strong> {formData.agentName}</div>
                  <div><strong>Powers Granted:</strong></div>
                  <ul className="list-disc list-inside ml-4 space-y-1">
                    {formData.customsDeclarations && <li>File customs declarations and import entries</li>}
                    {formData.importDocuments && <li>Sign and submit import documents</li>}
                    {formData.paymentOfDuties && <li>Make payment of duties, taxes, and fees</li>}
                    {formData.representBeforeCBP && <li>Represent before U.S. Customs and Border Protection</li>}
                    {formData.releaseOfGoods && <li>Arrange for release and delivery of goods</li>}
                    {formData.otherPowers && <li>{formData.otherPowers}</li>}
                  </ul>
                </CardContent>
              </Card>
              
              {/* Acknowledgment */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="acknowledgment"
                    checked={formData.acknowledgment}
                    onCheckedChange={(checked) => updateFormData('acknowledgment', checked)}
                  />
                  <Label htmlFor="acknowledgment" className="text-sm">
                    I acknowledge that I have read and understand this Power of Attorney, and I grant the above powers to Freightclear as my authorized agent for customs and import matters.
                  </Label>
                </div>
              </div>
              
              {/* Electronic Signature */}
              <div className="space-y-2">
                <Label htmlFor="electronicSignature">Electronic Signature *</Label>
                <Input
                  id="electronicSignature"
                  value={formData.electronicSignature}
                  onChange={(e) => updateFormData('electronicSignature', e.target.value)}
                  placeholder="Type your full legal name as your electronic signature"
                />
                <p className="text-xs text-gray-500">
                  By typing your name above, you agree that this constitutes your legal electronic signature.
                </p>
              </div>
              
              <div>
                <Label>Signature Date</Label>
                <Input value={formData.signatureDate} disabled className="bg-gray-50" />
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center text-xl">
            <FileText className="w-6 h-6 mr-3 text-freight-blue" />
            Power of Attorney for Customs Matters
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress Steps */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              {STEPS.map((step, index) => {
                const Icon = step.icon;
                const isActive = currentStep === step.id;
                const isCompleted = currentStep > step.id;
                
                return (
                  <div key={step.id} className="flex items-center">
                    <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                      isCompleted 
                        ? 'bg-green-100 border-green-500 text-green-700'
                        : isActive 
                        ? 'bg-freight-blue border-freight-blue text-white'
                        : 'bg-gray-100 border-gray-300 text-gray-500'
                    }`}>
                      {isCompleted ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        <Icon className="w-5 h-5" />
                      )}
                    </div>
                    {index < STEPS.length - 1 && (
                      <div className={`w-16 h-0.5 ml-2 ${
                        isCompleted ? 'bg-green-500' : 'bg-gray-300'
                      }`} />
                    )}
                  </div>
                );
              })}
            </div>
            
            <div className="text-center">
              <h3 className="font-semibold">{STEPS[currentStep - 1]?.title}</h3>
              <Progress value={(currentStep / STEPS.length) * 100} className="mt-2" />
            </div>
          </div>

          {/* Step Content */}
          <Card>
            <CardContent className="p-6">
              {renderStepContent()}
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={currentStep === 1}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>
            
            {currentStep < STEPS.length ? (
              <Button
                onClick={nextStep}
                disabled={!isStepValid()}
                className="bg-freight-blue hover:bg-freight-blue/90"
              >
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={!isStepValid() || submitPOAMutation.isPending}
                className="bg-freight-green hover:bg-freight-green/90"
              >
                {submitPOAMutation.isPending ? (
                  "Submitting..."
                ) : (
                  <>
                    <Signature className="w-4 h-4 mr-2" />
                    Sign & Submit
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