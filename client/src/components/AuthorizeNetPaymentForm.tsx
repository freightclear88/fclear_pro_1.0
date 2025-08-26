import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle, CreditCard, Shield, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Authorize.Net Accept.js integration
declare global {
  interface Window {
    Accept: {
      dispatchData: (
        acceptData: any, 
        responseHandler: (response: any) => void
      ) => void;
    };
  }
}

interface PaymentConfig {
  success: boolean;
  apiLoginId: string;
  clientKey: string;
  environment: 'sandbox' | 'production';
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
  // Credit card information (handled by Accept.js - never stored)
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  cardCode: string;
  cardholderName: string;
  
  // Billing address information
  billingAddress: BillingAddress;
  
  // Payment details
  amount: string;
  invoiceNumber: string;
  description: string;
  
  // Terms and conditions
  agreeToTerms: boolean;
  
  // Service fee acknowledgment
  acknowledgeFee: boolean;
}

interface AuthorizeNetPaymentFormProps {
  paymentConfig: PaymentConfig;
  onPaymentSuccess: (response: any) => void;
  onPaymentError: (error: string) => void;
  initialData?: Partial<PaymentFormData>;
  amount: number;
  invoiceNumber: string;
  description?: string;
  serviceFeeRate?: number;
  showBillingAddress?: boolean;
  submitButtonText?: string;
  disabled?: boolean;
}

const STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

const MONTHS = [
  { value: '01', label: '01 - January' },
  { value: '02', label: '02 - February' },
  { value: '03', label: '03 - March' },
  { value: '04', label: '04 - April' },
  { value: '05', label: '05 - May' },
  { value: '06', label: '06 - June' },
  { value: '07', label: '07 - July' },
  { value: '08', label: '08 - August' },
  { value: '09', label: '09 - September' },
  { value: '10', label: '10 - October' },
  { value: '11', label: '11 - November' },
  { value: '12', label: '12 - December' }
];

// Generate years (current year + 20 years)
const YEARS = Array.from({ length: 21 }, (_, i) => {
  const year = new Date().getFullYear() + i;
  return { value: year.toString(), label: year.toString() };
});

