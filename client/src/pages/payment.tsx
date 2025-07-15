import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { CreditCard, Crown, Zap, Shield, CheckCircle, XCircle, Clock, AlertTriangle, Sparkles } from "lucide-react";

interface SubscriptionPlan {
  id: number;
  planName: string;
  displayName: string;
  description: string;
  monthlyPrice: string;
  yearlyPrice: string;
  maxShipments: number;
  maxDocuments: number;
  maxUsers: number;
  features: string[];
  isActive: boolean;
}

interface UserAccess {
  hasAccess: boolean;
  isTrialActive: boolean;
  subscriptionStatus: string;
  daysUntilExpiry: number;
  usageLimits: {
    shipments: { current: number; max: number; };
    documents: { current: number; max: number; };
  };
}

interface SubscriptionFormData {
  planName: string;
  billingCycle: string; // monthly, yearly
  paymentMethod: {
    cardNumber: string;
    expiryMonth: string;
    expiryYear: string;
    cardCode: string;
    cardholderName: string;
    zipCode: string;
  };
}

export default function Payment() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentType, setPaymentType] = useState<"subscription" | "invoice">("subscription");
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  
  const [subscriptionForm, setSubscriptionForm] = useState<SubscriptionFormData>({
    planName: "",
    billingCycle: "monthly",
    paymentMethod: {
      cardNumber: "",
      expiryMonth: "",
      expiryYear: "",
      cardCode: "",
      cardholderName: "",
      zipCode: ""
    }
  });

  const [invoiceForm, setInvoiceForm] = useState({
    invoiceNumber: "",
    amount: "",
    useStoredCard: false,
    paymentMethod: {
      cardNumber: "",
      expiryMonth: "",
      expiryYear: "",
      cardCode: "",
      cardholderName: "",
      zipCode: ""
    }
  });

  // Initialize invoice form with user profile data
  useEffect(() => {
    if (user) {
      setInvoiceForm(prev => ({
        ...prev,
        paymentMethod: {
          ...prev.paymentMethod,
          cardholderName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
          zipCode: ""
        }
      }));
    }
  }, [user]);

  // Fetch subscription plans
  const { data: subscriptionPlans = [] } = useQuery({
    queryKey: ["/api/subscription/plans"],
    retry: false,
  });

  // Fetch user access information
  const { data: userAccess } = useQuery({
    queryKey: ["/api/subscription/access"],
    retry: false,
    enabled: isAuthenticated,
  });

  // Check for API credentials
  const { data: apiConfig } = useQuery({
    queryKey: ["/api/payment/config"],
    retry: false,
  });

  const subscriptionMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("/api/subscription/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
    onSuccess: (result: any) => {
      if (result.success) {
        toast({
          title: "Subscription Activated!",
          description: `Welcome to ${selectedPlan?.displayName}! Your subscription is now active.`,
        });
        // Refresh user access data
        queryClient.invalidateQueries({ queryKey: ["/api/subscription/access"] });
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        setShowPaymentForm(false);
        setSelectedPlan(null);
      } else {
        toast({
          title: "Subscription Failed",
          description: result.error || "Unknown error occurred",
          variant: "destructive",
        });
      }
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
        title: "Subscription Error",
        description: error.message || "Subscription setup failed",
        variant: "destructive",
      });
      setIsProcessingPayment(false);
    },
  });

  const invoicePaymentMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("/api/payment/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
    onSuccess: (result: any) => {
      if (result.success) {
        toast({
          title: "Payment Successful!",
          description: `Invoice ${invoiceForm.invoiceNumber} has been paid successfully.`,
        });
        // Reset form
        setInvoiceForm({
          invoiceNumber: "",
          amount: "",
          useStoredCard: false,
          paymentMethod: {
            cardNumber: "",
            expiryMonth: "",
            expiryYear: "",
            cardCode: "",
            cardholderName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
            zipCode: ""
          }
        });
        setShowInvoiceForm(false);
      } else {
        toast({
          title: "Payment Failed",
          description: result.error || "Payment could not be processed",
          variant: "destructive",
        });
      }
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
        title: "Payment Error",
        description: error.message || "Payment processing failed",
        variant: "destructive",
      });
      setIsProcessingPayment(false);
    },
  });

  const handlePlanSelection = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    setSubscriptionForm(prev => ({
      ...prev,
      planName: plan.planName,
      billingCycle: billingCycle
    }));
    setShowPaymentForm(true);
  };

  const handleCardChange = (field: string, value: string) => {
    setSubscriptionForm(prev => ({
      ...prev,
      paymentMethod: {
        ...prev.paymentMethod,
        [field]: value
      }
    }));
  };

  const handleInvoiceCardChange = (field: string, value: string) => {
    setInvoiceForm(prev => ({
      ...prev,
      paymentMethod: {
        ...prev.paymentMethod,
        [field]: value
      }
    }));
  };

  const handleInvoiceFormChange = (field: string, value: string | boolean) => {
    setInvoiceForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleInvoicePaymentSubmit = () => {
    // Validate invoice form
    if (!invoiceForm.invoiceNumber || !invoiceForm.amount) {
      toast({
        title: "Missing Information",
        description: "Please fill in invoice number and amount",
        variant: "destructive",
      });
      return;
    }

    const amount = parseFloat(invoiceForm.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid payment amount",
        variant: "destructive",
      });
      return;
    }

    // If using stored card, process immediately
    if (invoiceForm.useStoredCard) {
      setIsProcessingPayment(true);
      invoicePaymentMutation.mutate({
        invoiceNumber: invoiceForm.invoiceNumber,
        amount: invoiceForm.amount,
        companyName: user?.firstName + " " + user?.lastName || "Customer",
        description: `Invoice payment for ${invoiceForm.invoiceNumber}`,
        useStoredCard: true
      });
      return;
    }

    // Validate new card information
    const { paymentMethod } = invoiceForm;
    if (!paymentMethod.cardNumber || !paymentMethod.expiryMonth || !paymentMethod.expiryYear || !paymentMethod.cardCode) {
      toast({
        title: "Missing Card Information",
        description: "Please fill in all payment details",
        variant: "destructive",
      });
      return;
    }

    setIsProcessingPayment(true);

    // Prepare data for Accept.js
    const authData = {
      clientKey: apiConfig?.clientKey,
      apiLoginID: apiConfig?.apiLoginId
    };

    const secureCardData = {
      cardNumber: paymentMethod.cardNumber,
      month: paymentMethod.expiryMonth,
      year: paymentMethod.expiryYear,
      cardCode: paymentMethod.cardCode,
      zip: paymentMethod.zipCode,
      fullName: paymentMethod.cardholderName
    };

    const secureData = {
      authData,
      cardData: secureCardData
    };

    // Use Accept.js to tokenize payment data
    if (window.Accept) {
      window.Accept.dispatchData(secureData, (response: any) => {
        if (response.messages.resultCode === 'Error') {
          toast({
            title: "Payment Error",
            description: response.messages.message[0].text,
            variant: "destructive",
          });
          setIsProcessingPayment(false);
          return;
        }

        // Process the invoice payment
        invoicePaymentMutation.mutate({
          invoiceNumber: invoiceForm.invoiceNumber,
          amount: invoiceForm.amount,
          companyName: user?.firstName + " " + user?.lastName || "Customer",
          description: `Invoice payment for ${invoiceForm.invoiceNumber}`,
          opaqueData: response.opaqueData,
          billingInfo: {
            firstName: user?.firstName,
            lastName: user?.lastName,
            zip: paymentMethod.zipCode
          }
        });
      });
    } else {
      toast({
        title: "Payment System Error",
        description: "Accept.js library not loaded",
        variant: "destructive",
      });
      setIsProcessingPayment(false);
    }
  };

  const handleSubscriptionSubmit = () => {
    if (!selectedPlan) return;

    // Validate payment method
    const { paymentMethod } = subscriptionForm;
    if (!paymentMethod.cardNumber || !paymentMethod.expiryMonth || !paymentMethod.expiryYear || !paymentMethod.cardCode) {
      toast({
        title: "Missing Card Information",
        description: "Please fill in all payment details",
        variant: "destructive",
      });
      return;
    }

    setIsProcessingPayment(true);

    // Prepare data for Accept.js
    const authData = {
      clientKey: apiConfig?.clientKey,
      apiLoginID: apiConfig?.apiLoginId
    };

    const secureCardData = {
      cardNumber: paymentMethod.cardNumber,
      month: paymentMethod.expiryMonth,
      year: paymentMethod.expiryYear,
      cardCode: paymentMethod.cardCode,
      zip: paymentMethod.zipCode,
      fullName: paymentMethod.cardholderName
    };

    const secureData = {
      authData,
      cardData: secureCardData
    };

    // Use Accept.js to tokenize payment data
    if (window.Accept) {
      window.Accept.dispatchData(secureData, (response: any) => {
        if (response.messages.resultCode === 'Error') {
          toast({
            title: "Payment Error",
            description: response.messages.message[0].text,
            variant: "destructive",
          });
          setIsProcessingPayment(false);
          return;
        }

        // Success - create subscription with nonce
        const subscriptionData = {
          planName: selectedPlan.planName,
          billingCycle: billingCycle,
          opaqueData: {
            dataDescriptor: response.opaqueData.dataDescriptor,
            dataValue: response.opaqueData.dataValue
          },
          billingInfo: {
            firstName: paymentMethod.cardholderName.split(' ')[0] || '',
            lastName: paymentMethod.cardholderName.split(' ').slice(1).join(' ') || '',
            company: user?.companyName || '',
            zip: paymentMethod.zipCode
          }
        };

        subscriptionMutation.mutate(subscriptionData);
      });
    } else {
      toast({
        title: "Payment System Error",
        description: "Accept.js library not loaded. Please refresh the page.",
        variant: "destructive",
      });
      setIsProcessingPayment(false);
    }
  };

  const getPlanIcon = (planName: string) => {
    switch (planName) {
      case 'free': return <Sparkles className="w-6 h-6" />;
      case 'pro': return <Crown className="w-6 h-6" />;
      default: return <Zap className="w-6 h-6" />;
    }
  };

  const getPlanColor = (planName: string) => {
    switch (planName) {
      case 'free': return 'from-teal-500 to-freight-blue';
      case 'pro': return 'from-freight-orange to-amber-500';
      default: return 'from-gray-400 to-gray-600';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-gray-500 mb-4">Please log in to access payment services</p>
            <Button
              onClick={() => window.location.href = "/api/login"}
              className="btn-primary"
            >
              Log In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!apiConfig?.success) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="w-full max-w-2xl mx-auto">
          <CardContent className="p-6 text-center">
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Payment System Not Configured</h2>
            <p className="text-gray-500">
              Authorize.Net credentials are required to process payments. Please contact your administrator.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!showPaymentForm && !showInvoiceForm) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-freight-dark mb-4">
              Payment Options
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Choose how you'd like to pay - manage your subscription or pay an invoice.
            </p>
          </div>

          {/* Payment Type Selection */}
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <Card className="border-2 border-teal hover:border-teal-dark transition-colors cursor-pointer"
                  onClick={() => setPaymentType("subscription")}>
              <CardHeader className="text-center">
                <Crown className="w-12 h-12 text-teal mx-auto mb-4" />
                <CardTitle className="text-2xl text-freight-dark">Subscription Management</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 text-center mb-4">
                  Choose your Freightclear plan and manage your subscription
                </p>
                <ul className="text-sm text-gray-500 space-y-2">
                  <li>• Monthly or yearly billing</li>
                  <li>• Automatic renewal</li>
                  <li>• Usage tracking</li>
                  <li>• Plan upgrades</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-2 border-green-400 hover:border-green-600 transition-colors cursor-pointer"
                  onClick={() => {
                    setPaymentType("invoice");
                    setShowInvoiceForm(true);
                  }}>
              <CardHeader className="text-center">
                <CreditCard className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <CardTitle className="text-2xl text-freight-dark">Invoice Payment</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 text-center mb-4">
                  Pay a specific invoice with your credit card
                </p>
                <ul className="text-sm text-gray-500 space-y-2">
                  <li>• One-time payments</li>
                  <li>• Custom amounts</li>
                  <li>• Instant processing</li>
                  <li>• Use stored card or new card</li>
                </ul>
              </CardContent>
            </Card>
          </div>

          {paymentType === "subscription" && (
            <>
              {/* Subscription Plans Header */}
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-freight-dark mb-4">
                  Choose Your Freightclear Plan
                </h2>
                <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                  Streamline your import operations with our comprehensive logistics platform. 
                  Start your journey with a free trial.
                </p>
              </div>

              {/* Current Plan Status */}
              {userAccess && (
                <Card className="mb-8 border-l-4 border-l-teal">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className={`p-3 rounded-full ${userAccess.isTrialActive ? 'bg-blue-100' : 'bg-green-100'}`}>
                          {userAccess.isTrialActive ? <Clock className="w-6 h-6 text-blue-600" /> : <CheckCircle className="w-6 h-6 text-green-600" />}
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-freight-dark">
                            {userAccess.isTrialActive ? 'Free Trial Active' : `${userAccess.subscriptionStatus.toUpperCase()} Subscription`}
                          </h3>
                          <p className="text-gray-600">
                            {userAccess.daysUntilExpiry > 0 
                              ? `${userAccess.daysUntilExpiry} days remaining`
                              : 'Plan expired'
                            }
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex space-x-6">
                          <div>
                            <p className="text-sm text-gray-500">Shipments</p>
                            <p className="text-lg font-semibold">{userAccess.usageLimits.shipments.current}/{userAccess.usageLimits.shipments.max}</p>
                            <Progress 
                              value={(userAccess.usageLimits.shipments.current / userAccess.usageLimits.shipments.max) * 100} 
                              className="w-20 h-2"
                            />
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Documents</p>
                            <p className="text-lg font-semibold">{userAccess.usageLimits.documents.current}/{userAccess.usageLimits.documents.max}</p>
                            <Progress 
                              value={(userAccess.usageLimits.documents.current / userAccess.usageLimits.documents.max) * 100} 
                              className="w-20 h-2"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Billing Toggle */}
              <div className="flex justify-center mb-8">
                <div className="bg-gray-100 rounded-lg p-1">
                  <Button
                    variant={billingCycle === "monthly" ? "default" : "ghost"}
                    onClick={() => setBillingCycle("monthly")}
                    className="rounded-md"
                  >
                    Monthly
                  </Button>
                  <Button
                    variant={billingCycle === "yearly" ? "default" : "ghost"}
                    onClick={() => setBillingCycle("yearly")}
                    className="rounded-md"
                  >
                    Yearly
                    <Badge className="ml-2 bg-green-500">Save 20%</Badge>
                  </Button>
                </div>
              </div>

              {/* Subscription Plans Grid */}
              <div className="grid md:grid-cols-2 gap-8">
                {subscriptionPlans.map((plan) => {
                  const isCurrentPlan = userAccess?.subscriptionStatus === plan.planName;
                  const monthlyPrice = parseFloat(plan.monthlyPrice);
                  const yearlyPrice = parseFloat(plan.yearlyPrice);
                  const yearlyMonthlyPrice = yearlyPrice / 12;
                  const savings = monthlyPrice - yearlyMonthlyPrice;
                  
                  return (
                    <Card key={plan.id} className={`relative overflow-hidden transition-all duration-300 hover:shadow-lg ${
                      isCurrentPlan ? 'border-2 border-teal-500 shadow-lg' : 'border hover:border-teal-300'
                    } ${plan.planName === 'pro' ? 'border-freight-orange' : ''}`}>
                      
                      {/* Plan Badge */}
                      {plan.planName === 'pro' && (
                        <div className="absolute top-0 right-0 bg-gradient-to-r from-freight-orange to-amber-500 text-white px-3 py-1 rounded-bl-lg">
                          <span className="text-sm font-semibold">MOST POPULAR</span>
                        </div>
                      )}

                      {isCurrentPlan && (
                        <div className="absolute top-0 left-0 bg-teal-500 text-white px-3 py-1 rounded-br-lg">
                          <span className="text-sm font-semibold">CURRENT PLAN</span>
                        </div>
                      )}

                      <CardHeader className="pb-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={`p-3 rounded-full bg-gradient-to-r ${getPlanColor(plan.planName)}`}>
                              {getPlanIcon(plan.planName)}
                            </div>
                            <div>
                              <CardTitle className="text-2xl text-freight-dark">{plan.displayName}</CardTitle>
                              <p className="text-sm text-gray-500 mt-1">{plan.description}</p>
                            </div>
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent>
                        {/* Pricing */}
                        <div className="mb-6">
                          <div className="flex items-baseline space-x-2">
                            <span className="text-4xl font-bold text-freight-dark">
                              ${billingCycle === 'monthly' ? monthlyPrice : yearlyMonthlyPrice.toFixed(0)}
                            </span>
                            <span className="text-gray-500">/month</span>
                          </div>
                          {billingCycle === 'yearly' && savings > 0 && (
                            <p className="text-sm text-green-600 mt-1">
                              Save ${savings.toFixed(0)}/month with yearly billing
                            </p>
                          )}
                          {billingCycle === 'yearly' && (
                            <p className="text-sm text-gray-500 mt-1">
                              Billed annually: ${yearlyPrice}/year
                            </p>
                          )}
                        </div>

                        {/* Features */}
                        <div className="space-y-3 mb-6">
                          {plan.features.map((feature, index) => (
                            <div key={index} className="flex items-center space-x-2">
                              <CheckCircle className="w-5 h-5 text-teal-500 flex-shrink-0" />
                              <span className="text-sm text-gray-600">{feature}</span>
                            </div>
                          ))}
                        </div>

                        {/* Action Button */}
                        <Button
                          onClick={() => handlePlanSelection(plan)}
                          disabled={isCurrentPlan || plan.planName === 'free'}
                          className={`w-full py-3 ${
                            isCurrentPlan 
                              ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
                              : plan.planName === 'free'
                              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                              : 'btn-primary'
                          }`}
                        >
                          {isCurrentPlan ? 'Current Plan' : 
                           plan.planName === 'free' ? 'Free Plan' : 
                           `Choose ${plan.displayName}`}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Invoice Payment Form
  if (showInvoiceForm) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl text-freight-dark">Invoice Payment</CardTitle>
                  <p className="text-gray-600 mt-1">Pay your invoice with a credit card</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowInvoiceForm(false);
                    setPaymentType("subscription");
                  }}
                >
                  Back to Options
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Customer Information */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-freight-dark mb-3">Customer Information</h3>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">
                    <strong>Name:</strong> {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-sm text-gray-600 mb-2">
                    <strong>Email:</strong> {user?.email}
                  </p>
                  {user?.companyName && (
                    <p className="text-sm text-gray-600">
                      <strong>Company:</strong> {user?.companyName}
                    </p>
                  )}
                </div>
              </div>

              {/* Invoice Details */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-freight-dark mb-3">Invoice Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="invoiceNumber">Invoice Number</Label>
                    <Input
                      id="invoiceNumber"
                      placeholder="INV-2025-001"
                      value={invoiceForm.invoiceNumber}
                      onChange={(e) => handleInvoiceFormChange('invoiceNumber', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="amount">Amount ($)</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={invoiceForm.amount}
                      onChange={(e) => handleInvoiceFormChange('amount', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Payment Method Selection */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-freight-dark mb-3">Payment Method</h3>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="useStoredCard"
                      name="paymentMethod"
                      checked={invoiceForm.useStoredCard}
                      onChange={(e) => handleInvoiceFormChange('useStoredCard', e.target.checked)}
                      className="focus:ring-teal-500"
                    />
                    <Label htmlFor="useStoredCard">Use stored credit card on file</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="newCard"
                      name="paymentMethod"
                      checked={!invoiceForm.useStoredCard}
                      onChange={(e) => handleInvoiceFormChange('useStoredCard', !e.target.checked)}
                      className="focus:ring-teal-500"
                    />
                    <Label htmlFor="newCard">Enter new credit card</Label>
                  </div>
                </div>
              </div>

              {/* New Card Form */}
              {!invoiceForm.useStoredCard && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-freight-dark mb-3">Credit Card Information</h3>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <Label htmlFor="cardholderName">Cardholder Name</Label>
                      <Input
                        id="cardholderName"
                        placeholder="John Doe"
                        value={invoiceForm.paymentMethod.cardholderName}
                        onChange={(e) => handleInvoiceCardChange('cardholderName', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="zipCode">ZIP Code</Label>
                      <Input
                        id="zipCode"
                        placeholder="12345"
                        value={invoiceForm.paymentMethod.zipCode}
                        onChange={(e) => handleInvoiceCardChange('zipCode', e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <Label htmlFor="cardNumber">Card Number</Label>
                    <Input
                      id="cardNumber"
                      placeholder="1234 5678 9012 3456"
                      value={invoiceForm.paymentMethod.cardNumber}
                      onChange={(e) => handleInvoiceCardChange('cardNumber', e.target.value)}
                    />
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="expiryMonth">Expiry Month</Label>
                      <Input
                        id="expiryMonth"
                        placeholder="MM"
                        maxLength={2}
                        value={invoiceForm.paymentMethod.expiryMonth}
                        onChange={(e) => handleInvoiceCardChange('expiryMonth', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="expiryYear">Expiry Year</Label>
                      <Input
                        id="expiryYear"
                        placeholder="YYYY"
                        maxLength={4}
                        value={invoiceForm.paymentMethod.expiryYear}
                        onChange={(e) => handleInvoiceCardChange('expiryYear', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="cardCode">CVV</Label>
                      <Input
                        id="cardCode"
                        placeholder="123"
                        maxLength={4}
                        value={invoiceForm.paymentMethod.cardCode}
                        onChange={(e) => handleInvoiceCardChange('cardCode', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-4">
                <Button
                  onClick={handleInvoicePaymentSubmit}
                  disabled={isProcessingPayment}
                  className="w-full btn-primary py-3"
                >
                  {isProcessingPayment ? 'Processing Payment...' : `Pay $${invoiceForm.amount || '0.00'}`}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Subscription payment form
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl text-freight-dark">
                  {selectedPlan?.displayName} Subscription
                </CardTitle>
                <p className="text-gray-600 mt-1">
                  Complete your subscription to {selectedPlan?.displayName}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setShowPaymentForm(false);
                  setSelectedPlan(null);
                }}
              >
                Back to Plans
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-8">
              {/* Order Summary */}
              <div>
                <h3 className="text-lg font-semibold text-freight-dark mb-4">Order Summary</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-600">Plan:</span>
                    <span className="font-semibold">{selectedPlan?.displayName}</span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-600">Billing:</span>
                    <span className="font-semibold">{billingCycle}</span>
                  </div>
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-gray-600">Amount:</span>
                    <span className="font-semibold text-xl">
                      ${billingCycle === 'monthly' ? selectedPlan?.monthlyPrice : selectedPlan?.yearlyPrice}
                      {billingCycle === 'yearly' ? '/year' : '/month'}
                    </span>
                  </div>
                  <div className="border-t pt-4">
                    <div className="space-y-2">
                      {selectedPlan?.features.map((feature, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <CheckCircle className="w-4 h-4 text-teal-500" />
                          <span className="text-sm text-gray-600">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Form */}
              <div>
                <h3 className="text-lg font-semibold text-freight-dark mb-4">Payment Information</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="cardholderName">Cardholder Name</Label>
                      <Input
                        id="cardholderName"
                        placeholder="John Doe"
                        value={subscriptionForm.paymentMethod.cardholderName}
                        onChange={(e) => handleCardChange('cardholderName', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="zipCode">ZIP Code</Label>
                      <Input
                        id="zipCode"
                        placeholder="12345"
                        value={subscriptionForm.paymentMethod.zipCode}
                        onChange={(e) => handleCardChange('zipCode', e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="cardNumber">Card Number</Label>
                    <Input
                      id="cardNumber"
                      placeholder="1234 5678 9012 3456"
                      value={subscriptionForm.paymentMethod.cardNumber}
                      onChange={(e) => handleCardChange('cardNumber', e.target.value)}
                    />
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="expiryMonth">Expiry Month</Label>
                      <Input
                        id="expiryMonth"
                        placeholder="MM"
                        maxLength={2}
                        value={subscriptionForm.paymentMethod.expiryMonth}
                        onChange={(e) => handleCardChange('expiryMonth', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="expiryYear">Expiry Year</Label>
                      <Input
                        id="expiryYear"
                        placeholder="YYYY"
                        maxLength={4}
                        value={subscriptionForm.paymentMethod.expiryYear}
                        onChange={(e) => handleCardChange('expiryYear', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="cardCode">CVV</Label>
                      <Input
                        id="cardCode"
                        placeholder="123"
                        maxLength={4}
                        value={subscriptionForm.paymentMethod.cardCode}
                        onChange={(e) => handleCardChange('cardCode', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-6 mt-6 border-t">
              <Button
                onClick={handleSubscriptionSubmit}
                disabled={isProcessingPayment}
                className="w-full btn-primary py-3"
              >
                {isProcessingPayment ? 'Processing Payment...' : `Subscribe to ${selectedPlan?.displayName}`}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Extend window interface for Accept.js
declare global {
  interface Window {
    Accept: any;
  }
}