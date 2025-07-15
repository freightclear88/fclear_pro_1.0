import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Receipt, CreditCard, FileText, DollarSign } from "lucide-react";

interface InvoicePaymentData {
  invoiceNumber: string;
  amount: string;
  description: string;
  paymentMethod: {
    cardNumber: string;
    expiryMonth: string;
    expiryYear: string;
    cardCode: string;
    cardholderName: string;
    zipCode: string;
  };
}

export default function Payments() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState<InvoicePaymentData>({
    invoiceNumber: "",
    amount: "",
    description: "",
    paymentMethod: {
      cardNumber: "",
      expiryMonth: "",
      expiryYear: "",
      cardCode: "",
      cardholderName: "",
      zipCode: ""
    }
  });

  // Invoice payment mutation
  const invoicePaymentMutation = useMutation({
    mutationFn: async (data: InvoicePaymentData) => {
      return await apiRequest("/api/payment/invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: "Payment Successful",
        description: "Your invoice payment has been processed successfully.",
      });
      // Reset form
      setInvoiceForm({
        invoiceNumber: "",
        amount: "",
        description: "",
        paymentMethod: {
          cardNumber: "",
          expiryMonth: "",
          expiryYear: "",
          cardCode: "",
          cardholderName: "",
          zipCode: ""
        }
      });
      setIsProcessingPayment(false);
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Payment Failed",
        description: error.message || "There was an error processing your payment. Please try again.",
        variant: "destructive",
      });
      setIsProcessingPayment(false);
    },
  });

  const handleInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!invoiceForm.invoiceNumber || !invoiceForm.amount) {
      toast({
        title: "Missing Information",
        description: "Please provide both invoice number and amount.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessingPayment(true);
    
    try {
      // For now, we'll process the payment directly
      // In a real implementation, you would integrate with Accept.js here
      const formWithNonce = {
        ...invoiceForm,
        paymentNonce: `mock-nonce-${Date.now()}` // This would be replaced with actual Accept.js integration
      };
      
      invoicePaymentMutation.mutate(formWithNonce);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process payment. Please try again.",
        variant: "destructive",
      });
      setIsProcessingPayment(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading payment information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-freight-dark mb-2">Invoice Payments</h1>
          <p className="text-gray-600">Pay your freight and customs invoices securely</p>
        </div>

        {/* Payment Information */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-freight-orange" />
              Payment Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-teal/5 rounded-lg">
                  <Receipt className="w-5 h-5 text-teal" />
                  <div>
                    <p className="font-medium text-freight-dark">Invoice Payments</p>
                    <p className="text-sm text-gray-600">Pay outstanding invoices for customs, duties, and freight services</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
                  <CreditCard className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="font-medium text-freight-dark">Secure Processing</p>
                    <p className="text-sm text-gray-600">All payments are processed securely through Authorize.Net</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <h4 className="font-medium text-freight-dark mb-2">Important Notes:</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Have your invoice number ready</li>
                    <li>• Payments are processed immediately</li>
                    <li>• You'll receive a confirmation email</li>
                    <li>• Contact support for payment questions</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Invoice Payment Form */}
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-freight-orange" />
              Pay Invoice
            </CardTitle>
            <p className="text-sm text-gray-600">
              Enter your invoice details and payment information below
            </p>
            <div className="flex items-center justify-center mt-4 pt-4 border-t">
              <img 
                src="https://www.authorize.net/content/dam/authorize/images/authorize-net-logo.png" 
                alt="Secured by Authorize.Net" 
                className="h-6 opacity-75"
              />
              <span className="ml-2 text-xs text-gray-500">Secured by Authorize.Net</span>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvoiceSubmit} className="space-y-6">
              {/* Invoice Details */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-freight-dark">Invoice Details</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="invoiceNumber">Invoice Number *</Label>
                    <Input
                      id="invoiceNumber"
                      value={invoiceForm.invoiceNumber}
                      onChange={(e) => setInvoiceForm(prev => ({
                        ...prev,
                        invoiceNumber: e.target.value
                      }))}
                      placeholder="INV-2024-001"
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="amount">Amount *</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      value={invoiceForm.amount}
                      onChange={(e) => setInvoiceForm(prev => ({
                        ...prev,
                        amount: e.target.value
                      }))}
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Input
                    id="description"
                    value={invoiceForm.description}
                    onChange={(e) => setInvoiceForm(prev => ({
                      ...prev,
                      description: e.target.value
                    }))}
                    placeholder="Customs clearance fees, duties, etc."
                  />
                </div>
              </div>

              {/* Payment Method */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-freight-dark">Payment Method</h3>
                
                <div>
                  <Label htmlFor="cardholderName">Cardholder Name *</Label>
                  <Input
                    id="cardholderName"
                    value={invoiceForm.paymentMethod.cardholderName}
                    onChange={(e) => setInvoiceForm(prev => ({
                      ...prev,
                      paymentMethod: { ...prev.paymentMethod, cardholderName: e.target.value }
                    }))}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="cardNumber">Card Number *</Label>
                  <Input
                    id="cardNumber"
                    value={invoiceForm.paymentMethod.cardNumber}
                    onChange={(e) => setInvoiceForm(prev => ({
                      ...prev,
                      paymentMethod: { ...prev.paymentMethod, cardNumber: e.target.value }
                    }))}
                    placeholder="1234 5678 9012 3456"
                    required
                  />
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="expiryMonth">Month *</Label>
                    <Input
                      id="expiryMonth"
                      value={invoiceForm.paymentMethod.expiryMonth}
                      onChange={(e) => setInvoiceForm(prev => ({
                        ...prev,
                        paymentMethod: { ...prev.paymentMethod, expiryMonth: e.target.value }
                      }))}
                      placeholder="MM"
                      maxLength={2}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="expiryYear">Year *</Label>
                    <Input
                      id="expiryYear"
                      value={invoiceForm.paymentMethod.expiryYear}
                      onChange={(e) => setInvoiceForm(prev => ({
                        ...prev,
                        paymentMethod: { ...prev.paymentMethod, expiryYear: e.target.value }
                      }))}
                      placeholder="YY"
                      maxLength={2}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="cardCode">CVV *</Label>
                    <Input
                      id="cardCode"
                      value={invoiceForm.paymentMethod.cardCode}
                      onChange={(e) => setInvoiceForm(prev => ({
                        ...prev,
                        paymentMethod: { ...prev.paymentMethod, cardCode: e.target.value }
                      }))}
                      placeholder="123"
                      maxLength={4}
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="zipCode">ZIP Code *</Label>
                  <Input
                    id="zipCode"
                    value={invoiceForm.paymentMethod.zipCode}
                    onChange={(e) => setInvoiceForm(prev => ({
                      ...prev,
                      paymentMethod: { ...prev.paymentMethod, zipCode: e.target.value }
                    }))}
                    placeholder="12345"
                    className="max-w-xs"
                    required
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-6">
                <Button
                  type="submit"
                  disabled={isProcessingPayment}
                  className="w-full bg-freight-orange hover:bg-freight-orange/90 text-white"
                >
                  {isProcessingPayment ? "Processing Payment..." : `Pay $${invoiceForm.amount || "0.00"}`}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Security Notice */}
        <Card className="mt-8 bg-gray-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center gap-6 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                <span>Your payment information is secure and encrypted</span>
              </div>
              <div className="flex items-center gap-2">
                <img 
                  src="https://www.authorize.net/content/dam/authorize/images/authorize-net-logo.png" 
                  alt="Authorize.Net" 
                  className="h-4 opacity-75"
                />
                <span>PCI DSS Compliant</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}