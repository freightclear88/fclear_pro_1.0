import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { CheckCircle, XCircle, AlertCircle, CreditCard, Server, Globe, Shield } from "lucide-react";
import AuthorizeNetPaymentForm from "@/components/AuthorizeNetPaymentForm";

interface TestResult {
  test: string;
  status: 'success' | 'error' | 'warning';
  message: string;
  details?: any;
}

export default function PaymentTest() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testAmount, setTestAmount] = useState("1.00");
  const [invoiceNumber, setInvoiceNumber] = useState(`TEST-${Date.now()}`);
  
  // Payment configuration query
  const { data: paymentConfig, refetch: refetchConfig } = useQuery({
    queryKey: ["/api/payment/config"],
    enabled: isAuthenticated,
  });

  const runSystemTests = async () => {
    setIsRunningTests(true);
    const results: TestResult[] = [];

    try {
      // Test 1: Configuration Check
      try {
        await refetchConfig();
        if (paymentConfig?.success) {
          results.push({
            test: "Payment Configuration",
            status: "success",
            message: `Environment: ${paymentConfig.environment}, API Login ID: ${paymentConfig.apiLoginId}`,
            details: {
              environment: paymentConfig.environment,
              apiLoginId: paymentConfig.apiLoginId,
              clientKeyLength: paymentConfig.clientKey?.length || 0
            }
          });
        } else {
          results.push({
            test: "Payment Configuration",
            status: "error",
            message: "Failed to load payment configuration"
          });
        }
      } catch (error: any) {
        results.push({
          test: "Payment Configuration",
          status: "error",
          message: error.message || "Configuration test failed"
        });
      }

      // Test 2: Accept.js Script Loading
      const acceptJsTest = new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = paymentConfig?.environment === 'production' 
          ? 'https://js.authorize.net/v1/Accept.js'
          : 'https://jstest.authorize.net/v1/Accept.js';
        
        script.onload = () => {
          if (window.Accept && typeof window.Accept.dispatchData === 'function') {
            resolve({
              test: "Accept.js Library",
              status: "success",
              message: `Accept.js loaded successfully from ${paymentConfig?.environment} environment`
            });
          } else {
            resolve({
              test: "Accept.js Library",
              status: "error",
              message: "Accept.js loaded but not properly initialized"
            });
          }
        };
        
        script.onerror = () => {
          resolve({
            test: "Accept.js Library",
            status: "error",
            message: "Failed to load Accept.js from CDN"
          });
        };
        
        document.head.appendChild(script);
        
        // Timeout after 5 seconds
        setTimeout(() => {
          resolve({
            test: "Accept.js Library",
            status: "error",
            message: "Accept.js loading timed out"
          });
        }, 5000);
      });

      const acceptResult = await acceptJsTest as TestResult;
      results.push(acceptResult);

      // Test 3: API Connectivity
      try {
        const response = await fetch('/api/payment/webhook', { method: 'POST', body: '{}' });
        results.push({
          test: "Webhook Endpoint",
          status: "success",
          message: `Webhook endpoint responding (${response.status})`
        });
      } catch (error) {
        results.push({
          test: "Webhook Endpoint",
          status: "warning",
          message: "Webhook endpoint test failed - may not be accessible externally yet"
        });
      }

      // Test 4: SSL/HTTPS Check
      if (window.location.protocol === 'https:') {
        results.push({
          test: "SSL/HTTPS",
          status: "success",
          message: "Running on secure HTTPS connection"
        });
      } else {
        results.push({
          test: "SSL/HTTPS",
          status: "warning",
          message: "Running on HTTP - production requires HTTPS"
        });
      }

      // Test 5: Environment Variables
      results.push({
        test: "Production Readiness",
        status: paymentConfig?.environment === 'production' ? "success" : "warning",
        message: paymentConfig?.environment === 'production' 
          ? "Configured for production environment"
          : "Running in sandbox mode"
      });

    } catch (error: any) {
      results.push({
        test: "System Tests",
        status: "error",
        message: `Test suite failed: ${error.message}`
      });
    }

    setTestResults(results);
    setIsRunningTests(false);
  };

  const handlePaymentSuccess = async (paymentData: any) => {
    toast({
      title: "Test Payment Successful!",
      description: `Test payment of $${testAmount} processed successfully. Transaction will appear in your Authorize.Net dashboard.`,
      duration: 10000,
    });

    // Log the success for debugging
    console.log('Test payment successful:', paymentData);
    
    // Add successful payment to test results
    setTestResults(prev => [...prev, {
      test: "Live Payment Processing",
      status: "success",
      message: `$${testAmount} test payment processed successfully`,
      details: {
        opaqueData: paymentData.opaqueData?.dataDescriptor,
        amount: testAmount,
        invoiceNumber: invoiceNumber
      }
    }]);
  };

  const handlePaymentError = (error: string) => {
    toast({
      title: "Test Payment Failed",
      description: error,
      variant: "destructive",
      duration: 10000,
    });

    // Add failed payment to test results
    setTestResults(prev => [...prev, {
      test: "Live Payment Processing",
      status: "error",
      message: error
    }]);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Payment System Testing</h1>
          <p>Please log in to access payment testing tools.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-freight-dark mb-2">
            Authorize.Net Production Testing
          </h1>
          <p className="text-gray-600">
            Comprehensive testing suite for production payment processing
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* System Tests */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="w-5 h-5" />
                  System Tests
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  onClick={runSystemTests} 
                  disabled={isRunningTests}
                  className="w-full"
                >
                  {isRunningTests ? "Running Tests..." : "Run System Tests"}
                </Button>

                {testResults.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-medium">Test Results:</h3>
                    {testResults.map((result, index) => (
                      <div 
                        key={index} 
                        className={`p-3 rounded-lg border ${getStatusColor(result.status)}`}
                      >
                        <div className="flex items-start gap-3">
                          {getStatusIcon(result.status)}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm">{result.test}</h4>
                            <p className="text-sm text-gray-600 mt-1">{result.message}</p>
                            {result.details && (
                              <pre className="text-xs bg-white p-2 rounded mt-2 overflow-x-auto">
                                {JSON.stringify(result.details, null, 2)}
                              </pre>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Configuration Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Current Configuration
                </CardTitle>
              </CardHeader>
              <CardContent>
                {paymentConfig?.success ? (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Environment:</span>
                      <Badge variant={paymentConfig.environment === 'production' ? 'default' : 'secondary'}>
                        {paymentConfig.environment}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">API Login ID:</span>
                      <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                        {paymentConfig.apiLoginId}
                      </code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Client Key:</span>
                      <span className="text-sm text-gray-500">
                        {paymentConfig.clientKey ? `${paymentConfig.clientKey.substring(0, 10)}...` : 'Not set'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">SSL:</span>
                      <Badge variant={window.location.protocol === 'https:' ? 'default' : 'secondary'}>
                        {window.location.protocol === 'https:' ? 'HTTPS' : 'HTTP'}
                      </Badge>
                    </div>
                  </div>
                ) : (
                  <p className="text-red-600">Configuration not loaded</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Live Payment Test */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Live Payment Test
                </CardTitle>
                <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg mt-2">
                  <AlertCircle className="w-4 h-4 inline mr-2" />
                  <strong>Warning:</strong> This will process real payments with actual charges.
                  Use your real credit card for testing.
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="test-amount">Test Amount (USD)</Label>
                      <Input
                        id="test-amount"
                        type="number"
                        step="0.01"
                        min="1.00"
                        value={testAmount}
                        onChange={(e) => setTestAmount(e.target.value)}
                        placeholder="1.00"
                      />
                    </div>
                    <div>
                      <Label htmlFor="invoice-number">Invoice Number</Label>
                      <Input
                        id="invoice-number"
                        type="text"
                        value={invoiceNumber}
                        onChange={(e) => setInvoiceNumber(e.target.value)}
                        placeholder="TEST-123456"
                      />
                    </div>
                  </div>

                  {paymentConfig && parseFloat(testAmount) >= 1 && invoiceNumber.trim() && (
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <h4 className="font-medium text-sm mb-2">Environment Check:</h4>
                      <div className="text-xs space-y-1">
                        <div>API Login ID: {paymentConfig.apiLoginId}</div>
                        <div>Environment: {(paymentConfig.apiLoginId?.length === 8 && !paymentConfig.apiLoginId.includes('test')) ? 'PRODUCTION' : 'SANDBOX'}</div>
                        <div>Accept.js: {(paymentConfig.apiLoginId?.length === 8 && !paymentConfig.apiLoginId.includes('test')) ? 'js.authorize.net' : 'jstest.authorize.net'}</div>
                      </div>
                    </div>
                  )}
                  
                  {paymentConfig && parseFloat(testAmount) >= 1 && invoiceNumber.trim() && (
                    <AuthorizeNetPaymentForm
                      paymentConfig={paymentConfig}
                      onPaymentSuccess={handlePaymentSuccess}
                      onPaymentError={handlePaymentError}
                      amount={parseFloat(testAmount)}
                      invoiceNumber={invoiceNumber}
                      description={`Production API Test - $${testAmount} - Invoice: ${invoiceNumber}`}
                      serviceFeeRate={0.035}
                      showBillingAddress={true}
                      initialData={{
                        billingAddress: {
                          firstName: user?.firstName || 'Test',
                          lastName: user?.lastName || 'User',
                          company: user?.companyName || 'Test Company',
                          address: '123 Test Street',
                          city: 'Test City',
                          state: 'CA',
                          zip: '90210',
                          country: 'US',
                          phone: user?.phone || '555-123-4567',
                          email: user?.email || 'test@example.com'
                        }
                      }}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Deployment Info */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Production Deployment Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="font-medium mb-2">Webhook URL for Authorize.Net:</h3>
                <code className="text-sm bg-gray-100 p-2 rounded block break-all">
                  {window.location.origin}/api/payment/webhook
                </code>
              </div>
              <div>
                <h3 className="font-medium mb-2">Current URL:</h3>
                <code className="text-sm bg-gray-100 p-2 rounded block break-all">
                  {window.location.href}
                </code>
              </div>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-medium mb-2">Next Steps for Production:</h3>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>Deploy this app to get a permanent HTTPS URL</li>
                <li>Configure the webhook URL in your Authorize.Net merchant interface</li>
                <li>Test with small amounts first ($1-5)</li>
                <li>Monitor transactions in your Authorize.Net dashboard</li>
                <li>Set up proper error monitoring and logging</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}