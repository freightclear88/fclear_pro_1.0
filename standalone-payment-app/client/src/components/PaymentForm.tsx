import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, Shield, Lock, AlertCircle, Info } from "lucide-react";

declare global {
  interface Window {
    Accept: {
      dispatchData: (acceptData: any, responseHandler: (response: any) => void) => void;
    };
  }
}

interface PaymentConfig {
  success: boolean;
  apiLoginId: string;
  clientKey: string;
  environment: 'sandbox' | 'production';
  serviceFeeRate: number;
}

interface BillingAddress {
  firstName: string;
  lastName: string;
  company: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone: string;
  email: string;
}

interface PaymentFormData {
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  cardCode: string;
  cardholderName: string;
  billingAddress: BillingAddress;
  amount: string;
  invoiceNumber: string;
  description: string;
  agreeToTerms: boolean;
  acknowledgeFee: boolean;
}

const STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1).padStart(2, '0'),
  label: `${String(i + 1).padStart(2, '0')} - ${new Date(0, i).toLocaleString('en', { month: 'long' })}`
}));

const YEARS = Array.from({ length: 21 }, (_, i) => {
  const year = new Date().getFullYear() + i;
  return { value: year.toString(), label: year.toString() };
});

export default function PaymentForm() {
  const [, setLocation] = useLocation();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAcceptJsLoaded, setIsAcceptJsLoaded] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  
  const { data: paymentConfig, isLoading: configLoading } = useQuery<PaymentConfig>({
    queryKey: ['/api/payment/config'],
  });
  
  const serviceFeeRate = paymentConfig?.serviceFeeRate || 0.035;
  
  const [formData, setFormData] = useState<PaymentFormData>({
    cardNumber: '',
    expiryMonth: '',
    expiryYear: '',
    cardCode: '',
    cardholderName: '',
    billingAddress: {
      firstName: '',
      lastName: '',
      company: '',
      address: '',
      city: '',
      state: '',
      zip: '',
      country: 'US',
      phone: '',
      email: ''
    },
    amount: '',
    invoiceNumber: '',
    description: '',
    agreeToTerms: false,
    acknowledgeFee: false,
  });

  const amount = parseFloat(formData.amount) || 0;
  const serviceFee = amount * serviceFeeRate;
  const totalAmount = amount + serviceFee;

  useEffect(() => {
    if (paymentConfig?.success && !isAcceptJsLoaded) {
      if (window.Accept) {
        setIsAcceptJsLoaded(true);
        return;
      }
      
      const existingScripts = document.querySelectorAll('script[src*="Accept.js"]');
      existingScripts.forEach(script => script.remove());
      
      const script = document.createElement('script');
      script.src = paymentConfig.environment === 'production'
        ? 'https://js.authorize.net/v1/Accept.js'
        : 'https://jstest.authorize.net/v1/Accept.js';
      script.type = 'text/javascript';
      script.charset = 'utf-8';
      
      script.onload = () => {
        let attempts = 0;
        const checkAccept = () => {
          attempts++;
          if (window.Accept && typeof window.Accept.dispatchData === 'function') {
            setIsAcceptJsLoaded(true);
          } else if (attempts < 20) {
            setTimeout(checkAccept, 100);
          }
        };
        checkAccept();
      };
      
      document.head.appendChild(script);
    }
  }, [paymentConfig, isAcceptJsLoaded]);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      errors.amount = 'Please enter a valid amount';
    }
    if (!formData.cardNumber || formData.cardNumber.replace(/\s/g, '').length < 13) {
      errors.cardNumber = 'Please enter a valid card number';
    }
    if (!formData.expiryMonth) errors.expiryMonth = 'Required';
    if (!formData.expiryYear) errors.expiryYear = 'Required';
    if (!formData.cardCode || formData.cardCode.length < 3) {
      errors.cardCode = 'Please enter a valid security code';
    }
    if (!formData.cardholderName) errors.cardholderName = 'Cardholder name is required';
    if (!formData.billingAddress.firstName) errors.firstName = 'First name is required';
    if (!formData.billingAddress.lastName) errors.lastName = 'Last name is required';
    if (!formData.billingAddress.address) errors.address = 'Address is required';
    if (!formData.billingAddress.city) errors.city = 'City is required';
    if (!formData.billingAddress.state) errors.state = 'State is required';
    if (!formData.billingAddress.zip) errors.zip = 'ZIP code is required';
    if (!formData.billingAddress.email) errors.email = 'Email is required';
    if (!formData.agreeToTerms) errors.terms = 'You must agree to the terms';
    if (!formData.acknowledgeFee) errors.fee = 'You must acknowledge the service fee';
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!validateForm()) return;
    if (!isAcceptJsLoaded || !paymentConfig) {
      setError('Payment system not ready. Please wait and try again.');
      return;
    }
    
    setIsProcessing(true);
    
    try {
      const acceptData = {
        authData: {
          clientKey: paymentConfig.clientKey,
          apiLoginID: paymentConfig.apiLoginId,
        },
        cardData: {
          cardNumber: formData.cardNumber.replace(/\s/g, ''),
          month: formData.expiryMonth,
          year: formData.expiryYear,
          cardCode: formData.cardCode,
          fullName: formData.cardholderName,
          zip: formData.billingAddress.zip,
        },
      };
      
      window.Accept.dispatchData(acceptData, async (response: any) => {
        if (response.messages.resultCode === 'Error') {
          setError(response.messages.message[0].text);
          setIsProcessing(false);
          return;
        }
        
        try {
          const paymentResponse = await fetch('/api/payment/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              opaqueData: response.opaqueData,
              amount: amount.toFixed(2),
              serviceFee: serviceFee.toFixed(2),
              totalAmount: totalAmount.toFixed(2),
              invoiceNumber: formData.invoiceNumber,
              description: formData.description,
              billingAddress: formData.billingAddress,
              cardholderName: formData.cardholderName,
            }),
          });
          
          const result = await paymentResponse.json();
          
          if (result.success) {
            setLocation(`/success?transactionId=${result.transactionId}&amount=${totalAmount.toFixed(2)}`);
          } else {
            setError(result.message || 'Payment failed');
          }
        } catch (err) {
          setError('Payment processing failed. Please try again.');
        }
        
        setIsProcessing(false);
      });
    } catch (err) {
      setError('An unexpected error occurred');
      setIsProcessing(false);
    }
  };

  const updateBillingAddress = (field: keyof BillingAddress, value: string) => {
    setFormData(prev => ({
      ...prev,
      billingAddress: { ...prev.billingAddress, [field]: value }
    }));
  };

  if (configLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-900">Payment Information</h3>
            <p className="text-sm text-blue-700 mt-1">
              All credit card payments are subject to a <strong>3.5% service fee</strong>.
              Checks and wire transfers are also accepted. Contact our accounting department for alternative payment arrangements.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center gap-3 mb-6">
          <CreditCard className="h-6 w-6 text-blue-600" />
          <h2 className="text-xl font-semibold">Secure Payment</h2>
          <div className="ml-auto flex items-center gap-2 text-green-600">
            <Shield className="h-4 w-4" />
            <span className="text-sm">PCI Compliant</span>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Amount ($)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={formData.amount}
                onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${formErrors.amount ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="0.00"
              />
              {formErrors.amount && <p className="text-red-500 text-xs mt-1">{formErrors.amount}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Invoice Number (Optional)</label>
              <input
                type="text"
                value={formData.invoiceNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="INV-001"
              />
            </div>
          </div>

          {amount > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span>${amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-amber-600">
                <span>Service Fee (3.5%):</span>
                <span>${serviceFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg mt-2 pt-2 border-t">
                <span>Total:</span>
                <span>${totalAmount.toFixed(2)}</span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Card Number</label>
            <div className="relative">
              <input
                type="text"
                value={formData.cardNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, cardNumber: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${formErrors.cardNumber ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="4111 1111 1111 1111"
                maxLength={19}
              />
              <Lock className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>
            {formErrors.cardNumber && <p className="text-red-500 text-xs mt-1">{formErrors.cardNumber}</p>}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Month</label>
              <select
                value={formData.expiryMonth}
                onChange={(e) => setFormData(prev => ({ ...prev, expiryMonth: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${formErrors.expiryMonth ? 'border-red-500' : 'border-gray-300'}`}
              >
                <option value="">MM</option>
                {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Year</label>
              <select
                value={formData.expiryYear}
                onChange={(e) => setFormData(prev => ({ ...prev, expiryYear: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${formErrors.expiryYear ? 'border-red-500' : 'border-gray-300'}`}
              >
                <option value="">YYYY</option>
                {YEARS.map(y => <option key={y.value} value={y.value}>{y.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">CVV</label>
              <input
                type="text"
                value={formData.cardCode}
                onChange={(e) => setFormData(prev => ({ ...prev, cardCode: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${formErrors.cardCode ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="123"
                maxLength={4}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Cardholder Name</label>
            <input
              type="text"
              value={formData.cardholderName}
              onChange={(e) => setFormData(prev => ({ ...prev, cardholderName: e.target.value }))}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${formErrors.cardholderName ? 'border-red-500' : 'border-gray-300'}`}
              placeholder="John Smith"
            />
            {formErrors.cardholderName && <p className="text-red-500 text-xs mt-1">{formErrors.cardholderName}</p>}
          </div>

          <div className="border-t pt-6">
            <h3 className="font-medium mb-4">Billing Address</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">First Name</label>
                <input
                  type="text"
                  value={formData.billingAddress.firstName}
                  onChange={(e) => updateBillingAddress('firstName', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${formErrors.firstName ? 'border-red-500' : 'border-gray-300'}`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Last Name</label>
                <input
                  type="text"
                  value={formData.billingAddress.lastName}
                  onChange={(e) => updateBillingAddress('lastName', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${formErrors.lastName ? 'border-red-500' : 'border-gray-300'}`}
                />
              </div>
            </div>
            
            <div className="mt-4">
              <label className="block text-sm font-medium mb-1">Company (Optional)</label>
              <input
                type="text"
                value={formData.billingAddress.company}
                onChange={(e) => updateBillingAddress('company', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium mb-1">Address</label>
              <input
                type="text"
                value={formData.billingAddress.address}
                onChange={(e) => updateBillingAddress('address', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${formErrors.address ? 'border-red-500' : 'border-gray-300'}`}
              />
            </div>

            <div className="grid grid-cols-3 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium mb-1">City</label>
                <input
                  type="text"
                  value={formData.billingAddress.city}
                  onChange={(e) => updateBillingAddress('city', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${formErrors.city ? 'border-red-500' : 'border-gray-300'}`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">State</label>
                <select
                  value={formData.billingAddress.state}
                  onChange={(e) => updateBillingAddress('state', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${formErrors.state ? 'border-red-500' : 'border-gray-300'}`}
                >
                  <option value="">Select</option>
                  {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">ZIP</label>
                <input
                  type="text"
                  value={formData.billingAddress.zip}
                  onChange={(e) => updateBillingAddress('zip', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${formErrors.zip ? 'border-red-500' : 'border-gray-300'}`}
                  maxLength={10}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium mb-1">Phone</label>
                <input
                  type="tel"
                  value={formData.billingAddress.phone}
                  onChange={(e) => updateBillingAddress('phone', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={formData.billingAddress.email}
                  onChange={(e) => updateBillingAddress('email', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${formErrors.email ? 'border-red-500' : 'border-gray-300'}`}
                />
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-4">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={formData.acknowledgeFee}
                onChange={(e) => setFormData(prev => ({ ...prev, acknowledgeFee: e.target.checked }))}
                className="mt-1"
              />
              <span className="text-sm text-gray-600">
                I acknowledge that a <strong>3.5% service fee</strong> (${serviceFee.toFixed(2)}) will be added to my payment.
              </span>
            </label>
            {formErrors.fee && <p className="text-red-500 text-xs ml-6">{formErrors.fee}</p>}

            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={formData.agreeToTerms}
                onChange={(e) => setFormData(prev => ({ ...prev, agreeToTerms: e.target.checked }))}
                className="mt-1"
              />
              <span className="text-sm text-gray-600">
                I agree to the terms and conditions and authorize this payment.
              </span>
            </label>
            {formErrors.terms && <p className="text-red-500 text-xs ml-6">{formErrors.terms}</p>}
          </div>

          <button
            type="submit"
            disabled={isProcessing || !isAcceptJsLoaded}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Processing...
              </>
            ) : (
              <>
                <Lock className="h-5 w-5" />
                Pay ${totalAmount.toFixed(2)}
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
