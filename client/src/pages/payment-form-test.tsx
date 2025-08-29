import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface PaymentConfig {
  success: boolean;
  apiLoginId: string;
  clientKey: string;
  environment: string;
}

export default function PaymentFormTest() {
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [cardNumber, setCardNumber] = useState('4111111111111111'); // Pre-fill test card
  const [month, setMonth] = useState('12');
  const [year, setYear] = useState('2025');
  const [cvv, setCvv] = useState('123');
  const [zip, setZip] = useState('12345');

  // Fetch payment config
  useEffect(() => {
    fetch('/api/payment/config')
      .then(res => res.json())
      .then(data => setPaymentConfig(data))
      .catch(err => console.error('Config fetch error:', err));
  }, []);

  // Load Accept.js
  useEffect(() => {
    if (paymentConfig?.success && !window.Accept) {
      const script = document.createElement('script');
      script.src = 'https://js.authorize.net/v1/Accept.js';
      script.onload = () => console.log('Accept.js loaded for form test');
      document.head.appendChild(script);
    }
  }, [paymentConfig]);

  const testPayment = async () => {
    if (!paymentConfig?.success || !window.Accept) return;
    
    setIsLoading(true);
    setResult(null);
    
    const testData = {
      authData: {
        clientKey: paymentConfig.clientKey,
        apiLoginID: paymentConfig.apiLoginId
      },
      cardData: {
        cardNumber: cardNumber.replace(/\s/g, ''),
        month: month.padStart(2, '0'),
        year: year,
        cardCode: cvv,
        zip: zip,
        fullName: 'Test User'
      }
    };

    console.log('🧪 FORM TEST - Sending data:', {
      authData: {
        clientKey: testData.authData.clientKey.substring(0, 10) + '...',
        apiLoginID: testData.authData.apiLoginID
      },
      cardData: {
        ...testData.cardData,
        cardNumber: testData.cardData.cardNumber.substring(0, 4) + '****',
        cardCode: '***'
      }
    });

    try {
      const response = await new Promise((resolve) => {
        window.Accept.dispatchData(testData, (res) => {
          console.log('🧪 FORM TEST - Accept.js response:', res);
          resolve(res);
        });
      });

      setResult({
        success: response.messages?.resultCode === 'Ok',
        response: response,
        testType: 'Payment Form Simulation'
      });
    } catch (error) {
      setResult({
        success: false,
        error: error.message,
        testType: 'Payment Form Simulation'
      });
    }
    
    setIsLoading(false);
  };

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Payment Form Test</CardTitle>
          <p className="text-sm text-gray-600">
            Test payment form data with the same Accept.js call as the working debug test
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {paymentConfig && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-blue-50 rounded-lg">
              <div><strong>API Login ID:</strong> {paymentConfig.apiLoginId}</div>
              <div><strong>Client Key:</strong> {paymentConfig.clientKey?.substring(0, 10)}...</div>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="cardNumber">Card Number</Label>
              <Input 
                id="cardNumber"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                placeholder="4111111111111111"
              />
            </div>
            <div>
              <Label htmlFor="zip">ZIP Code</Label>
              <Input 
                id="zip"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                placeholder="12345"
              />
            </div>
            <div>
              <Label htmlFor="month">Month</Label>
              <Input 
                id="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                placeholder="12"
              />
            </div>
            <div>
              <Label htmlFor="year">Year</Label>
              <Input 
                id="year"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="2025"
              />
            </div>
            <div>
              <Label htmlFor="cvv">CVV</Label>
              <Input 
                id="cvv"
                value={cvv}
                onChange={(e) => setCvv(e.target.value)}
                placeholder="123"
              />
            </div>
          </div>
          
          <Button 
            onClick={testPayment} 
            disabled={isLoading || !paymentConfig?.success}
            className="w-full"
          >
            {isLoading ? 'Testing Payment...' : 'Test Payment Form Data'}
          </Button>

          {result && (
            <Card>
              <CardHeader>
                <CardTitle className={result.success ? 'text-green-600' : 'text-red-600'}>
                  {result.success ? 'SUCCESS' : 'FAILED'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Extend window type for Accept.js
declare global {
  interface Window {
    Accept: {
      dispatchData: (data: any, callback: (response: any) => void) => void;
    };
  }
}