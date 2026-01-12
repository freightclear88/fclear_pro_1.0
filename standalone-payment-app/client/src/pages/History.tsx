import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { CreditCard, Calendar, DollarSign, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';

interface Transaction {
  id: number;
  transactionId: string;
  invoiceNumber: string;
  amount: number;
  serviceFee: number;
  totalAmount: number;
  cardType: string;
  cardLastFour: string;
  status: string;
  createdAt: string;
}

export default function History() {
  const [, setLocation] = useLocation();
  
  const { data, isLoading, error } = useQuery<{ success: boolean; transactions: Transaction[] }>({
    queryKey: ['/api/payment/history'],
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-600">Failed to load payment history</div>
      </div>
    );
  }

  const transactions = data?.transactions || [];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Payment History</h1>
            <p className="text-gray-600">View your past transactions</p>
          </div>
          <button
            onClick={() => setLocation('/payment')}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
          >
            <ArrowLeft className="h-4 w-4" />
            Make Payment
          </button>
        </div>

        {transactions.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Transactions Yet</h3>
            <p className="text-gray-600 mb-4">Your payment history will appear here.</p>
            <button
              onClick={() => setLocation('/payment')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
            >
              Make Your First Payment
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {transactions.map((transaction) => (
              <div key={transaction.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      transaction.status === 'approved' ? 'bg-green-100' : 'bg-red-100'
                    }`}>
                      {transaction.status === 'approved' ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {transaction.cardType} ****{transaction.cardLastFour}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          transaction.status === 'approved' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {transaction.status}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        {transaction.invoiceNumber && (
                          <span className="mr-4">Invoice: {transaction.invoiceNumber}</span>
                        )}
                        <span>Transaction: {transaction.transactionId}</span>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-gray-400 mt-1">
                        <Calendar className="h-4 w-4" />
                        {formatDate(transaction.createdAt)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-lg font-bold text-gray-900">
                      <DollarSign className="h-5 w-5" />
                      {transaction.totalAmount.toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-500">
                      (incl. ${transaction.serviceFee.toFixed(2)} fee)
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
