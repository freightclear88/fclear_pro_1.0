/**
 * Authorize.Net Payment Processing Test
 * This script tests the payment processing functionality with test card data
 */

import ApiContracts from 'authorizenet/lib/apicontracts.js';
import ApiControllers from 'authorizenet/lib/apicontrollers.js';
import SDKConstants from 'authorizenet/lib/constants.js';

// Test configuration
const TEST_CONFIG = {
  apiLoginId: process.env.AUTHORIZE_NET_API_LOGIN_ID,
  transactionKey: process.env.AUTHORIZE_NET_TRANSACTION_KEY,
  environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
  
  // Test payment data
  testPayment: {
    amount: '10.00',
    cardNumber: '4111111111111111', // Test Visa card
    expirationDate: '1225', // December 2025
    cardCode: '123',
    firstName: 'Test',
    lastName: 'User',
    company: 'FreightClear Test',
    address: '123 Test Street',
    city: 'Test City',
    state: 'CA',
    zip: '90210',
    country: 'US',
    email: 'test@freightclear.com'
  }
};

// Test transaction processing
async function testPaymentProcessing() {
  console.log('🔄 Starting Authorize.Net Payment Processing Test...');
  console.log(`Environment: ${TEST_CONFIG.environment}`);
  console.log(`API Login ID: ${TEST_CONFIG.apiLoginId?.substring(0, 4)}****`);
  
  try {
    // Validate API credentials
    if (!TEST_CONFIG.apiLoginId || !TEST_CONFIG.transactionKey) {
      throw new Error('Missing Authorize.Net API credentials');
    }

    // Create merchant authentication
    const merchantAuthenticationType = new ApiContracts.MerchantAuthenticationType();
    merchantAuthenticationType.setName(TEST_CONFIG.apiLoginId);
    merchantAuthenticationType.setTransactionKey(TEST_CONFIG.transactionKey);

    // Create credit card payment method
    const creditCard = new ApiContracts.CreditCardType();
    creditCard.setCardNumber(TEST_CONFIG.testPayment.cardNumber);
    creditCard.setExpirationDate(TEST_CONFIG.testPayment.expirationDate);
    creditCard.setCardCode(TEST_CONFIG.testPayment.cardCode);

    const paymentType = new ApiContracts.PaymentType();
    paymentType.setCreditCard(creditCard);

    // Create billing address
    const billTo = new ApiContracts.CustomerAddressType();
    billTo.setFirstName(TEST_CONFIG.testPayment.firstName);
    billTo.setLastName(TEST_CONFIG.testPayment.lastName);
    billTo.setCompany(TEST_CONFIG.testPayment.company);
    billTo.setAddress(TEST_CONFIG.testPayment.address);
    billTo.setCity(TEST_CONFIG.testPayment.city);
    billTo.setState(TEST_CONFIG.testPayment.state);
    billTo.setZip(TEST_CONFIG.testPayment.zip);
    billTo.setCountry(TEST_CONFIG.testPayment.country);

    // Create customer data
    const customerData = new ApiContracts.CustomerDataType();
    customerData.setType(ApiContracts.CustomerTypeEnum.INDIVIDUAL);
    customerData.setEmail(TEST_CONFIG.testPayment.email);

    // Create transaction request
    const transactionRequest = new ApiContracts.TransactionRequestType();
    transactionRequest.setTransactionType(ApiContracts.TransactionTypeEnum.AUTHCAPTURETRANSACTION);
    transactionRequest.setPayment(paymentType);
    transactionRequest.setAmount(TEST_CONFIG.testPayment.amount);
    transactionRequest.setBillTo(billTo);
    transactionRequest.setCustomer(customerData);
    
    // Add order information
    const order = new ApiContracts.OrderType();
    order.setInvoiceNumber('TEST-' + Date.now());
    order.setDescription('FreightClear Payment Processing Test');
    transactionRequest.setOrder(order);

    // Create the main request
    const createRequest = new ApiContracts.CreateTransactionRequest();
    createRequest.setMerchantAuthentication(merchantAuthenticationType);
    createRequest.setTransactionRequest(transactionRequest);

    // Execute the request
    const ctrl = new ApiControllers.CreateTransactionController(createRequest.getJSON());
    
    // Set environment
    if (TEST_CONFIG.environment === 'production') {
      ctrl.setEnvironment(SDKConstants.endpoint.production);
    } else {
      ctrl.setEnvironment(SDKConstants.endpoint.sandbox);
    }

    console.log('📡 Sending payment request to Authorize.Net...');

    // Process the transaction
    const result = await new Promise((resolve, reject) => {
      ctrl.execute(() => {
        try {
          const apiResponse = ctrl.getResponse();
          const response = new ApiContracts.CreateTransactionResponse(apiResponse);
          resolve(response);
        } catch (error) {
          reject(error);
        }
      });
    });

    // Process response
    if (result.getMessages().getResultCode() === ApiContracts.MessageTypeEnum.OK) {
      const transactionResponse = result.getTransactionResponse();
      
      if (transactionResponse && transactionResponse.getResponseCode() === '1') {
        // Transaction approved
        console.log('✅ PAYMENT TEST SUCCESSFUL!');
        console.log(`Transaction ID: ${transactionResponse.getTransId()}`);
        console.log(`Auth Code: ${transactionResponse.getAuthCode()}`);
        console.log(`Response Code: ${transactionResponse.getResponseCode()}`);
        console.log(`Amount Processed: $${TEST_CONFIG.testPayment.amount}`);
        
        return {
          success: true,
          transactionId: transactionResponse.getTransId(),
          authCode: transactionResponse.getAuthCode(),
          responseCode: transactionResponse.getResponseCode(),
          amount: TEST_CONFIG.testPayment.amount
        };
      } else {
        // Transaction declined
        const errorCode = transactionResponse?.getErrors()?.getError()?.[0]?.getErrorCode() || 'Unknown';
        const errorText = transactionResponse?.getErrors()?.getError()?.[0]?.getErrorText() || 'Transaction declined';
        
        console.log('❌ PAYMENT TEST FAILED - Transaction Declined');
        console.log(`Error Code: ${errorCode}`);
        console.log(`Error Text: ${errorText}`);
        
        return {
          success: false,
          error: errorText,
          errorCode: errorCode
        };
      }
    } else {
      // API error
      const errorMessage = result.getMessages().getMessage()[0].getText();
      console.log('❌ PAYMENT TEST FAILED - API Error');
      console.log(`Error: ${errorMessage}`);
      
      return {
        success: false,
        error: errorMessage
      };
    }

  } catch (error) {
    console.log('❌ PAYMENT TEST FAILED - Exception');
    console.error('Error:', error.message);
    
    return {
      success: false,
      error: error.message
    };
  }
}

