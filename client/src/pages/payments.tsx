import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Receipt, CreditCard, FileText, DollarSign, Eye, Download, AlertCircle } from "lucide-react";
import type { Document } from "@shared/schema";

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
    companyName: string;
    zipCode: string;
  };
}

export default function Payments() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const [selectedInvoice, setSelectedInvoice] = useState<Document | null>(null);
  const [isInvoiceViewOpen, setIsInvoiceViewOpen] = useState(false);

  // Query to get shipping invoices
  const { data: shippingInvoices = [] } = useQuery({
    queryKey: ["/api/documents/category/shipping_invoice"],
    enabled: isAuthenticated,
  });
  
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
      companyName: "",
      zipCode: ""
    }
  });

  // Calculate service fee and total (automatically applied)
  const baseAmount = parseFloat(invoiceForm.amount) || 0;
  const serviceFeeRate = 0.035; // 3.5%
  const serviceFee = baseAmount * serviceFeeRate;
  const totalAmount = baseAmount + serviceFee;

  // Pre-populate form with user data when user loads
  useEffect(() => {
    if (user) {
      setInvoiceForm(prev => ({
        ...prev,
        paymentMethod: {
          ...prev.paymentMethod,
          cardholderName: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : "",
          companyName: user.companyName || "",
          zipCode: user.zipCode || ""
        }
      }));
    }
  }, [user]);

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
        description: `Payment for invoice ${invoiceForm.invoiceNumber} has been processed successfully. Total: $${totalAmount.toFixed(2)} (including $${serviceFee.toFixed(2)} service fee)`,
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
          cardholderName: user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : "",
          companyName: user?.companyName || "",
          zipCode: user?.zipCode || ""
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

  const handleViewInvoice = (invoice: Document) => {
    setSelectedInvoice(invoice);
    setIsInvoiceViewOpen(true);
  };

  const handleDownloadInvoice = async (invoice: Document) => {
    try {
      const response = await fetch(`/api/documents/${invoice.id}/download`);
      if (!response.ok) throw new Error("Download failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = invoice.originalName || invoice.fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Download Started",
        description: `${invoice.originalName} download started successfully.`,
      });
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Failed to download document. Please try again.",
        variant: "destructive",
      });
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
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-freight-dark mb-2">Invoice Payments</h1>
          <p className="text-gray-600">Pay your freight and customs invoices securely</p>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Shipping Invoices List - 35% */}
          <div className="lg:col-span-4 xl:col-span-3">
            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-freight-blue" />
                  Shipping Invoices ({shippingInvoices.length})
                </CardTitle>
                <p className="text-sm text-gray-600">
                  View and download your shipping invoices
                </p>
              </CardHeader>
              <CardContent>
                {shippingInvoices.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>No shipping invoices available</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {shippingInvoices.map((invoice: Document) => (
                      <div key={invoice.id} className="p-3 border rounded-lg bg-gray-50">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <Receipt className="w-4 h-4 text-freight-blue flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <h4 className="text-sm font-medium truncate">
                                {invoice.invoiceNumber || invoice.originalName || invoice.fileName}
                              </h4>
                              <div className="space-y-1">
                                {invoice.invoiceAmount && (
                                  <p className="text-sm font-medium text-green-600">
                                    ${parseFloat(invoice.invoiceAmount).toFixed(2)} USD
                                  </p>
                                )}
                                <p className="text-xs text-gray-500">
                                  {invoice.emailSentAt ? `Sent: ${new Date(invoice.emailSentAt).toLocaleDateString()}` 
                                    : `Created: ${new Date(invoice.createdAt).toLocaleDateString()}`}
                                </p>
                                {invoice.dueDate && (
                                  <p className="text-xs text-gray-500">
                                    Due: {new Date(invoice.dueDate).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                              {invoice.invoiceStatus && (
                                <div className="mt-2">
                                  <Badge 
                                    variant={invoice.invoiceStatus === 'paid' ? 'default' : 
                                           invoice.invoiceStatus === 'overdue' ? 'destructive' : 'secondary'}
                                    className="text-xs"
                                  >
                                    {invoice.invoiceStatus.charAt(0).toUpperCase() + invoice.invoiceStatus.slice(1)}
                                  </Badge>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewInvoice(invoice)}
                            className="h-7 px-2 text-xs flex-1 sm:flex-none"
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            View
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadInvoice(invoice)}
                            className="h-7 px-2 text-xs flex-1 sm:flex-none"
                          >
                            <Download className="w-3 h-3 mr-1" />
                            Download
                          </Button>
                          {invoice.invoiceStatus !== 'paid' && invoice.invoiceAmount && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setInvoiceForm(prev => ({
                                  ...prev,
                                  invoiceNumber: invoice.invoiceNumber || '',
                                  amount: invoice.invoiceAmount?.toString() || '',
                                  description: `Payment for invoice ${invoice.invoiceNumber || invoice.originalName}`
                                }));
                              }}
                              className="h-7 px-2 text-xs flex-1 sm:flex-none btn-primary"
                            >
                              <CreditCard className="w-3 h-3 mr-1" />
                              Pay Now
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Payment Area - 65% */}
          <div className="lg:col-span-8 xl:col-span-9">
            <div className="space-y-8">
              {/* Payment Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-freight-orange" />
                    Payment Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
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
                    
                    <div className="space-y-4">
                      <div className="bg-green-50 p-4 rounded-lg">
                        <h4 className="font-medium text-freight-dark mb-2">Payment Security:</h4>
                        <ul className="text-sm text-gray-600 space-y-1">
                          <li>• 256-bit SSL encryption</li>
                          <li>• PCI DSS compliant</li>
                          <li>• No card data stored</li>
                          <li>• Fraud protection enabled</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Invoice Payment Form */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-freight-orange" />
                    Pay Invoice
                  </CardTitle>
                  <p className="text-sm text-gray-600">
                    Enter your invoice details and payment information below
                  </p>
                  <div className="flex items-center justify-center mt-4 pt-4 border-t">
                    <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                        <line x1="8" y1="21" x2="16" y2="21"/>
                        <line x1="12" y1="17" x2="12" y2="21"/>
                      </svg>
                      <span className="text-xs text-gray-600 font-medium">Secured by Authorize.Net</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleInvoiceSubmit} className="space-y-6">
                    {/* Invoice Details */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-freight-dark">Invoice Details</h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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

              {/* Payment Summary */}
              <div className="space-y-4 border-t pt-4">
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <h4 className="font-medium text-freight-dark mb-2">Payment Summary</h4>
                  <div className="flex justify-between text-sm">
                    <span>Invoice Amount:</span>
                    <span>${baseAmount.toFixed(2)}</span>
                  </div>
                  {baseAmount > 0 && (
                    <div className="flex justify-between text-sm text-orange-600">
                      <span>Credit Card Service Fee (3.5%):</span>
                      <span>${serviceFee.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="border-t pt-2 flex justify-between font-medium">
                    <span>Total Amount:</span>
                    <span>${totalAmount.toFixed(2)}</span>
                  </div>
                  {baseAmount > 0 && (
                    <div className="flex items-start gap-2 mt-3 p-3 bg-yellow-50 rounded border">
                      <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                      <div className="text-xs text-yellow-800">
                        <p className="font-medium">Service Fee Notice:</p>
                        <p>A 3.5% service fee is automatically applied to all credit card transactions to cover processing costs. This fee is capped at 3.5% as permitted by law.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Method */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-freight-dark">Payment Method</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="cardholderName">Cardholder Name *</Label>
                    <Input
                      id="cardholderName"
                      value={invoiceForm.paymentMethod.cardholderName}
                      onChange={(e) => setInvoiceForm(prev => ({
                        ...prev,
                        paymentMethod: { ...prev.paymentMethod, cardholderName: e.target.value }
                      }))}
                      placeholder="John Doe"
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="companyName">Company Name</Label>
                    <Input
                      id="companyName"
                      value={invoiceForm.paymentMethod.companyName}
                      onChange={(e) => setInvoiceForm(prev => ({
                        ...prev,
                        paymentMethod: { ...prev.paymentMethod, companyName: e.target.value }
                      }))}
                      placeholder="Company LLC"
                    />
                  </div>
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
                
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
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
                      required
                    />
                  </div>
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
                        <div className="flex items-center gap-1 bg-blue-50 px-2 py-1 rounded">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                            <line x1="8" y1="21" x2="16" y2="21"/>
                            <line x1="12" y1="17" x2="12" y2="21"/>
                          </svg>
                          <span className="text-xs text-blue-600 font-medium">Authorize.Net</span>
                        </div>
                        <span>PCI DSS Compliant</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>

      {/* Invoice View Dialog */}
      <Dialog open={isInvoiceViewOpen} onOpenChange={setIsInvoiceViewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedInvoice ? `View Invoice: ${selectedInvoice.originalName || selectedInvoice.fileName}` : "View Invoice"}
            </DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Receipt className="w-5 h-5 text-freight-blue" />
                  <div>
                    <h3 className="font-medium">{selectedInvoice.originalName || selectedInvoice.fileName}</h3>
                    <p className="text-sm text-gray-600">
                      Uploaded: {new Date(selectedInvoice.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownloadInvoice(selectedInvoice)}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              </div>
              
              {selectedInvoice.fileType === 'application/pdf' ? (
                <div className="border rounded-lg overflow-hidden">
                  <iframe
                    src={`/api/documents/${selectedInvoice.id}/view`}
                    width="100%"
                    height="600"
                    title="Document Preview"
                    className="border-0"
                  />
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>Preview not available for this file type</p>
                  <p className="text-sm">Click "Download" to view the document</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}