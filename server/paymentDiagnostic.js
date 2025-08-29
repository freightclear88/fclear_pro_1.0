/**
 * Comprehensive Authorize.Net Diagnostic Test
 * This will help identify the exact issue with the payment processing
 */

import ApiContracts from 'authorizenet/lib/apicontracts.js';
import ApiControllers from 'authorizenet/lib/apicontrollers.js';

async function runDiagnostics() {
  console.log('🔍 AUTHORIZE.NET DIAGNOSTIC TEST');
  console.log('================================\n');
  
  // Check environment variables
  const apiLoginId = process.env.AUTHORIZE_NET_API_LOGIN_ID;
  const transactionKey = process.env.AUTHORIZE_NET_TRANSACTION_KEY;
  const clientKey = process.env.authorize_client_key2;
  
  console.log('1. ENVIRONMENT VARIABLES CHECK:');
  console.log(`   API Login ID: ${apiLoginId ? apiLoginId.substring(0, 6) + '****' : 'MISSING'}`);
  console.log(`   Transaction Key: ${transactionKey ? transactionKey.substring(0, 6) + '****' : 'MISSING'}`);
  console.log(`   Client Key: ${clientKey ? clientKey.substring(0, 6) + '****' : 'MISSING'}`);
  console.log(`   Node Environment: ${process.env.NODE_ENV || 'development'}`);
  
  if (!apiLoginId || !transactionKey) {
    console.log('❌ CRITICAL: Missing required API credentials\n');
    return;
  }
  
  console.log('✅ All required credentials present\n');
  
  // Test 1: Basic merchant auth test
  console.log('2. MERCHANT AUTHENTICATION TEST:');
  try {
    const merchantAuth = new ApiContracts.MerchantAuthenticationType();
    merchantAuth.setName(apiLoginId);
    merchantAuth.setTransactionKey(transactionKey);
    console.log('✅ Merchant authentication object created successfully\n');
  } catch (error) {
    console.log(`❌ Failed to create merchant auth: ${error.message}\n`);
    return;
  }
  
  // Test 2: Test a simple getTransactionDetails request (this doesn't require a real transaction)
  console.log('3. API CONNECTIVITY TEST:');
  try {
    const merchantAuth = new ApiContracts.MerchantAuthenticationType();
    merchantAuth.setName(apiLoginId);
    merchantAuth.setTransactionKey(transactionKey);
    
    // Try to get merchant details (this validates credentials without charging)
    const getMerchantDetailsRequest = new ApiContracts.GetMerchantDetailsRequest();
    getMerchantDetailsRequest.setMerchantAuthentication(merchantAuth);
    
    const ctrl = new ApiControllers.GetMerchantDetailsController(getMerchantDetailsRequest.getJSON());
    ctrl.setEnvironment('https://apitest.authorize.net/xml/v1/request.api'); // Sandbox
    
    const result = await new Promise((resolve, reject) => {
      ctrl.execute(() => {
        try {
          const apiResponse = ctrl.getResponse();
          const response = new ApiContracts.GetMerchantDetailsResponse(apiResponse);
          resolve(response);
        } catch (error) {
          reject(error);
        }
      });
    });
    
    if (result.getMessages().getResultCode() === ApiContracts.MessageTypeEnum.OK) {
      console.log('✅ API credentials are VALID!');
      console.log('✅ Successfully connected to Authorize.Net sandbox');
      const merchantDetails = result.getMerchantDetails();
      if (merchantDetails) {
        console.log(`   Account: ${merchantDetails.getAccountName() || 'N/A'}`);
        console.log(`   Gateway ID: ${merchantDetails.getGatewayId() || 'N/A'}`);
      }
    } else {
      const messages = result.getMessages().getMessage();
      const errorMessage = messages?.[0]?.getText() || 'Unknown error';
      console.log(`❌ API Error: ${errorMessage}`);
    }
    
  } catch (error) {
    console.log(`❌ Connection failed: ${error.message}`);
  }
  
  console.log('\n4. PAYMENT PROCESSING TEST:');
  
  // Test 3: Try a simple $0.01 transaction
  try {
    const merchantAuth = new ApiContracts.MerchantAuthenticationType();
    merchantAuth.setName(apiLoginId);
    merchantAuth.setTransactionKey(transactionKey);

    // Create a very simple transaction
    const creditCard = new ApiContracts.CreditCardType();
    creditCard.setCardNumber('4111111111111111'); // Test Visa
    creditCard.setExpirationDate('1225');
    creditCard.setCardCode('123');

    const paymentType = new ApiContracts.PaymentType();
    paymentType.setCreditCard(creditCard);

    const transactionRequest = new ApiContracts.TransactionRequestType();
    transactionRequest.setTransactionType(ApiContracts.TransactionTypeEnum.AUTHCAPTURETRANSACTION);
    transactionRequest.setPayment(paymentType);
    transactionRequest.setAmount('0.01'); // Minimal test amount

    const createRequest = new ApiContracts.CreateTransactionRequest();
    createRequest.setMerchantAuthentication(merchantAuth);
    createRequest.setTransactionRequest(transactionRequest);

    const ctrl = new ApiControllers.CreateTransactionController(createRequest.getJSON());
    ctrl.setEnvironment('https://apitest.authorize.net/xml/v1/request.api');

    console.log('   Attempting $0.01 test transaction...');

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

    if (result.getMessages().getResultCode() === ApiContracts.MessageTypeEnum.OK) {
      const transactionResponse = result.getTransactionResponse();
      
      if (transactionResponse && transactionResponse.getResponseCode() === '1') {
        console.log('✅ PAYMENT PROCESSING SUCCESSFUL!');
        console.log(`   Transaction ID: ${transactionResponse.getTransId()}`);
        console.log(`   Auth Code: ${transactionResponse.getAuthCode()}`);
        console.log('   Amount: $0.01');
        console.log('\n🎉 PAYMENT SYSTEM IS FULLY FUNCTIONAL!');
      } else {
        const errors = transactionResponse?.getErrors()?.getError();
        const errorText = errors?.[0]?.getErrorText() || 'Transaction declined';
        console.log(`❌ Transaction declined: ${errorText}`);
      }
    } else {
      const messages = result.getMessages().getMessage();
      const errorMessage = messages?.[0]?.getText() || 'Unknown error';
      console.log(`❌ Payment API Error: ${errorMessage}`);
    }
    
  } catch (error) {
    console.log(`❌ Payment test failed: ${error.message}`);
  }
  
  console.log('\n================================');
  console.log('DIAGNOSTIC COMPLETE');
}

runDiagnostics()
  .then(() => {
    console.log('Diagnostic test completed successfully');
  })
  .catch(error => {
    console.error('Diagnostic test failed:', error);
  });