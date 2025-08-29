import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Download, Mail, Receipt, CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PaymentReceiptProps {
  transactionId: string;
  authCode: string;
  amount: number;
  invoiceNumber: string;
  cardLast4: string;
  cardType: string;
  timestamp: string;
  billingName: string;
  billingEmail: string;
  onClose?: () => void;
  onEmailReceipt?: () => void;
}

export default function PaymentReceipt({
  transactionId,
  authCode,
  amount,
  invoiceNumber,
  cardLast4,
  cardType,
  timestamp,
  billingName,
  billingEmail,
  onClose,
  onEmailReceipt
}: PaymentReceiptProps) {
  const { toast } = useToast();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    // Create a printable receipt content
    const receiptContent = `
      FREIGHTCLEAR PAYMENT RECEIPT
      ============================
      
      Transaction Details:
      Transaction ID: ${transactionId}
      Authorization Code: ${authCode}
      Invoice Number: ${invoiceNumber}
      Amount: $${amount.toFixed(2)} USD
      Date: ${formatDate(timestamp)}
      
      Payment Method:
      ${cardType} ending in ${cardLast4}
      
      Billing Information:
      ${billingName}
      ${billingEmail}
      
      Status: APPROVED
      
      Thank you for your payment!
      
      Questions? Contact support@freightclear.com
    `;

    const blob = new Blob([receiptContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${transactionId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleEmailReceipt = async () => {
    if (onEmailReceipt) {
      // Use the callback if provided
      onEmailReceipt();
    } else {
      // Send email directly if no callback provided
      try {
        const response = await fetch('/api/payment/email-receipt', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            transactionId: transactionId,
            email: billingEmail
          }),
        });

        if (response.ok) {
          toast({
            title: "Receipt Sent",
            description: `Receipt has been sent to ${billingEmail}`,
          });
        } else {
          toast({
            title: "Error",
            description: "Failed to send receipt. Please try again.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('Error sending receipt:', error);
        toast({
          title: "Error",
          description: "Failed to send receipt. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Success Header */}
      <div className="text-center mb-6">
        <div className="flex justify-center mb-4">
          <CheckCircle className="w-16 h-16 text-green-500" />
        </div>
        <h1 className="text-3xl font-bold text-green-600 mb-2">Payment Successful!</h1>
        <p className="text-gray-600">Your payment has been processed successfully.</p>
      </div>

      {/* Receipt Card */}
      <Card className="mb-6">
        <CardHeader className="text-center border-b">
          <CardTitle className="flex items-center justify-center gap-2">
            <Receipt className="w-5 h-5" />
            Payment Receipt
          </CardTitle>
          <p className="text-sm text-gray-500">FreightClear Workflows</p>
        </CardHeader>
        
        <CardContent className="p-6">
          {/* Transaction Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="font-semibold text-gray-700 mb-3">Transaction Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Transaction ID:</span>
                  <span className="font-mono font-medium">{transactionId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Authorization Code:</span>
                  <span className="font-mono font-medium">{authCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Invoice Number:</span>
                  <span className="font-medium">{invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Date:</span>
                  <span>{formatDate(timestamp)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className="text-green-600 font-medium">APPROVED</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-gray-700 mb-3">Payment Information</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Amount:</span>
                  <span className="font-bold text-lg">${amount.toFixed(2)} USD</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Payment Method:</span>
                  <div className="flex items-center gap-1">
                    <CreditCard className="w-4 h-4" />
                    <span>{cardType} ****{cardLast4}</span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Cardholder:</span>
                  <span>{billingName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Email:</span>
                  <span className="text-xs">{billingEmail}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Security Notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Security Information</p>
              <p>This transaction was processed securely using SSL encryption. 
              Your credit card information was not stored and is protected by Authorize.Net.</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 justify-center">
            <Button 
              onClick={handlePrint}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Receipt className="w-4 h-4" />
              Print Receipt
            </Button>
            
            <Button 
              onClick={handleDownload}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download
            </Button>
            
            <Button 
              onClick={handleEmailReceipt}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Mail className="w-4 h-4" />
              Email Receipt
            </Button>
            
            {onClose && (
              <Button 
                onClick={onClose}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Continue
              </Button>
            )}
          </div>
        </CardContent>
      </Card>


    </div>
  );
}