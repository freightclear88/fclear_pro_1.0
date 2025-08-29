import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface PaymentConfig {
  success: boolean;
  apiLoginId: string;
  clientKey: string;
  environment: string;
}

export default function AuthorizeNetDebug() {
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);
  const [debugResults, setDebugResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch payment config
  useEffect(() => {
    fetch('/api/payment/config')
      .then(res => res.json())
      .then(data => setPaymentConfig(data))
      .catch(err => console.error('Config fetch error:', err));
  }, []);

  const runDebugTest = async () => {
    if (!paymentConfig?.success) return;
    
    setIsLoading(true);
    setDebugResults([]);
    
    const results: any[] = [];
    
    // Test 1: Environment Detection
    const isProduction = paymentConfig.apiLoginId?.length === 8 && !paymentConfig.apiLoginId.includes('test');
    results.push({
      test: 'Environment Detection',
      status: 'info',
      details: {
        apiLoginId: paymentConfig.apiLoginId,
        environment: isProduction ? 'PRODUCTION' : 'SANDBOX',
        clientKeyPrefix: paymentConfig.clientKey?.substring(0, 10),
        clientKeyLength: paymentConfig.clientKey?.length
      }
    });

    // Test 2: Load Accept.js
    try {
      const scriptUrl = 'https://js.authorize.net/v1/Accept.js';
      const script = document.createElement('script');
      script.src = scriptUrl;
      
      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
      
      results.push({
        test: 'Accept.js Loading',
        status: 'success',
        details: { loaded: true, url: scriptUrl }
      });
    } catch (error) {
      results.push({
        test: 'Accept.js Loading',
        status: 'error',
        details: { error: error.message }
      });
    }

    // Test 3: Accept.js Availability
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for initialization
    
    if (window.Accept && typeof window.Accept.dispatchData === 'function') {
      results.push({
        test: 'Accept.js Initialization',
        status: 'success',
        details: { initialized: true, dispatchDataAvailable: true }
      });
      
      // Test 4: Minimal Accept.js Call
      try {
        const testData = {
          authData: {
            clientKey: paymentConfig.clientKey,
            apiLoginID: paymentConfig.apiLoginId
          },
          cardData: {
            cardNumber: '4111111111111111', // Test card
            month: '12',
            year: '2025',
            cardCode: '123'
          }
        };

        console.log('Sending test data to Accept.js:', {
          authData: {
            clientKey: testData.authData.clientKey.substring(0, 10) + '...',
            apiLoginID: testData.authData.apiLoginID
          },
          cardData: { ...testData.cardData, cardNumber: '4111...', cardCode: '***' }
        });

        const response = await new Promise((resolve) => {
          window.Accept.dispatchData(testData, (res) => {
            console.log('Accept.js raw response:', res);
            resolve(res);
          });
        });

        results.push({
          test: 'Accept.js Authentication Test',
          status: response.messages?.resultCode === 'Ok' ? 'success' : 'error',
          details: {
            resultCode: response.messages?.resultCode,
            messages: response.messages?.message || [],
            fullResponse: response,
            sentData: {
              clientKeyUsed: testData.authData.clientKey.substring(0, 10) + '...',
              apiLoginIdUsed: testData.authData.apiLoginID,
              environment: 'production'
            }
          }
        });
      } catch (error) {
        results.push({
          test: 'Accept.js Authentication Test',
          status: 'error',
          details: { error: error.message }
        });
      }
    } else {
      results.push({
        test: 'Accept.js Initialization',
        status: 'error',
        details: { initialized: false, acceptAvailable: !!window.Accept }
      });
    }

    setDebugResults(results);
    setIsLoading(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-500';
      case 'error': return 'bg-red-500';
      case 'warning': return 'bg-yellow-500';
      default: return 'bg-blue-500';
    }
  };

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Authorize.Net Debug Console</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {paymentConfig && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <strong>API Login ID:</strong> {paymentConfig.apiLoginId}
              </div>
              <div>
                <strong>Environment:</strong> {paymentConfig.environment}
              </div>
              <div>
                <strong>Client Key (first 10):</strong> {paymentConfig.clientKey?.substring(0, 10)}...
              </div>
              <div>
                <strong>Client Key Length:</strong> {paymentConfig.clientKey?.length}
              </div>
            </div>
          )}
          
          <Button 
            onClick={runDebugTest} 
            disabled={isLoading || !paymentConfig?.success}
            className="w-full"
          >
            {isLoading ? 'Running Debug Tests...' : 'Run Complete Debug Test'}
          </Button>

          {debugResults.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Debug Results:</h3>
              {debugResults.map((result, index) => (
                <Card key={index}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">{result.test}</CardTitle>
                      <Badge className={getStatusColor(result.status)}>
                        {result.status.toUpperCase()}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">
                      {JSON.stringify(result.details, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              ))}
            </div>
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