const ApiContracts = require('authorizenet').APIContracts;
const ApiControllers = require('authorizenet').APIControllers;
const SDKConstants = require('authorizenet').Constants;

async function validateMerchantAccount(apiLoginId, transactionKey, isProduction = true) {
  return new Promise((resolve) => {
    try {
      console.log('🔍 Starting merchant account validation...');
      console.log(`   API Login ID: ${apiLoginId}`);
      console.log(`   Environment: ${isProduction ? 'PRODUCTION' : 'SANDBOX'}`);
      
      // Create merchant authentication
      const merchantAuthenticationType = new ApiContracts.MerchantAuthenticationType();
      merchantAuthenticationType.setName(apiLoginId);
      merchantAuthenticationType.setTransactionKey(transactionKey);

      // Create a minimal test transaction request
      const paymentType = new ApiContracts.PaymentType();
      const creditCard = new ApiContracts.CreditCardType();
      creditCard.setCardNumber('4111111111111111'); // Test card number
      creditCard.setExpirationDate('1225');
      creditCard.setCardCode('123');
      paymentType.setCreditCard(creditCard);

      const transactionRequest = new ApiContracts.TransactionRequestType();
      transactionRequest.setTransactionType(ApiContracts.TransactionTypeEnum.AUTHONLYTRANSACTION);
      transactionRequest.setPayment(paymentType);
      transactionRequest.setAmount('0.01'); // Minimal test amount

      const createRequest = new ApiContracts.CreateTransactionRequest();
      createRequest.setMerchantAuthentication(merchantAuthenticationType);
      createRequest.setTransactionRequest(transactionRequest);

      const ctrl = new ApiControllers.CreateTransactionController(createRequest.getJSON());
      
      // Set environment
      if (isProduction) {
        ctrl.setEnvironment(SDKConstants.endpoint.production);
      } else {
        ctrl.setEnvironment(SDKConstants.endpoint.sandbox);
      }

      ctrl.execute(() => {
        try {
          const apiResponse = ctrl.getResponse();
          const response = new ApiContracts.CreateTransactionResponse(apiResponse);
          
          console.log('📋 Merchant Account Validation Results:');
          console.log(`   Result Code: ${response.getMessages().getResultCode()}`);
          
          if (response.getMessages().getResultCode() === ApiContracts.MessageTypeEnum.OK) {
            const transactionResponse = response.getTransactionResponse();
            
            if (transactionResponse) {
              console.log(`   Transaction Response Code: ${transactionResponse.getResponseCode()}`);
              console.log(`   Auth Code: ${transactionResponse.getAuthCode()}`);
              
              if (transactionResponse.getResponseCode() === '1') {
                console.log('✅ ACCOUNT VALIDATION SUCCESSFUL');
                console.log('   Merchant account is active and properly configured');
                resolve({
                  valid: true,
                  status: 'active',
                  message: 'Merchant account validated successfully',
                  details: {
                    responseCode: transactionResponse.getResponseCode(),
                    authCode: transactionResponse.getAuthCode()
                  }
                });
              } else {
                const errors = transactionResponse.getErrors();
                const errorCode = errors?.getError()?.[0]?.getErrorCode() || 'Unknown';
                const errorText = errors?.getError()?.[0]?.getErrorText() || 'Transaction declined';
                
                console.log('⚠️ ACCOUNT VALIDATION DECLINED');
                console.log(`   Error Code: ${errorCode}`);
                console.log(`   Error Text: ${errorText}`);
                
                resolve({
                  valid: false,
                  status: 'declined',
                  message: `Account validation declined: ${errorText}`,
                  details: {
                    errorCode: errorCode,
                    errorText: errorText
                  }
                });
              }
            } else {
              console.log('❌ NO TRANSACTION RESPONSE');
              resolve({
                valid: false,
                status: 'no_response',
                message: 'No transaction response received'
              });
            }
          } else {
            const errorMessage = response.getMessages().getMessage()[0].getText();
            const errorCode = response.getMessages().getMessage()[0].getCode();
            
            console.log('❌ API AUTHENTICATION FAILED');
            console.log(`   Error Code: ${errorCode}`);
            console.log(`   Error Message: ${errorMessage}`);
            
            // Specific error handling
            let diagnosis = 'Unknown authentication error';
            if (errorCode === 'E00007') {
              diagnosis = 'Invalid API Login ID or Transaction Key';
            } else if (errorCode === 'E00001') {
              diagnosis = 'Authentication failed - credentials may be invalid or account inactive';
            } else if (errorCode === 'E00027') {
              diagnosis = 'Transaction has been declined (test mode restrictions)';
            }
            
            resolve({
              valid: false,
              status: 'auth_failed',
              message: `Authentication failed: ${errorMessage}`,
              diagnosis: diagnosis,
              details: {
                errorCode: errorCode,
                errorMessage: errorMessage
              }
            });
          }
        } catch (error) {
          console.error('❌ VALIDATION ERROR:', error);
          resolve({
            valid: false,
            status: 'error',
            message: `Validation error: ${error.message}`,
            details: { error: error.message }
          });
        }
      });
    } catch (error) {
      console.error('❌ SETUP ERROR:', error);
      resolve({
        valid: false,
        status: 'setup_error',
        message: `Setup error: ${error.message}`,
        details: { error: error.message }
      });
    }
  });
}

module.exports = { validateMerchantAccount };