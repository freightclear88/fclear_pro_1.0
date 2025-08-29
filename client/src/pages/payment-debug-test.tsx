import React from 'react';
import { useLocation } from 'wouter';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PaymentDebugTestPage() {
  const [location, setLocation] = useLocation();

  const testPaymentFlow = async () => {
    console.log('🧪 STARTING PAYMENT FLOW TEST');

    // Simulate payment data that would be created by the form
    const testPaymentData = {
      transactionId: 'DEBUG' + Date.now(),
      authCode: 'TEST' + Math.random().toString(36).substr(2, 6).toUpperCase(),
      amount: 25.99,
      invoiceNumber: 'TEST-INVOICE-123',
      cardLast4: '1111',
      cardType: 'DEBUG VISA',
      timestamp: new Date().toISOString(),
      billingName: 'John Doe',
      billingEmail: 'test@example.com'
    };

    console.log('💾 STORING TEST PAYMENT DATA:', testPaymentData);
    
    // Store in sessionStorage exactly like the payment form does
    sessionStorage.setItem('paymentSuccess', JSON.stringify(testPaymentData));
    
    // Verify storage
    const storedData = sessionStorage.getItem('paymentSuccess');
    console.log('✅ VERIFIED STORED DATA:', storedData);
    
    // Navigate to success page
    console.log('🔄 NAVIGATING TO SUCCESS PAGE:', `/payment/success/${testPaymentData.transactionId}`);
    setLocation(`/payment/success/${testPaymentData.transactionId}`);
  };

  const clearStorage = () => {
    sessionStorage.removeItem('paymentSuccess');
    console.log('🧹 CLEARED PAYMENT SUCCESS DATA');
  };

  const checkStorage = () => {
    const storedData = sessionStorage.getItem('paymentSuccess');
    console.log('📦 CURRENT STORED DATA:', storedData);
  };

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Payment Flow Debug Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button onClick={testPaymentFlow} className="w-full">
              Test Payment Flow
            </Button>
            <Button onClick={checkStorage} variant="outline" className="w-full">
              Check Storage
            </Button>
            <Button onClick={clearStorage} variant="outline" className="w-full">
              Clear Storage
            </Button>
          </div>
          
          <div className="text-sm text-gray-600">
            <p><strong>Instructions:</strong></p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Click "Test Payment Flow" to simulate a successful payment</li>
              <li>You'll be redirected to the success page</li>
              <li>Check the console logs to see the data flow</li>
              <li>Verify the receipt shows the correct amount ($25.99)</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}