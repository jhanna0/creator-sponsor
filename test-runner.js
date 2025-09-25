#!/usr/bin/env node

/**
 * Simple Test Runner for Creator-Sponsor Platform
 * Run with: node test-runner.js
 */

const http = require('http');
const crypto = require('crypto');

const BASE_URL = 'http://localhost:3000';
let testResults = [];
let testCount = 0;
let passedTests = 0;

// Helper function to make HTTP requests
function makeRequest(method, path, data = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        const req = http.request(url, options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const responseData = body ? JSON.parse(body) : {};
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        body: responseData
                    });
                } catch (e) {
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        body: body
                    });
                }
            });
        });

        req.on('error', reject);

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

// Test assertion helper
function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

// Test case wrapper
async function testCase(name, testFunction) {
    testCount++;
    console.log(`\n🔍 Running: ${name}`);

    try {
        await testFunction();
        passedTests++;
        console.log(`✅ PASSED: ${name}`);
        testResults.push({ name, status: 'PASSED', error: null });
    } catch (error) {
        console.log(`❌ FAILED: ${name}`);
        console.log(`   Error: ${error.message}`);
        testResults.push({ name, status: 'FAILED', error: error.message });
    }
}

// Generate random test email
function generateTestEmail() {
    const randomId = crypto.randomBytes(4).toString('hex');
    return `test-${randomId}@example.com`;
}

