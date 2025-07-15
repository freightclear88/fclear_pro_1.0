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

  if (!showPaymentForm) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-freight-dark mb-4">
              Choose Your Freightclear Plan
            </h1>
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

          {/* Subscription Plans */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-8">
            {subscriptionPlans.map((plan: SubscriptionPlan) => {
              const price = billingCycle === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
              const isPopular = plan.planName === 'pro';
              
              return (
                <Card 
                  key={plan.id} 
                  className={`relative overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-lg ${
                    isPopular ? 'border-2 border-freight-orange shadow-lg' : ''
                  }`}
                >
                  {isPopular && (
                    <div className="absolute top-0 left-0 right-0">
                      <div className="bg-gradient-to-r from-freight-orange to-amber-500 text-white text-center py-2 text-sm font-medium">
                        Most Popular
                      </div>
                    </div>
                  )}
                  
                  <CardHeader className={`text-center ${isPopular ? 'pt-12' : 'pt-6'}`}>
                    <div className={`mx-auto p-3 rounded-full bg-gradient-to-r ${getPlanColor(plan.planName)} mb-4`}>
                      <div className="text-white">
                        {getPlanIcon(plan.planName)}
                      </div>
                    </div>
                    <CardTitle className="text-xl font-bold text-freight-dark">{plan.displayName}</CardTitle>
                    <div className="mt-4">
                      <span className="text-3xl font-bold text-freight-dark">${price}</span>
                      <span className="text-gray-500">/{billingCycle === "yearly" ? "year" : "month"}</span>
                    </div>
                    {billingCycle === "yearly" && (
                      <p className="text-sm text-green-600 font-medium">20% off annual billing</p>
                    )}
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    <p className="text-gray-600 text-center">{plan.description}</p>
                    
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Shipments/month</span>
                        <span className="font-semibold">{plan.maxShipments === -1 ? 'Unlimited' : plan.maxShipments}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Documents/month</span>
                        <span className="font-semibold">{plan.maxDocuments === -1 ? 'Unlimited' : plan.maxDocuments}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Team members</span>
                        <span className="font-semibold">{plan.maxUsers === -1 ? 'Unlimited' : plan.maxUsers}</span>
                      </div>
                    </div>

                    <div className="space-y-2 pt-4">
                      {plan.features.map((feature: string, index: number) => (
                        <div key={index} className="flex items-center space-x-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span className="text-sm text-gray-600">{feature}</span>
                        </div>
                      ))}
                    </div>

                    <Button
                      onClick={() => handlePlanSelection(plan)}
                      className={`w-full mt-6 ${
                        plan.planName === 'free'
                          ? 'btn-outline-primary'
                          : isPopular 
                          ? 'bg-gradient-to-r from-freight-orange to-amber-500 hover:from-amber-500 hover:to-freight-orange' 
                          : 'btn-primary'
                      }`}
                    >
                      {plan.planName === 'free' ? 'Start Free' : `Choose ${plan.displayName}`}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Features Comparison */}
          <Card className="border-0 bg-gradient-to-r from-teal/10 to-freight-blue/10">
            <CardContent className="p-8 text-center">
              <h3 className="text-2xl font-bold text-freight-dark mb-4">Why Choose Freightclear?</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Shield className="w-8 h-8 text-freight-blue mx-auto" />
                  <h4 className="font-semibold">Secure & Compliant</h4>
                  <p className="text-sm text-gray-600">Bank-level security with full customs compliance</p>
                </div>
                <div className="space-y-2">
                  <Zap className="w-8 h-8 text-teal mx-auto" />
                  <h4 className="font-semibold">Lightning Fast</h4>
                  <p className="text-sm text-gray-600">Process shipments 10x faster with AI automation</p>
                </div>
                <div className="space-y-2">
                  <Crown className="w-8 h-8 text-freight-orange mx-auto" />
                  <h4 className="font-semibold">Expert Support</h4>
                  <p className="text-sm text-gray-600">24/7 support from logistics professionals</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Payment Form Modal
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-freight-dark mb-2">
            Complete Your Subscription
          </h1>
          <p className="text-gray-600">
            {selectedPlan?.displayName} - ${billingCycle === "yearly" ? selectedPlan?.yearlyPrice : selectedPlan?.monthlyPrice}/{billingCycle === "yearly" ? "year" : "month"}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CreditCard className="w-5 h-5 mr-2 text-freight-blue" />
              Payment Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="cardholderName">Cardholder Name *</Label>
              <Input
                id="cardholderName"
                placeholder="John Doe"
                value={subscriptionForm.paymentMethod.cardholderName}
                onChange={(e) => handleCardChange("cardholderName", e.target.value)}
                disabled={isProcessingPayment}
              />
            </div>

            <div>
              <Label htmlFor="cardNumber">Card Number *</Label>
              <Input
                id="cardNumber"
                placeholder="1234 5678 9012 3456"
                value={subscriptionForm.paymentMethod.cardNumber}
                onChange={(e) => handleCardChange("cardNumber", e.target.value)}
                disabled={isProcessingPayment}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="expiryMonth">Month *</Label>
                <Input
                  id="expiryMonth"
                  placeholder="MM"
                  maxLength={2}
                  value={subscriptionForm.paymentMethod.expiryMonth}
                  onChange={(e) => handleCardChange("expiryMonth", e.target.value)}
                  disabled={isProcessingPayment}
                />
              </div>
              <div>
                <Label htmlFor="expiryYear">Year *</Label>
                <Input
                  id="expiryYear"
                  placeholder="YY"
                  maxLength={2}
                  value={subscriptionForm.paymentMethod.expiryYear}
                  onChange={(e) => handleCardChange("expiryYear", e.target.value)}
                  disabled={isProcessingPayment}
                />
              </div>
              <div>
                <Label htmlFor="cardCode">CVV *</Label>
                <Input
                  id="cardCode"
                  placeholder="123"
                  maxLength={4}
                  value={subscriptionForm.paymentMethod.cardCode}
                  onChange={(e) => handleCardChange("cardCode", e.target.value)}
                  disabled={isProcessingPayment}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="zipCode">ZIP Code</Label>
              <Input
                id="zipCode"
                placeholder="12345"
                value={subscriptionForm.paymentMethod.zipCode}
                onChange={(e) => handleCardChange("zipCode", e.target.value)}
                disabled={isProcessingPayment}
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit Buttons */}
        <div className="flex space-x-4 mt-6">
          <Button
            variant="outline"
            onClick={() => setShowPaymentForm(false)}
            disabled={isProcessingPayment}
            className="flex-1"
          >
            Back to Plans
          </Button>
          <Button
            onClick={handleSubscriptionSubmit}
            disabled={isProcessingPayment}
            className="btn-primary flex-1"
          >
            {isProcessingPayment ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Processing...
              </>
            ) : (
              <>
                <CreditCard className="w-5 h-5 mr-2" />
                Complete Subscription
              </>
            )}
          </Button>
        </div>
        
        <p className="text-sm text-gray-500 text-center mt-4">
          Your payment information is processed securely through Authorize.Net
        </p>
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