import { useLocation } from 'wouter';
import { CheckCircle, Download, ArrowLeft } from 'lucide-react';

export default function Success() {
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const transactionId = params.get('transactionId');
  const amount = params.get('amount');

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="h-10 w-10 text-green-600" />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
        <p className="text-gray-600 mb-6">
          Your payment has been processed successfully.
        </p>
        
        <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
          <div className="flex justify-between py-2 border-b border-gray-200">
            <span className="text-gray-500">Transaction ID:</span>
            <span className="font-mono text-sm">{transactionId || 'N/A'}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-gray-500">Amount Paid:</span>
            <span className="font-bold text-green-600">${amount || '0.00'}</span>
          </div>
        </div>
        
        <p className="text-sm text-gray-500 mb-6">
          A confirmation email has been sent to your email address.
        </p>
        
        <div className="space-y-3">
          <button
            onClick={() => window.print()}
            className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg"
          >
            <Download className="h-4 w-4" />
            Print Receipt
          </button>
          
          <button
            onClick={() => setLocation('/payment')}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg"
          >
            <ArrowLeft className="h-4 w-4" />
            Make Another Payment
          </button>
        </div>
      </div>
    </div>
  );
}
