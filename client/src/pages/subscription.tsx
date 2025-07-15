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

export default function Subscription() {
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

  // Query for subscription plans
  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ["/api/subscription/plans"],
    retry: false,
  });

  // Query for user access and subscription status
  const { data: userAccess, isLoading: accessLoading } = useQuery({
    queryKey: ["/api/subscription/access"],
    retry: false,
  });

  // Query for payment configuration
  const { data: paymentConfig, isLoading: configLoading } = useQuery({
    queryKey: ["/api/payment/config"],
    retry: false,
  });

  // Subscription mutation
  const subscriptionMutation = useMutation({
    mutationFn: async (data: SubscriptionFormData) => {
      return await apiRequest("/api/subscription/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: "Subscription Updated",
        description: "Your subscription has been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/subscription/access"] });
      setShowPaymentForm(false);
      setSelectedPlan(null);
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

  // Load Accept.js library dynamically
  useEffect(() => {
    if (paymentConfig?.success && paymentConfig?.environment) {
      const script = document.createElement('script');
      script.src = paymentConfig.environment === 'sandbox' 
        ? 'https://jstest.authorize.net/v1/Accept.js' 
        : 'https://js.authorize.net/v1/Accept.js';
      script.async = true;
      document.head.appendChild(script);
      
      return () => {
        document.head.removeChild(script);
      };
    }
  }, [paymentConfig]);

  const handlePlanSelect = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    setSubscriptionForm(prev => ({
      ...prev,
      planName: plan.planName,
      billingCycle: billingCycle
    }));
    setShowPaymentForm(true);
  };

  const handleSubscriptionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedPlan || !paymentConfig?.success) {
      toast({
        title: "Error",
        description: "Please select a plan and ensure payment configuration is loaded.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessingPayment(true);

    try {
      const acceptData = {
        clientKey: paymentConfig.clientKey,
        apiLoginID: paymentConfig.apiLoginId,
        paymentForm: {
          cardNumber: subscriptionForm.paymentMethod.cardNumber,
          month: subscriptionForm.paymentMethod.expiryMonth,
          year: subscriptionForm.paymentMethod.expiryYear,
          cardCode: subscriptionForm.paymentMethod.cardCode,
          zip: subscriptionForm.paymentMethod.zipCode,
          fullName: subscriptionForm.paymentMethod.cardholderName
        }
      };

      // Use Accept.js to get payment nonce
      (window as any).Accept.dispatchData(acceptData, (response: any) => {
        if (response.messages.resultCode === 'Ok') {
          const formWithNonce = {
            ...subscriptionForm,
            paymentNonce: response.opaqueData.dataValue
          };
          subscriptionMutation.mutate(formWithNonce);
        } else {
          toast({
            title: "Payment Error",
            description: response.messages.message[0]?.text || "Payment validation failed",
            variant: "destructive",
          });
          setIsProcessingPayment(false);
        }
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process payment. Please try again.",
        variant: "destructive",
      });
      setIsProcessingPayment(false);
    }
  };

  const getStatusBadge = (status: string, isTrialActive: boolean) => {
    if (isTrialActive) {
      return <Badge variant="outline" className="text-blue-600 border-blue-600">Trial Active</Badge>;
    }
    
    switch (status) {
      case 'active':
        return <Badge variant="outline" className="text-green-600 border-green-600">Active</Badge>;
      case 'expired':
        return <Badge variant="outline" className="text-red-600 border-red-600">Expired</Badge>;
      case 'cancelled':
        return <Badge variant="outline" className="text-gray-600 border-gray-600">Cancelled</Badge>;
      default:
        return <Badge variant="outline" className="text-gray-600 border-gray-600">Free</Badge>;
    }
  };

  const getUsageProgressColor = (current: number, max: number) => {
    const percentage = (current / max) * 100;
    if (percentage >= 90) return "bg-red-500";
    if (percentage >= 70) return "bg-yellow-500";
    return "bg-green-500";
  };

  if (isLoading || plansLoading || accessLoading || configLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading subscription information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-freight-dark mb-2">Subscription Management</h1>
          <p className="text-gray-600">Manage your subscription plan and billing preferences</p>
        </div>

        {/* Current Subscription Status */}
        {userAccess && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-freight-orange" />
                Current Subscription
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Status</p>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(userAccess.subscriptionStatus, userAccess.isTrialActive)}
                    {userAccess.isTrialActive && userAccess.daysUntilExpiry > 0 && (
                      <span className="text-sm text-blue-600">
                        {userAccess.daysUntilExpiry} days left
                      </span>
                    )}
                  </div>
                </div>
                
                <div>
                  <p className="text-sm text-gray-500 mb-1">Shipments Usage</p>
                  <div className="flex items-center gap-2">
                    <Progress 
                      value={(userAccess.usageLimits.shipments.current / userAccess.usageLimits.shipments.max) * 100}
                      className="flex-1"
                    />
                    <span className="text-sm text-gray-600">
                      {userAccess.usageLimits.shipments.current} / {userAccess.usageLimits.shipments.max}
                    </span>
                  </div>
                </div>
                
                <div>
                  <p className="text-sm text-gray-500 mb-1">Documents Usage</p>
                  <div className="flex items-center gap-2">
                    <Progress 
                      value={(userAccess.usageLimits.documents.current / userAccess.usageLimits.documents.max) * 100}
                      className="flex-1"
                    />
                    <span className="text-sm text-gray-600">
                      {userAccess.usageLimits.documents.current} / {userAccess.usageLimits.documents.max}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Billing Cycle Toggle */}
        <div className="mb-8">
          <div className="flex items-center justify-center gap-4 p-1 bg-gray-100 rounded-lg w-fit mx-auto">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                billingCycle === "monthly"
                  ? "bg-white text-freight-dark shadow-sm"
                  : "text-gray-500 hover:text-freight-dark"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle("yearly")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                billingCycle === "yearly"
                  ? "bg-white text-freight-dark shadow-sm"
                  : "text-gray-500 hover:text-freight-dark"
              }`}
            >
              Yearly
              <span className="ml-1 text-xs text-green-600 font-semibold">Save 17%</span>
            </button>
          </div>
        </div>

        {/* Subscription Plans */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {plans.map((plan: SubscriptionPlan) => {
            const price = billingCycle === "monthly" ? plan.monthlyPrice : plan.yearlyPrice;
            const isFree = plan.planName === "free";
            const isPro = plan.planName === "pro";
            
            return (
              <Card 
                key={plan.id} 
                className={`relative overflow-hidden transition-all duration-300 hover:shadow-lg ${
                  isPro ? "border-freight-orange shadow-lg" : "border-gray-200"
                }`}
              >
                {isPro && (
                  <div className="absolute top-0 right-0 bg-freight-orange text-white px-3 py-1 text-xs font-medium">
                    Most Popular
                  </div>
                )}
                
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl font-bold text-freight-dark">
                      {plan.displayName}
                    </CardTitle>
                    {isPro && <Crown className="w-6 h-6 text-freight-orange" />}
                    {isFree && <Sparkles className="w-6 h-6 text-teal" />}
                  </div>
                  <p className="text-gray-600 text-sm">{plan.description}</p>
                </CardHeader>
                
                <CardContent className="pt-0">
                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-freight-dark">${price}</span>
                      {!isFree && (
                        <span className="text-gray-500">/{billingCycle === "monthly" ? "month" : "year"}</span>
                      )}
                    </div>
                    {billingCycle === "yearly" && !isFree && (
                      <p className="text-sm text-green-600 mt-1">
                        Save ${((parseFloat(plan.monthlyPrice) * 12) - parseFloat(plan.yearlyPrice)).toFixed(2)} per year
                      </p>
                    )}
                  </div>
                  
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span className="text-sm text-gray-600">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <Button
                    onClick={() => handlePlanSelect(plan)}
                    className={`w-full ${
                      isPro 
                        ? "bg-freight-orange hover:bg-freight-orange/90 text-white" 
                        : "bg-teal hover:bg-teal/90 text-white"
                    }`}
                    disabled={isFree}
                  >
                    {isFree ? "Current Plan" : "Select Plan"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Payment Form */}
        {showPaymentForm && selectedPlan && (
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Complete Your Subscription
              </CardTitle>
              <p className="text-sm text-gray-600">
                Subscribing to {selectedPlan.displayName} - ${billingCycle === "monthly" ? selectedPlan.monthlyPrice : selectedPlan.yearlyPrice}/{billingCycle === "monthly" ? "month" : "year"}
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubscriptionSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="cardholderName">Cardholder Name</Label>
                  <Input
                    id="cardholderName"
                    value={subscriptionForm.paymentMethod.cardholderName}
                    onChange={(e) => setSubscriptionForm(prev => ({
                      ...prev,
                      paymentMethod: { ...prev.paymentMethod, cardholderName: e.target.value }
                    }))}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="cardNumber">Card Number</Label>
                  <Input
                    id="cardNumber"
                    value={subscriptionForm.paymentMethod.cardNumber}
                    onChange={(e) => setSubscriptionForm(prev => ({
                      ...prev,
                      paymentMethod: { ...prev.paymentMethod, cardNumber: e.target.value }
                    }))}
                    placeholder="1234 5678 9012 3456"
                    required
                  />
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="expiryMonth">Month</Label>
                    <Input
                      id="expiryMonth"
                      value={subscriptionForm.paymentMethod.expiryMonth}
                      onChange={(e) => setSubscriptionForm(prev => ({
                        ...prev,
                        paymentMethod: { ...prev.paymentMethod, expiryMonth: e.target.value }
                      }))}
                      placeholder="MM"
                      maxLength={2}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="expiryYear">Year</Label>
                    <Input
                      id="expiryYear"
                      value={subscriptionForm.paymentMethod.expiryYear}
                      onChange={(e) => setSubscriptionForm(prev => ({
                        ...prev,
                        paymentMethod: { ...prev.paymentMethod, expiryYear: e.target.value }
                      }))}
                      placeholder="YY"
                      maxLength={2}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="cardCode">CVV</Label>
                    <Input
                      id="cardCode"
                      value={subscriptionForm.paymentMethod.cardCode}
                      onChange={(e) => setSubscriptionForm(prev => ({
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
                  <Label htmlFor="zipCode">ZIP Code</Label>
                  <Input
                    id="zipCode"
                    value={subscriptionForm.paymentMethod.zipCode}
                    onChange={(e) => setSubscriptionForm(prev => ({
                      ...prev,
                      paymentMethod: { ...prev.paymentMethod, zipCode: e.target.value }
                    }))}
                    placeholder="12345"
                    required
                  />
                </div>
                
                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowPaymentForm(false);
                      setSelectedPlan(null);
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isProcessingPayment}
                    className="flex-1 bg-freight-orange hover:bg-freight-orange/90"
                  >
                    {isProcessingPayment ? "Processing..." : "Subscribe"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}