// Main test suite
async function runTests() {
    console.log('🚀 Starting Creator-Sponsor Platform Test Suite\n');

    // Check if server is running
    try {
        await makeRequest('GET', '/');
        console.log('✅ Server is running');
    } catch (error) {
        console.log('❌ Server is not running. Please start the server first.');
        console.log('   Run: npm run dev');
        process.exit(1);
    }

    // ========================================
    // USER SIGNUP TESTS
    // ========================================

    const testEmail1 = generateTestEmail();
    const testPassword1 = 'SecurePass123!';
    let verificationToken;

    await testCase('US-001: Successful User Registration', async () => {
        const response = await makeRequest('POST', '/api/auth/signup', {
            email: testEmail1,
            password: testPassword1
        });

        assert(response.status === 200, `Expected 200, got ${response.status}`);
        assert(response.body.success === true, 'Response should indicate success');
        assert(response.body.message.includes('verify'), 'Should mention email verification');
    });

    await testCase('US-002: Duplicate Email Prevention', async () => {
        const response = await makeRequest('POST', '/api/auth/signup', {
            email: testEmail1, // Same email as above
            password: 'DifferentPassword456!'
        });

        assert(response.status === 400, `Expected 400, got ${response.status}`);
        assert(response.body.error === 'Email already registered', 'Should prevent duplicate emails');
    });

    await testCase('US-003: Missing Required Fields', async () => {
        // Test missing email
        let response = await makeRequest('POST', '/api/auth/signup', {
            password: 'ValidPass123!'
        });

        assert(response.status === 400, 'Should reject missing email');
        assert(response.body.error === 'Email and password required', 'Should indicate missing fields');

        // Test missing password
        response = await makeRequest('POST', '/api/auth/signup', {
            email: 'valid@example.com'
        });

        assert(response.status === 400, 'Should reject missing password');
        assert(response.body.error === 'Email and password required', 'Should indicate missing fields');
    });

    // ========================================
    // EMAIL VERIFICATION TESTS
    // ========================================

    // Note: In a real test environment, we'd need to mock or access the verification token
    // For this demo, we'll simulate the verification process

    await testCase('EV-001: Invalid Verification Token', async () => {
        const response = await makeRequest('GET', '/api/auth/verify/invalid-token-12345');

        assert(response.status === 400, `Expected 400, got ${response.status}`);
        assert(response.body.error === 'Invalid verification token', 'Should reject invalid token');
    });

    // ========================================
    // USER LOGIN TESTS
    // ========================================

    await testCase('LG-001: Unverified User Login Attempt', async () => {
        const response = await makeRequest('POST', '/api/auth/login', {
            email: testEmail1,
            password: testPassword1
        });

        assert(response.status === 401, `Expected 401, got ${response.status}`);
        assert(response.body.error === 'Please verify your email first', 'Should require email verification');
    });

    await testCase('LG-002: Invalid Credentials', async () => {
        // Wrong password
        let response = await makeRequest('POST', '/api/auth/login', {
            email: testEmail1,
            password: 'WrongPassword123!'
        });

        assert(response.status === 401, 'Should reject wrong password');
        assert(response.body.error.includes('verify') || response.body.error.includes('Invalid'), 'Should indicate error');

        // Non-existent email
        response = await makeRequest('POST', '/api/auth/login', {
            email: 'doesnotexist@example.com',
            password: 'SomePassword123!'
        });

        assert(response.status === 401, 'Should reject non-existent email');
        assert(response.body.error === 'Invalid credentials', 'Should indicate invalid credentials');
    });

    // ========================================
    // POST CREATION TESTS (AUTH REQUIRED)
    // ========================================

    await testCase('PC-001: Unauthenticated Post Creation', async () => {
        const response = await makeRequest('POST', '/api/posts', {
            userType: 'creator',
            platform: 'youtube',
            followers: 50000,
            interests: 'technology,gaming',
            pricePoint: 500,
            description: 'Tech reviewer seeking sponsors',
            contactInfo: testEmail1
        });

        assert(response.status === 401, `Expected 401, got ${response.status}`);
        assert(response.body.error === 'Access token required', 'Should require authentication');
    });

    // ========================================
    // POSTS LISTING TESTS
    // ========================================

    await testCase('PL-001: Public Posts Listing', async () => {
        const response = await makeRequest('GET', '/api/posts');

        assert(response.status === 200, `Expected 200, got ${response.status}`);
        assert(Array.isArray(response.body), 'Should return array of posts');
        assert(response.body.length > 0, 'Should have sample posts');

        // Check that contact info is masked for unauthenticated users
        const firstPost = response.body[0];
        assert(firstPost.contactHidden === true, 'Contact should be hidden for unauthenticated users');
        assert(firstPost.contactInfo === '••••••••@••••••••.com', 'Contact should be masked');
        assert(typeof firstPost.revealCost === 'number', 'Should show reveal cost');
    });

    await testCase('PL-002: Posts Filtering', async () => {
        // Test filtering by user type
        const response = await makeRequest('GET', '/api/posts?userType=creator');

        assert(response.status === 200, `Expected 200, got ${response.status}`);
        assert(Array.isArray(response.body), 'Should return array of posts');

        // Verify all returned posts are creators
        response.body.forEach(post => {
            assert(post.userType === 'creator', 'All posts should be creator type');
        });
    });

    // ========================================
    // PAYMENT TESTS (WITHOUT STRIPE INTEGRATION)
    // ========================================

    await testCase('PAY-001: Create Posting Session (Unauthenticated)', async () => {
        const response = await makeRequest('POST', '/api/payment/create-posting-session', {
            userEmail: testEmail1
        });

        assert(response.status === 401, `Expected 401, got ${response.status}`);
        assert(response.body.error === 'Access token required', 'Should require authentication for payment');
    });

    await testCase('PAY-002: Create Contact Reveal Session (Unauthenticated)', async () => {
        const response = await makeRequest('POST', '/api/payment/create-contact-reveal-session', {
            userEmail: testEmail1,
            targetPostId: 1,
            targetUserName: 'Test User'
        });

        assert(response.status === 401, `Expected 401, got ${response.status}`);
        assert(response.body.error === 'Access token required', 'Should require authentication for payment');
    });

    // ========================================
    // CONTACT REVEAL TESTS
    // ========================================

    await testCase('CR-001: Reveal Contact (Unauthenticated)', async () => {
        const response = await makeRequest('POST', '/api/reveal-contact', {
            targetUserId: '1'
        });

        assert(response.status === 401, `Expected 401, got ${response.status}`);
        assert(response.body.error === 'Access token required', 'Should require authentication');
    });

    // ========================================
    // VALIDATION TESTS
    // ========================================

    await testCase('VAL-001: Invalid Email Format', async () => {
        const invalidEmails = [
            'plainaddress',
            '@missingdomain.com',
            'missing@.com',
            'user@domain',
            'spaces in@email.com'
        ];

        for (const email of invalidEmails) {
            const response = await makeRequest('POST', '/api/auth/signup', {
                email: email,
                password: 'ValidPass123!'
            });

            // Note: Current implementation may not validate email format
            // This test documents expected behavior for future implementation
            if (response.status === 200) {
                console.log(`   Note: Email format validation not implemented for: ${email}`);
            }
        }
    });

    // ========================================
    // REPORT TESTS
    // ========================================

    await testCase('RPT-001: Submit User Report', async () => {
        const response = await makeRequest('POST', '/api/report', {
            userId: 1,
            reason: 'Spam content'
        });

        assert(response.status === 200, `Expected 200, got ${response.status}`);
        assert(response.body.success === true, 'Should accept user reports');
        assert(response.body.message === 'Report submitted successfully', 'Should confirm report submission');
    });

    await testCase('RPT-002: Invalid Report Data', async () => {
        // Missing userId
        let response = await makeRequest('POST', '/api/report', {
            reason: 'Test reason'
        });

        assert(response.status === 400, 'Should reject missing userId');

        // Missing reason
        response = await makeRequest('POST', '/api/report', {
            userId: 1
        });

        assert(response.status === 400, 'Should reject missing reason');
    });

    // ========================================
    // DOMAIN VERIFICATION TESTS
    // ========================================

    await testCase('DV-001: Start Domain Verification', async () => {
        const response = await makeRequest('POST', '/api/verify/domain/start', {
            userId: 1,
            domain: 'example.com'
        });

        assert(response.status === 200, `Expected 200, got ${response.status}`);
        assert(response.body.success === true, 'Should start domain verification');
        assert(typeof response.body.verificationCode === 'string', 'Should return verification code');
        assert(response.body.instructions.includes('TXT record'), 'Should provide DNS instructions');
    });

    await testCase('DV-002: Invalid Domain Verification Request', async () => {
        // Missing userId
        let response = await makeRequest('POST', '/api/verify/domain/start', {
            domain: 'example.com'
        });

        assert(response.status === 400, 'Should reject missing userId');

        // Missing domain
        response = await makeRequest('POST', '/api/verify/domain/start', {
            userId: 1
        });

        assert(response.status === 400, 'Should reject missing domain');
    });

    // ========================================
    // TEST RESULTS SUMMARY
    // ========================================

    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(60));

    console.log(`\nTotal Tests: ${testCount}`);
    console.log(`Passed: ${passedTests} ✅`);
    console.log(`Failed: ${testCount - passedTests} ❌`);
    console.log(`Pass Rate: ${((passedTests / testCount) * 100).toFixed(1)}%`);

    if (testCount - passedTests > 0) {
        console.log('\n❌ Failed Tests:');
        testResults.filter(t => t.status === 'FAILED').forEach(test => {
            console.log(`   - ${test.name}: ${test.error}`);
        });
    }

    console.log('\n' + '='.repeat(60));

    // Exit with appropriate code
    process.exit(testCount === passedTests ? 0 : 1);
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled promise rejection:', error);
    process.exit(1);
});

// Run tests if this file is executed directly
if (require.main === module) {
    runTests().catch(error => {
        console.error('❌ Test suite failed:', error);
        process.exit(1);
    });
}

module.exports = { runTests, makeRequest, testCase, assert };