/**
 * Direct Authorize.Net API Test
 * Tests payment processing without going through authentication
 */

import ApiContracts from 'authorizenet/lib/apicontracts.js';
import ApiControllers from 'authorizenet/lib/apicontrollers.js';
import SDKConstants from 'authorizenet/lib/constants.js';

async function testAuthorizeNetDirectly() {
  console.log('🔄 Testing Authorize.Net API directly...');
  
  const apiLoginId = process.env.AUTHORIZE_NET_API_LOGIN_ID;
  const transactionKey = process.env.AUTHORIZE_NET_TRANSACTION_KEY;
  
  if (!apiLoginId || !transactionKey) {
    console.log('❌ Missing API credentials');
    return false;
  }
  
  console.log(`API Login ID: ${apiLoginId.substring(0, 4)}****`);
  console.log(`Environment: ${process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'}`);
  
  try {
    // Create merchant authentication
    const merchantAuthenticationType = new ApiContracts.MerchantAuthenticationType();
    merchantAuthenticationType.setName(apiLoginId);
    merchantAuthenticationType.setTransactionKey(transactionKey);

    // Create credit card payment
    const creditCard = new ApiContracts.CreditCardType();
    creditCard.setCardNumber('4111111111111111'); // Test Visa
    creditCard.setExpirationDate('1225');
    creditCard.setCardCode('123');

    const paymentType = new ApiContracts.PaymentType();
    paymentType.setCreditCard(creditCard);

    // Create billing info
    const billTo = new ApiContracts.CustomerAddressType();
    billTo.setFirstName('Test');
    billTo.setLastName('User');
    billTo.setCompany('FreightClear Test');
    billTo.setAddress('123 Test St');
    billTo.setCity('Test City');
    billTo.setState('CA');
    billTo.setZip('90210');

    // Create customer
    const customerData = new ApiContracts.CustomerDataType();
    customerData.setType(ApiContracts.CustomerTypeEnum.INDIVIDUAL);
    customerData.setEmail('test@freightclear.com');

    // Create transaction
    const transactionRequest = new ApiContracts.TransactionRequestType();
    transactionRequest.setTransactionType(ApiContracts.TransactionTypeEnum.AUTHCAPTURETRANSACTION);
    transactionRequest.setPayment(paymentType);
    transactionRequest.setAmount('1.00'); // $1.00 test amount
    transactionRequest.setBillTo(billTo);
    transactionRequest.setCustomer(customerData);

    // Add order info
    const order = new ApiContracts.OrderType();
    order.setInvoiceNumber('TEST-' + Date.now());
    order.setDescription('FreightClear Payment Test');
    transactionRequest.setOrder(order);

    // Create request
    const createRequest = new ApiContracts.CreateTransactionRequest();
    createRequest.setMerchantAuthentication(merchantAuthenticationType);
    createRequest.setTransactionRequest(transactionRequest);

    // Create controller
    const ctrl = new ApiControllers.CreateTransactionController(createRequest.getJSON());
    
    // Set environment - use string constants instead of SDKConstants
    if (process.env.NODE_ENV === 'production') {
      ctrl.setEnvironment('https://api.authorize.net/xml/v1/request.api');
    } else {
      ctrl.setEnvironment('https://apitest.authorize.net/xml/v1/request.api');
    }

    console.log('📡 Sending payment request...');

    // Execute the transaction
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

    // Check result
    if (result.getMessages().getResultCode() === ApiContracts.MessageTypeEnum.OK) {
      const transactionResponse = result.getTransactionResponse();
      
      if (transactionResponse && transactionResponse.getResponseCode() === '1') {
        console.log('✅ PAYMENT SUCCESSFUL!');
        console.log(`Transaction ID: ${transactionResponse.getTransId()}`);
        console.log(`Auth Code: ${transactionResponse.getAuthCode()}`);
        console.log(`Response Code: ${transactionResponse.getResponseCode()}`);
        console.log('Amount: $1.00');
        
        return {
          success: true,
          transactionId: transactionResponse.getTransId(),
          authCode: transactionResponse.getAuthCode()
        };
      } else {
        // Transaction declined
        const errors = transactionResponse?.getErrors()?.getError();
        const errorCode = errors?.[0]?.getErrorCode() || 'Unknown';
        const errorText = errors?.[0]?.getErrorText() || 'Transaction declined';
        
        console.log('❌ PAYMENT DECLINED');
        console.log(`Error Code: ${errorCode}`);
        console.log(`Error Text: ${errorText}`);
        
        return { success: false, error: errorText, errorCode };
      }
    } else {
      // API error
      const messages = result.getMessages().getMessage();
      const errorMessage = messages?.[0]?.getText() || 'Unknown API error';
      
      console.log('❌ API ERROR');
      console.log(`Error: ${errorMessage}`);
      
      return { success: false, error: errorMessage };
    }

  } catch (error) {
    console.log('❌ EXCEPTION');
    console.error('Error:', error.message);
    return { success: false, error: error.message };
  }
}

// Test with different scenarios
async function runPaymentTests() {
  console.log('🧪 Running Authorize.Net Payment Tests\n');
  
  const results = [];
  
  // Test 1: Valid payment
  console.log('Test 1: Valid Payment');
  const result1 = await testAuthorizeNetDirectly();
  results.push({ test: 'Valid Payment', ...result1 });
  
  console.log('\n-------------------\n');
  
  // Test 2: API connectivity
  console.log('Test 2: API Connectivity Check');
  const apiLoginId = process.env.AUTHORIZE_NET_API_LOGIN_ID;
  const transactionKey = process.env.AUTHORIZE_NET_TRANSACTION_KEY;
  
  if (apiLoginId && transactionKey) {
    console.log('✅ API credentials configured');
    console.log(`Login ID: ${apiLoginId.substring(0, 4)}****`);
    console.log(`Transaction Key: ${transactionKey.substring(0, 4)}****`);
    results.push({ test: 'API Configuration', success: true });
  } else {
    console.log('❌ API credentials missing');
    results.push({ test: 'API Configuration', success: false, error: 'Missing credentials' });
  }
  
  // Summary
  console.log('\n📊 TEST SUMMARY:');
  results.forEach(result => {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${result.test}`);
    if (result.transactionId) {
      console.log(`   Transaction ID: ${result.transactionId}`);
    }
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });
  
  return results;
}

// Run the tests
runPaymentTests()
  .then(() => {
    console.log('\n🏁 Payment testing completed');
  })
  .catch(error => {
    console.error('Testing failed:', error);
  });