// Test different payment scenarios
async function runPaymentTests() {
  console.log('🧪 Running Comprehensive Payment Tests\n');
  
  const tests = [
    {
      name: 'Valid Payment Test',
      amount: '10.00',
      cardNumber: '4111111111111111' // Valid test card
    },
    {
      name: 'Declined Payment Test',
      amount: '10.00', 
      cardNumber: '4000000000000002' // Test card that gets declined
    },
    {
      name: 'Invalid Card Test',
      amount: '10.00',
      cardNumber: '4111111111111112' // Invalid test card
    }
  ];
  
  const results = [];
  
  for (const test of tests) {
    console.log(`\n🔍 Running: ${test.name}`);
    console.log(`Amount: $${test.amount}`);
    console.log(`Card: ****${test.cardNumber.slice(-4)}`);
    
    // Update test config for this test
    TEST_CONFIG.testPayment.amount = test.amount;
    TEST_CONFIG.testPayment.cardNumber = test.cardNumber;
    
    const result = await testPaymentProcessing();
    results.push({
      testName: test.name,
      ...result
    });
    
    console.log('-------------------');
  }
  
  // Summary
  console.log('\n📊 PAYMENT TEST SUMMARY:');
  results.forEach(result => {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${result.testName}`);
    if (result.transactionId) {
      console.log(`   Transaction ID: ${result.transactionId}`);
    }
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });
  
  return results;
}

// Export for use in other modules
export { testPaymentProcessing, runPaymentTests };

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runPaymentTests()
    .then(() => {
      console.log('\n🏁 Payment testing completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('Payment testing failed:', error);
      process.exit(1);
    });
}