export default function AuthorizeNetPaymentForm({
  paymentConfig,
  onPaymentSuccess,
  onPaymentError,
  initialData = {},
  amount,
  invoiceNumber,
  description = '',
  serviceFeeRate = 0.035,
  showBillingAddress = true,
  submitButtonText = 'Process Payment',
  disabled = false
}: AuthorizeNetPaymentFormProps) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAcceptJsLoaded, setIsAcceptJsLoaded] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  
  const serviceFee = amount * serviceFeeRate;
  const totalAmount = amount + serviceFee;
  
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
    amount: amount.toString(),
    invoiceNumber: invoiceNumber,
    description: description,
    agreeToTerms: false,
    acknowledgeFee: false,
    ...initialData
  });

  // Load Accept.js dynamically
  useEffect(() => {
    if (paymentConfig?.success && !isAcceptJsLoaded) {
      const script = document.createElement('script');
      script.src = paymentConfig.environment === 'sandbox' 
        ? 'https://jstest.authorize.net/v1/Accept.js'
        : 'https://js.authorize.net/v1/Accept.js';
      script.async = true;
      script.onload = () => setIsAcceptJsLoaded(true);
      script.onerror = () => {
        onPaymentError('Failed to load payment processing system');
      };
      document.head.appendChild(script);
      
      return () => {
        try {
          document.head.removeChild(script);
        } catch (e) {
          // Script may have already been removed
        }
      };
    }
  }, [paymentConfig, isAcceptJsLoaded, onPaymentError]);

  // Validation functions
  const validateCardNumber = (value: string): string | null => {
    const cleaned = value.replace(/\s+/g, '');
    if (!/^\d{13,19}$/.test(cleaned)) {
      return 'Card number must be 13-19 digits';
    }
    
    // Luhn algorithm validation
    let sum = 0;
    let isEven = false;
    for (let i = cleaned.length - 1; i >= 0; i--) {
      let digit = parseInt(cleaned.charAt(i), 10);
      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }
      sum += digit;
      isEven = !isEven;
    }
    
    if (sum % 10 !== 0) {
      return 'Invalid card number';
    }
    
    return null;
  };

  const validateCVV = (value: string): string | null => {
    if (!/^\d{3,4}$/.test(value)) {
      return 'CVV must be 3-4 digits';
    }
    return null;
  };

  const validateZip = (value: string): string | null => {
    if (!/^\d{5}(-\d{4})?$/.test(value)) {
      return 'Invalid ZIP code format';
    }
    return null;
  };

  const validateEmail = (value: string): string | null => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return 'Invalid email address';
    }
    return null;
  };

  const validatePhone = (value: string): string | null => {
    const phoneRegex = /^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/;
    if (!phoneRegex.test(value)) {
      return 'Invalid phone number format';
    }
    return null;
  };

  // Format card number input with spaces
  const formatCardNumber = (value: string): string => {
    const cleaned = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = cleaned.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];
    
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    
    if (parts.length) {
      return parts.join(' ');
    } else {
      return cleaned;
    }
  };

  // Handle form field changes
  const handleInputChange = (field: string, value: string) => {
    if (field === 'cardNumber') {
      value = formatCardNumber(value);
    }
    
    setFormData(prev => {
      if (field.startsWith('billingAddress.')) {
        const addressField = field.replace('billingAddress.', '');
        return {
          ...prev,
          billingAddress: {
            ...prev.billingAddress,
            [addressField]: value
          }
        };
      }
      return {
        ...prev,
        [field]: value
      };
    });
    
    // Clear error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  // Validate entire form
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    // Credit card validation
    const cardError = validateCardNumber(formData.cardNumber);
    if (cardError) errors.cardNumber = cardError;
    
    const cvvError = validateCVV(formData.cardCode);
    if (cvvError) errors.cardCode = cvvError;
    
    if (!formData.cardholderName.trim()) {
      errors.cardholderName = 'Cardholder name is required';
    }
    
    if (!formData.expiryMonth) {
      errors.expiryMonth = 'Expiry month is required';
    }
    
    if (!formData.expiryYear) {
      errors.expiryYear = 'Expiry year is required';
    }
    
    // Check if card is expired
    if (formData.expiryMonth && formData.expiryYear) {
      const now = new Date();
      const expiry = new Date(parseInt(formData.expiryYear), parseInt(formData.expiryMonth) - 1);
      if (expiry < now) {
        errors.expiryMonth = 'Card is expired';
      }
    }
    
    // Billing address validation (if shown)
    if (showBillingAddress) {
      if (!formData.billingAddress.firstName.trim()) {
        errors['billingAddress.firstName'] = 'First name is required';
      }
      
      if (!formData.billingAddress.lastName.trim()) {
        errors['billingAddress.lastName'] = 'Last name is required';
      }
      
      if (!formData.billingAddress.address.trim()) {
        errors['billingAddress.address'] = 'Address is required';
      }
      
      if (!formData.billingAddress.city.trim()) {
        errors['billingAddress.city'] = 'City is required';
      }
      
      if (!formData.billingAddress.state) {
        errors['billingAddress.state'] = 'State is required';
      }
      
      const zipError = validateZip(formData.billingAddress.zip);
      if (zipError) errors['billingAddress.zip'] = zipError;
      
      if (formData.billingAddress.email) {
        const emailError = validateEmail(formData.billingAddress.email);
        if (emailError) errors['billingAddress.email'] = emailError;
      }
      
      if (formData.billingAddress.phone) {
        const phoneError = validatePhone(formData.billingAddress.phone);
        if (phoneError) errors['billingAddress.phone'] = phoneError;
      }
    }
    
    // Terms validation
    if (!formData.agreeToTerms) {
      errors.agreeToTerms = 'You must agree to the terms and conditions';
    }
    
    if (!formData.acknowledgeFee) {
      errors.acknowledgeFee = 'You must acknowledge the service fee';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isAcceptJsLoaded) {
      onPaymentError('Payment system is still loading. Please wait and try again.');
      return;
    }
    
    if (!validateForm()) {
      toast({
        title: "Validation Error",
        description: "Please correct the highlighted errors",
        variant: "destructive",
      });
      return;
    }
    
    setIsProcessing(true);
    
    try {
      const acceptData = {
        clientKey: paymentConfig.clientKey,
        apiLoginID: paymentConfig.apiLoginId,
        paymentForm: {
          cardNumber: formData.cardNumber.replace(/\s/g, ''),
          month: formData.expiryMonth,
          year: formData.expiryYear,
          cardCode: formData.cardCode,
          zip: formData.billingAddress.zip,
          fullName: formData.cardholderName
        }
      };

      // Use Accept.js to tokenize payment data
      window.Accept.dispatchData(acceptData, (response: any) => {
        if (response.messages.resultCode === 'Ok') {
          // Payment data successfully tokenized
          const paymentData = {
            opaqueData: response.opaqueData,
            billingInfo: showBillingAddress ? formData.billingAddress : undefined,
            amount: totalAmount.toFixed(2),
            invoiceNumber: formData.invoiceNumber,
            description: formData.description,
            companyName: formData.billingAddress.company
          };
          
          onPaymentSuccess(paymentData);
        } else {
          // Payment tokenization failed
          const errorMessage = response.messages.message[0]?.text || 'Payment validation failed';
          onPaymentError(errorMessage);
          setIsProcessing(false);
        }
      });
      
    } catch (error) {
      onPaymentError('Failed to process payment. Please try again.');
      setIsProcessing(false);
    }
  };

  if (!paymentConfig?.success) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            <AlertCircle className="w-8 h-8 mx-auto mb-2" />
            <p>Payment system is not configured. Please contact support.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          Secure Payment Information
        </CardTitle>
        <div className="flex items-center gap-2 text-sm text-green-600">
          <Shield className="w-4 h-4" />
          <span>Protected by Authorize.Net SSL encryption</span>
        </div>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Payment Summary */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-medium mb-2">Payment Summary</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Amount:</span>
                <span>${amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Service Fee ({(serviceFeeRate * 100).toFixed(1)}%):</span>
                <span>${serviceFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-medium text-base border-t pt-1">
                <span>Total:</span>
                <span>${totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Credit Card Information */}
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Credit Card Information
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="cardholderName">Cardholder Name *</Label>
                <Input
                  id="cardholderName"
                  value={formData.cardholderName}
                  onChange={(e) => handleInputChange('cardholderName', e.target.value)}
                  placeholder="John Doe"
                  disabled={disabled || isProcessing}
                  className={formErrors.cardholderName ? 'border-red-500' : ''}
                />
                {formErrors.cardholderName && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.cardholderName}</p>
                )}
              </div>
              
              <div className="md:col-span-2">
                <Label htmlFor="cardNumber">Card Number *</Label>
                <Input
                  id="cardNumber"
                  value={formData.cardNumber}
                  onChange={(e) => handleInputChange('cardNumber', e.target.value)}
                  placeholder="1234 5678 9012 3456"
                  maxLength={23} // 19 digits + 4 spaces
                  disabled={disabled || isProcessing}
                  className={formErrors.cardNumber ? 'border-red-500' : ''}
                />
                {formErrors.cardNumber && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.cardNumber}</p>
                )}
              </div>
              
              <div>
                <Label htmlFor="expiryMonth">Expiry Month *</Label>
                <Select
                  value={formData.expiryMonth}
                  onValueChange={(value) => handleInputChange('expiryMonth', value)}
                  disabled={disabled || isProcessing}
                >
                  <SelectTrigger className={formErrors.expiryMonth ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map(month => (
                      <SelectItem key={month.value} value={month.value}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formErrors.expiryMonth && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.expiryMonth}</p>
                )}
              </div>
              
              <div>
                <Label htmlFor="expiryYear">Expiry Year *</Label>
                <Select
                  value={formData.expiryYear}
                  onValueChange={(value) => handleInputChange('expiryYear', value)}
                  disabled={disabled || isProcessing}
                >
                  <SelectTrigger className={formErrors.expiryYear ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {YEARS.map(year => (
                      <SelectItem key={year.value} value={year.value}>
                        {year.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formErrors.expiryYear && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.expiryYear}</p>
                )}
              </div>
              
              <div>
                <Label htmlFor="cardCode">CVV *</Label>
                <Input
                  id="cardCode"
                  value={formData.cardCode}
                  onChange={(e) => handleInputChange('cardCode', e.target.value.replace(/\D/g, ''))}
                  placeholder="123"
                  maxLength={4}
                  disabled={disabled || isProcessing}
                  className={formErrors.cardCode ? 'border-red-500' : ''}
                />
                {formErrors.cardCode && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.cardCode}</p>
                )}
              </div>
            </div>
          </div>

          {/* Billing Address */}
          {showBillingAddress && (
            <div className="space-y-4">
              <h3 className="font-medium">Billing Address</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    value={formData.billingAddress.firstName}
                    onChange={(e) => handleInputChange('billingAddress.firstName', e.target.value)}
                    disabled={disabled || isProcessing}
                    className={formErrors['billingAddress.firstName'] ? 'border-red-500' : ''}
                  />
                  {formErrors['billingAddress.firstName'] && (
                    <p className="text-red-500 text-xs mt-1">{formErrors['billingAddress.firstName']}</p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    value={formData.billingAddress.lastName}
                    onChange={(e) => handleInputChange('billingAddress.lastName', e.target.value)}
                    disabled={disabled || isProcessing}
                    className={formErrors['billingAddress.lastName'] ? 'border-red-500' : ''}
                  />
                  {formErrors['billingAddress.lastName'] && (
                    <p className="text-red-500 text-xs mt-1">{formErrors['billingAddress.lastName']}</p>
                  )}
                </div>
                
                <div className="md:col-span-2">
                  <Label htmlFor="company">Company</Label>
                  <Input
                    id="company"
                    value={formData.billingAddress.company}
                    onChange={(e) => handleInputChange('billingAddress.company', e.target.value)}
                    disabled={disabled || isProcessing}
                  />
                </div>
                
                <div className="md:col-span-2">
                  <Label htmlFor="address">Address *</Label>
                  <Input
                    id="address"
                    value={formData.billingAddress.address}
                    onChange={(e) => handleInputChange('billingAddress.address', e.target.value)}
                    disabled={disabled || isProcessing}
                    className={formErrors['billingAddress.address'] ? 'border-red-500' : ''}
                  />
                  {formErrors['billingAddress.address'] && (
                    <p className="text-red-500 text-xs mt-1">{formErrors['billingAddress.address']}</p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    value={formData.billingAddress.city}
                    onChange={(e) => handleInputChange('billingAddress.city', e.target.value)}
                    disabled={disabled || isProcessing}
                    className={formErrors['billingAddress.city'] ? 'border-red-500' : ''}
                  />
                  {formErrors['billingAddress.city'] && (
                    <p className="text-red-500 text-xs mt-1">{formErrors['billingAddress.city']}</p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="state">State *</Label>
                  <Select
                    value={formData.billingAddress.state}
                    onValueChange={(value) => handleInputChange('billingAddress.state', value)}
                    disabled={disabled || isProcessing}
                  >
                    <SelectTrigger className={formErrors['billingAddress.state'] ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Select State" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATES.map(state => (
                        <SelectItem key={state} value={state}>
                          {state}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formErrors['billingAddress.state'] && (
                    <p className="text-red-500 text-xs mt-1">{formErrors['billingAddress.state']}</p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="zip">ZIP Code *</Label>
                  <Input
                    id="zip"
                    value={formData.billingAddress.zip}
                    onChange={(e) => handleInputChange('billingAddress.zip', e.target.value)}
                    placeholder="12345"
                    disabled={disabled || isProcessing}
                    className={formErrors['billingAddress.zip'] ? 'border-red-500' : ''}
                  />
                  {formErrors['billingAddress.zip'] && (
                    <p className="text-red-500 text-xs mt-1">{formErrors['billingAddress.zip']}</p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.billingAddress.phone}
                    onChange={(e) => handleInputChange('billingAddress.phone', e.target.value)}
                    placeholder="(555) 123-4567"
                    disabled={disabled || isProcessing}
                    className={formErrors['billingAddress.phone'] ? 'border-red-500' : ''}
                  />
                  {formErrors['billingAddress.phone'] && (
                    <p className="text-red-500 text-xs mt-1">{formErrors['billingAddress.phone']}</p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.billingAddress.email}
                    onChange={(e) => handleInputChange('billingAddress.email', e.target.value)}
                    disabled={disabled || isProcessing}
                    className={formErrors['billingAddress.email'] ? 'border-red-500' : ''}
                  />
                  {formErrors['billingAddress.email'] && (
                    <p className="text-red-500 text-xs mt-1">{formErrors['billingAddress.email']}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Terms and Conditions */}
          <div className="space-y-4">
            <div className="flex items-start space-x-2">
              <Checkbox
                id="acknowledgeFee"
                checked={formData.acknowledgeFee}
                onCheckedChange={(checked) => handleInputChange('acknowledgeFee', checked ? 'true' : 'false')}
                disabled={disabled || isProcessing}
                className={formErrors.acknowledgeFee ? 'border-red-500' : ''}
              />
              <Label htmlFor="acknowledgeFee" className="text-sm leading-5">
                I acknowledge that a {(serviceFeeRate * 100).toFixed(1)}% service fee (${serviceFee.toFixed(2)}) 
                will be added to my payment, making the total ${totalAmount.toFixed(2)}.
              </Label>
            </div>
            {formErrors.acknowledgeFee && (
              <p className="text-red-500 text-xs">{formErrors.acknowledgeFee}</p>
            )}
            
            <div className="flex items-start space-x-2">
              <Checkbox
                id="agreeToTerms"
                checked={formData.agreeToTerms}
                onCheckedChange={(checked) => handleInputChange('agreeToTerms', checked ? 'true' : 'false')}
                disabled={disabled || isProcessing}
                className={formErrors.agreeToTerms ? 'border-red-500' : ''}
              />
              <Label htmlFor="agreeToTerms" className="text-sm leading-5">
                I agree to the Terms of Service and Privacy Policy. 
                I authorize FreightClear to charge my payment method for the total amount shown.
              </Label>
            </div>
            {formErrors.agreeToTerms && (
              <p className="text-red-500 text-xs">{formErrors.agreeToTerms}</p>
            )}
          </div>

          {/* Security Notice */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-start gap-2">
              <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium">Your payment is secure</p>
                <p>We use industry-standard SSL encryption and do not store your credit card information. 
                All payment processing is handled securely by Authorize.Net.</p>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full"
            disabled={disabled || isProcessing || !isAcceptJsLoaded}
            size="lg"
          >
            {isProcessing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Processing Payment...
              </>
            ) : !isAcceptJsLoaded ? (
              'Loading Payment System...'
            ) : (
              `${submitButtonText} - $${totalAmount.toFixed(2)}`
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}