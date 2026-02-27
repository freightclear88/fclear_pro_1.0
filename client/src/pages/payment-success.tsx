import React, { useEffect, useState } from 'react';
import { useLocation, useRoute } from 'wouter';
import PaymentReceipt from '@/components/PaymentReceipt';
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft } from "lucide-react";

interface PaymentSuccessData {
  transactionId: string;
  authCode: string;
  amount: number;
  invoiceNumber: string;
  cardLast4: string;
  cardType: string;
  timestamp: string;
  billingName: string;
  billingEmail: string;
}

export default function PaymentSuccessPage() {
  const [location, setLocation] = useLocation();
  const [match, params] = useRoute('/payment/success/:transactionId');
  const [paymentData, setPaymentData] = useState<PaymentSuccessData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('🎯 SUCCESS PAGE LOADING with transaction ID:', params?.transactionId);
    
    // Check all sessionStorage keys for debugging
    console.log('🔍 ALL SESSION STORAGE KEYS:', Object.keys(sessionStorage));
    
    // Try to get payment data from sessionStorage (set after successful payment)
    const storedData = sessionStorage.getItem('paymentSuccess');
    console.log('📦 RAW STORED DATA:', storedData);
    console.log('📦 STORED DATA LENGTH:', storedData?.length);
    
    if (storedData && storedData !== 'null' && storedData !== 'undefined') {
      try {
        const data = JSON.parse(storedData);
        console.log('✅ PARSED SUCCESS DATA:', data);
        console.log('💰 PARSED AMOUNT:', data.amount);
        setPaymentData(data);
        // DON'T clear the stored data immediately - keep it for debugging
        // sessionStorage.removeItem('paymentSuccess');
      } catch (error) {
        console.error('❌ Error parsing payment data:', error);
        console.log('📦 FAILED TO PARSE:', storedData);
      }
    } else {
      console.log('⚠️ NO VALID STORED DATA - sessionStorage item is:', storedData);
      console.log('⚠️ Creating fallback data for transaction:', params.transactionId);
      
      // Check if this is a DEBUG transaction and try to extract amount from server if needed
      if (params?.transactionId?.startsWith('DEBUG')) {
        console.log('🧪 DEBUG TRANSACTION DETECTED - this should have had stored data');
      }
      
      // If no stored data but we have a transaction ID, create minimal data
      setPaymentData({
        transactionId: params.transactionId || 'UNKNOWN',
        authCode: 'N/A',
        amount: 0,
        invoiceNumber: 'N/A',
        cardLast4: '****',
        cardType: 'Credit Card',
        timestamp: new Date().toISOString(),
        billingName: 'Customer',
        billingEmail: 'customer@example.com'
      });
    }
    setLoading(false);
  }, [params]);

  const handleEmailReceipt = async () => {
    if (!paymentData) return;

    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch('/api/payment/email-receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          transactionId: paymentData.transactionId,
          email: paymentData.billingEmail
        }),
        credentials: "include",
      });

      if (response.ok) {
        // Toast notification would show success
        console.log('Receipt emailed successfully');
      }
    } catch (error) {
      console.error('Error sending receipt:', error);
    }
  };

  const handleGoToDashboard = () => {
    setLocation('/');
  };

  const handleGoToInvoices = () => {
    setLocation('/payments');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p>Loading payment details...</p>
        </div>
      </div>
    );
  }

  if (!paymentData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Payment Receipt Not Found</h1>
          <p className="text-gray-600 mb-6">
            We couldn't find the payment details. This might happen if you refreshed the page or the session expired.
          </p>
          <div className="flex gap-3 justify-center">
            <Button 
              onClick={handleGoToDashboard}
              variant="outline"
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Go to Dashboard
            </Button>
            <Button onClick={handleGoToInvoices}>
              View Invoices
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        {/* Navigation */}
        <div className="mb-6">
          <Button 
            onClick={handleGoToDashboard}
            variant="ghost"
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
        </div>

        {/* Receipt Component */}
        <PaymentReceipt
          transactionId={paymentData.transactionId}
          authCode={paymentData.authCode}
          amount={paymentData.amount}
          invoiceNumber={paymentData.invoiceNumber}
          cardLast4={paymentData.cardLast4}
          cardType={paymentData.cardType}
          timestamp={paymentData.timestamp}
          billingName={paymentData.billingName}
          billingEmail={paymentData.billingEmail}
          onClose={handleGoToDashboard}
          onEmailReceipt={handleEmailReceipt}
        />

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-sm text-gray-600">
            Thank you for using FreightClear Workflows!
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Questions? Contact support at support@freightclear.com
          </p>
        </div>
      </div>
    </div>
  );
}