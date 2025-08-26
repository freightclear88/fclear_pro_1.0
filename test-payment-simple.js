/**
 * Simple Authorize.Net Payment Test using curl to test the API endpoint
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const TEST_DATA = {
  // Test payment using Accept.js opaque data format (simulated)
  invoiceNumber: 'TEST-' + Date.now(),
  companyName: 'FreightClear Test Company',
  amount: '10.00',
  description: 'Payment Processing Test',
  opaqueData: {
    dataDescriptor: 'COMMON.ACCEPT.INAPP.PAYMENT',
    dataValue: 'test_payment_nonce_' + Date.now()
  },
  billingInfo: {
    firstName: 'Test',
    lastName: 'User',
    zip: '90210'
  }
};

console.log('🔄 Testing Authorize.Net Payment Processing via API endpoint...');
console.log(`Invoice: ${TEST_DATA.invoiceNumber}`);
console.log(`Amount: $${TEST_DATA.amount}`);
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

// Test the payment config endpoint first
async function testPaymentConfig() {
  try {
    console.log('\n📡 Testing payment configuration endpoint...');
    
    const { stdout, stderr } = await execAsync(`curl -s -X GET "http://localhost:5000/api/payment/config" -H "Content-Type: application/json"`);
    
    if (stderr) {
      console.log('❌ Config test failed:', stderr);
      return false;
    }
    
    const config = JSON.parse(stdout);
    console.log('✅ Payment config response:', config);
    
    if (config.success && config.apiLoginId) {
      console.log(`API Login ID: ${config.apiLoginId.substring(0, 4)}****`);
      console.log(`Environment: ${config.environment}`);
      return true;
    } else {
      console.log('❌ Payment system not configured properly');
      return false;
    }
    
  } catch (error) {
    console.log('❌ Config test error:', error.message);
    return false;
  }
}

// Test the actual payment processing
async function testPaymentProcessing() {
  try {
    console.log('\n💳 Testing payment processing endpoint...');
    
    const curlCommand = `curl -s -X POST "http://localhost:5000/api/payment/process" \\
      -H "Content-Type: application/json" \\
      -d '${JSON.stringify(TEST_DATA)}'`;
    
    console.log('Sending payment request...');
    
    const { stdout, stderr } = await execAsync(curlCommand);
    
    if (stderr) {
      console.log('❌ Payment test failed:', stderr);
      return false;
    }
    
    const response = JSON.parse(stdout);
    console.log('📄 Payment response:', JSON.stringify(response, null, 2));
    
    if (response.success) {
      console.log('✅ PAYMENT TEST SUCCESSFUL!');
      console.log(`Transaction ID: ${response.transactionId}`);
      console.log(`Auth Code: ${response.authCode}`);
      return true;
    } else {
      console.log(`❌ Payment failed: ${response.error}`);
      console.log(`Error Code: ${response.errorCode || 'Unknown'}`);
      return false;
    }
    
  } catch (error) {
    console.log('❌ Payment test error:', error.message);
    return false;
  }
}

// Test authentication requirement
async function testAuthenticationRequirement() {
  try {
    console.log('\n🔐 Testing authentication requirement...');
    
    const { stdout } = await execAsync(`curl -s -X GET "http://localhost:5000/api/payment/config"`);
    const response = JSON.parse(stdout);
    
    if (response.message === 'Unauthorized') {
      console.log('✅ Authentication properly required');
      return true;
    } else {
      console.log('⚠️  Authentication may not be properly enforced');
      return false;
    }
    
  } catch (error) {
    console.log('❌ Auth test error:', error.message);
    return false;
  }
}

// Main test runner
async function runAllTests() {
  console.log('🧪 Running Payment System Tests\n');
  
  const tests = [
    { name: 'Authentication Check', test: testAuthenticationRequirement },
    { name: 'Payment Configuration', test: testPaymentConfig },
    { name: 'Payment Processing', test: testPaymentProcessing }
  ];
  
  const results = [];
  
  for (const { name, test } of tests) {
    console.log(`\n🔍 Running: ${name}`);
    const result = await test();
    results.push({ name, success: result });
    console.log('-------------------');
  }
  
  // Summary
  console.log('\n📊 TEST SUMMARY:');
  results.forEach(result => {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${result.name}`);
  });
  
  const successCount = results.filter(r => r.success).length;
  console.log(`\n📈 Overall: ${successCount}/${results.length} tests passed`);
  
  return results;
}

// Run tests
runAllTests()
  .then((results) => {
    console.log('\n🏁 Payment testing completed');
    const allPassed = results.every(r => r.success);
    process.exit(allPassed ? 0 : 1);
  })
  .catch(error => {
    console.error('Payment testing failed:', error);
    process.exit(1);
  });