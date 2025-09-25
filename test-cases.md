# Comprehensive Test Cases - Creator-Sponsor Platform

## Test Environment Setup

### Prerequisites
- Server running on `http://localhost:3000`
- Valid Stripe test keys configured
- Email transporter configured (Ethereal for testing)
- Database/in-memory storage reset before each test suite

### Test Data
```javascript
const testUsers = {
    validUser1: {
        email: 'test1@example.com',
        password: 'SecurePass123!'
    },
    validUser2: {
        email: 'test2@example.com',
        password: 'AnotherPass456!'
    },
    invalidEmails: [
        'invalid.email',
        '@domain.com',
        'user@',
        'user..double@domain.com'
    ]
};

const testPosts = {
    creatorPost: {
        userType: 'creator',
        platform: 'youtube',
        followers: 50000,
        interests: 'technology,gaming',
        pricePoint: 500,
        description: 'Tech reviewer looking for sponsors'
    },
    sponsorPost: {
        userType: 'sponsor',
        platform: 'instagram',
        followers: 25000,
        interests: 'fitness,lifestyle',
        pricePoint: 400,
        description: 'Fitness brand seeking creators'
    }
};
```

---

## 1. User Signup Test Cases

### 1.1 Valid Signup Flow

#### Test Case: US-001 - Successful User Registration
**Objective**: Verify new user can register with valid credentials

**Pre-conditions**:
- Email address not previously registered
- Server is running and email service is configured

**Test Steps**:
1. Send POST request to `/api/auth/signup`
   ```json
   {
     "email": "newuser@example.com",
     "password": "SecurePass123!"
   }
   ```

**Expected Results**:
- HTTP Status: `200 OK`
- Response body:
  ```json
  {
    "success": true,
    "message": "Registration successful! Please check your email to verify your account."
  }
  ```
- Verification email sent to specified address
- User stored in database with `verified: false`
- Verification token created and stored

**Validation Points**:
- User exists in `registeredUsers` array
- Password is properly hashed (bcrypt)
- Verification token exists in `verificationTokens` Map
- Email contains valid verification link

---

#### Test Case: US-002 - Duplicate Email Registration Prevention
**Objective**: Verify system prevents registration with existing email

**Pre-conditions**:
- User with email `existing@example.com` already registered

**Test Steps**:
1. Attempt to register with existing email:
   ```json
   {
     "email": "existing@example.com",
     "password": "DifferentPass456!"
   }
   ```

**Expected Results**:
- HTTP Status: `400 Bad Request`
- Response body:
  ```json
  {
    "error": "Email already registered"
  }
  ```
- No new user created
- No verification email sent
- Original user data unchanged

**Edge Cases to Test**:
- Same email with different capitalization (`EXISTING@example.com`)
- Same email with extra whitespace (` existing@example.com `)

---

### 1.2 Invalid Signup Scenarios

#### Test Case: US-003 - Missing Required Fields
**Objective**: Verify proper validation for missing email/password

**Test Scenarios**:
1. **Missing Email**:
   ```json
   { "password": "ValidPass123!" }
   ```

2. **Missing Password**:
   ```json
   { "email": "user@example.com" }
   ```

3. **Missing Both Fields**:
   ```json
   {}
   ```

**Expected Results for All**:
- HTTP Status: `400 Bad Request`
- Response: `{ "error": "Email and password required" }`

---

#### Test Case: US-004 - Invalid Email Formats
**Objective**: Verify email format validation

**Test Data**:
```javascript
const invalidEmails = [
    'plainaddress',
    '@missingdomain.com',
    'missing@.com',
    'missing@domain',
    'spaces in@email.com',
    'user..double@domain.com',
    'user@domain..com'
];
```

**Test Steps**:
- For each invalid email, send signup request
- Verify all return validation error

**Expected Results**:
- HTTP Status: `400 Bad Request`
- Appropriate email validation error message
- No user created or email sent

---

#### Test Case: US-005 - Weak Password Scenarios
**Objective**: Test password strength requirements

**Test Data**:
```javascript
const weakPasswords = [
    '123',          // Too short
    'password',     // Common word
    '12345678',     // Numbers only
    'abcdefgh',     // Letters only
    'PASSWORD',     // All caps
    ''              // Empty
];
```

**Expected Results**:
- Should implement password strength validation
- Minimum 8 characters recommended
- Mix of letters, numbers, symbols preferred

---

## 2. Email Verification Test Cases

### 2.1 Valid Verification Flow

#### Test Case: EV-001 - Successful Email Verification
**Objective**: Verify user can successfully verify their email

**Pre-conditions**:
- User registered but not verified
- Valid verification token exists

**Test Steps**:
1. Get verification token from signup response or database
2. Send GET request to `/api/auth/verify/{token}`

**Expected Results**:
- HTTP Status: `200 OK`
- Response:
  ```json
  {
    "success": true,
    "message": "Email verified successfully!"
  }
  ```
- User's `verified` status updated to `true`
- Verification token removed from storage

**Validation Points**:
- User can now login successfully
- User can access protected endpoints
- Token is cleaned up (single-use)

---

#### Test Case: EV-002 - Verification Link from Email
**Objective**: Test end-to-end email verification flow

**Test Steps**:
1. Register new user
2. Check email inbox (Ethereal for testing)
3. Extract verification URL from email
4. Visit verification URL
5. Attempt login with verified account

**Expected Results**:
- Verification link works correctly
- User becomes verified
- Can login immediately after verification

---

### 2.2 Invalid Verification Scenarios

#### Test Case: EV-003 - Invalid Verification Token
**Objective**: Verify proper handling of invalid tokens

**Test Scenarios**:
1. **Non-existent Token**:
   - GET `/api/auth/verify/invalid-token-12345`

2. **Malformed Token**:
   - GET `/api/auth/verify/not-a-uuid`

3. **Empty Token**:
   - GET `/api/auth/verify/`

**Expected Results**:
- HTTP Status: `400 Bad Request`
- Response: `{ "error": "Invalid verification token" }`
- No user verification status changed

---

#### Test Case: EV-004 - Already Verified User
**Objective**: Test verification of already verified user

**Pre-conditions**:
- User exists and is already verified
- Old verification token might still exist

**Test Steps**:
1. Verify user with valid token
2. Attempt to verify same user again with same token

**Expected Results**:
- Second verification attempt should fail gracefully
- Token should be consumed after first use
- User remains verified

---

#### Test Case: EV-005 - Expired Verification Token
**Objective**: Test token expiration handling

**Pre-conditions**:
- Verification token older than 24 hours (if expiration implemented)

**Test Steps**:
1. Create user with verification token
2. Simulate token expiration (modify timestamp)
3. Attempt verification

**Expected Results**:
- HTTP Status: `400 Bad Request`
- Error message about expired token
- User remains unverified

---

## 3. User Login Test Cases

### 3.1 Valid Login Scenarios

#### Test Case: LG-001 - Successful Login (Verified User)
**Objective**: Verify verified user can login successfully

**Pre-conditions**:
- User registered and email verified
- Valid credentials

**Test Steps**:
1. POST `/api/auth/login`
   ```json
   {
     "email": "verified@example.com",
     "password": "ValidPass123!"
   }
   ```

**Expected Results**:
- HTTP Status: `200 OK`
- Response:
  ```json
  {
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid-string",
      "email": "verified@example.com",
      "verified": true
    }
  }
  ```
- JWT token is valid and not expired
- Token contains correct user information

---

### 3.2 Invalid Login Scenarios

#### Test Case: LG-002 - Unverified User Login Attempt
**Objective**: Prevent unverified users from logging in

**Pre-conditions**:
- User registered but email not verified

**Test Steps**:
1. Attempt login with unverified account credentials

**Expected Results**:
- HTTP Status: `401 Unauthorized`
- Response: `{ "error": "Please verify your email first" }`
- No JWT token provided

---

#### Test Case: LG-003 - Invalid Credentials
**Objective**: Test various invalid login scenarios

**Test Scenarios**:
1. **Wrong Password**:
   ```json
   {
     "email": "valid@example.com",
     "password": "WrongPassword123!"
   }
   ```

2. **Non-existent Email**:
   ```json
   {
     "email": "doesnotexist@example.com",
     "password": "SomePassword123!"
   }
   ```

3. **Missing Credentials**:
   ```json
   { "email": "user@example.com" }  // Missing password
   ```

**Expected Results for All**:
- HTTP Status: `401 Unauthorized`
- Response: `{ "error": "Invalid credentials" }`
- No sensitive information leaked in error messages

---

## 4. Post Creation Test Cases

### 4.1 Valid Post Creation Flow

#### Test Case: PC-001 - Successful Creator Post Creation
**Objective**: Verify authenticated, paid user can create post

**Pre-conditions**:
- User registered, verified, and logged in
- User has paid posting fee ($5)
- Valid JWT token

**Test Steps**:
1. POST `/api/posts` with Authorization header
   ```json
   {
     "userType": "creator",
     "platform": "youtube",
     "followers": 75000,
     "interests": "technology,gaming,reviews",
     "pricePoint": 800,
     "description": "Tech reviewer with engaged audience seeking tech sponsors",
     "contactInfo": "creator@example.com"
   }
   ```

**Expected Results**:
- HTTP Status: `200 OK`
- Response:
  ```json
  {
    "success": true,
    "post": {
      "id": 123,
      "userType": "creator",
      "platform": "youtube",
      "followers": 75000,
      "interests": ["technology", "gaming", "reviews"],
      "pricePoint": 800,
      "description": "Tech reviewer with engaged audience seeking tech sponsors",
      "contactInfo": "creator@example.com",
      "userId": "user-uuid",
      "verified": true,
      "createdAt": "2024-01-01T12:00:00.000Z"
    }
  }
  ```
- Post visible in GET `/api/posts` endpoint
- Contact info matches verified registration email

---

#### Test Case: PC-002 - Successful Sponsor Post Creation
**Objective**: Verify sponsor can create post with different data structure

**Test Steps**:
1. Create sponsor post with sponsor-specific data:
   ```json
   {
     "userType": "sponsor",
     "platform": "instagram",
     "followers": 15000,
     "interests": "fitness,wellness,lifestyle",
     "pricePoint": 500,
     "description": "Fitness brand seeking health & wellness creators",
     "contactInfo": "sponsor@example.com"
   }
   ```

**Expected Results**:
- Post created successfully
- `userType` correctly set to "sponsor"
- All sponsor-specific fields properly stored

---

### 4.2 Authentication & Authorization Tests

#### Test Case: PC-003 - Unauthenticated Post Creation Attempt
**Objective**: Verify unauthenticated users cannot create posts

**Test Steps**:
1. POST `/api/posts` without Authorization header
2. POST `/api/posts` with invalid JWT token
3. POST `/api/posts` with expired JWT token

**Expected Results for All**:
- HTTP Status: `401 Unauthorized` or `403 Forbidden`
- Response: `{ "error": "Access token required" }` or `{ "error": "Invalid token" }`
- No post created

---

#### Test Case: PC-004 - Unpaid User Post Creation Attempt
**Objective**: Verify users must pay posting fee before creating posts

**Pre-conditions**:
- User registered, verified, and logged in
- User has NOT paid posting fee

**Test Steps**:
1. Attempt to create post with valid data and auth token

**Expected Results**:
- HTTP Status: `402 Payment Required`
- Response:
  ```json
  {
    "error": "Payment required to create a post. Please pay the $5 posting fee first.",
    "requiresPayment": true,
    "paymentType": "posting_fee"
  }
  ```
- No post created

---

### 4.3 Data Validation Tests

#### Test Case: PC-005 - Contact Email Must Match Registration
**Objective**: Enforce contact email matches verified registration email

**Test Steps**:
1. User registered with `user@example.com`
2. Attempt to create post with different contact email:
   ```json
   {
     "userType": "creator",
     "platform": "youtube",
     "followers": 50000,
     "interests": "gaming",
     "pricePoint": 600,
     "description": "Gamer seeking sponsors",
     "contactInfo": "different@example.com"  // Different from registration
   }
   ```

**Expected Results**:
- HTTP Status: `400 Bad Request`
- Response:
  ```json
  {
    "error": "Contact email must match your verified registration email"
  }
  ```
- No post created

---

#### Test Case: PC-006 - One Post Per User Limitation
**Objective**: Verify users can only have one active post

**Pre-conditions**:
- User has already created one post

**Test Steps**:
1. Attempt to create second post for same user

**Expected Results**:
- HTTP Status: `400 Bad Request`
- Response:
  ```json
  {
    "error": "You already have an active post. Please delete it first to create a new one."
  }
  ```
- Original post remains unchanged

---

#### Test Case: PC-007 - Required Field Validation
**Objective**: Test validation for all required post fields

**Test Scenarios** (test each missing field individually):
```json
// Missing userType
{ "platform": "youtube", "followers": 1000, "interests": "tech", "pricePoint": 100, "description": "test", "contactInfo": "test@example.com" }

// Missing platform
{ "userType": "creator", "followers": 1000, "interests": "tech", "pricePoint": 100, "description": "test", "contactInfo": "test@example.com" }

// Missing followers
{ "userType": "creator", "platform": "youtube", "interests": "tech", "pricePoint": 100, "description": "test", "contactInfo": "test@example.com" }

// Missing interests
{ "userType": "creator", "platform": "youtube", "followers": 1000, "pricePoint": 100, "description": "test", "contactInfo": "test@example.com" }

// Missing pricePoint
{ "userType": "creator", "platform": "youtube", "followers": 1000, "interests": "tech", "description": "test", "contactInfo": "test@example.com" }

// Missing description
{ "userType": "creator", "platform": "youtube", "followers": 1000, "interests": "tech", "pricePoint": 100, "contactInfo": "test@example.com" }

// Missing contactInfo
{ "userType": "creator", "platform": "youtube", "followers": 1000, "interests": "tech", "pricePoint": 100, "description": "test" }
```

**Expected Results for All**:
- HTTP Status: `400 Bad Request`
- Appropriate field validation error
- No post created

---

#### Test Case: PC-008 - Data Type Validation
**Objective**: Verify proper data type validation

**Test Scenarios**:
```json
// Invalid userType
{ "userType": "invalid", ... }

// Invalid followers (string instead of number)
{ "followers": "not-a-number", ... }

// Invalid pricePoint (string instead of number)
{ "pricePoint": "not-a-number", ... }

// Invalid platform (if enum validation exists)
{ "platform": "invalid-platform", ... }
```

**Expected Results**:
- HTTP Status: `400 Bad Request`
- Type validation error messages
- No post created

---

### 4.4 Post Management Tests

#### Test Case: PC-009 - Delete Own Post
**Objective**: Verify user can delete their own post

**Pre-conditions**:
- User has created a post

**Test Steps**:
1. DELETE `/api/posts/my-post` with valid auth token

**Expected Results**:
- HTTP Status: `200 OK`
- Response:
  ```json
  {
    "success": true,
    "message": "Post deleted successfully"
  }
  ```
- Post no longer appears in GET `/api/posts`
- User can now create a new post

---

#### Test Case: PC-010 - Delete Non-existent Post
**Objective**: Handle deletion when user has no post

**Pre-conditions**:
- User has no active post

**Test Steps**:
1. DELETE `/api/posts/my-post`

**Expected Results**:
- HTTP Status: `404 Not Found`
- Response: `{ "error": "No post found" }`

---

## 5. Contact Reveal Test Cases

### 5.1 Payment Flow Tests

#### Test Case: CR-001 - Create Contact Reveal Checkout Session
**Objective**: Verify Stripe checkout session creation for contact reveal

**Pre-conditions**:
- User registered, verified, and logged in
- Target post exists with ID `123`

**Test Steps**:
1. POST `/api/payment/create-contact-reveal-session`
   ```json
   {
     "userEmail": "user@example.com",
     "targetPostId": 123,
     "targetUserName": "Tech Reviewer"
   }
   ```

**Expected Results**:
- HTTP Status: `200 OK`
- Response:
  ```json
  {
    "success": true,
    "sessionId": "cs_test_...",
    "sessionUrl": "https://checkout.stripe.com/c/pay/cs_test_...",
    "amount": 1.00
  }
  ```
- Payment session stored with correct metadata
- Stripe customer created/retrieved for saved payment methods

---

#### Test Case: CR-002 - Successful Contact Reveal Payment
**Objective**: Test complete payment flow for contact reveal

**Test Steps**:
1. Create checkout session
2. Simulate successful Stripe payment (webhook or success callback)
3. GET `/api/payment/success?session_id=cs_test_...&type=contact&target=123`

**Expected Results**:
- HTTP Status: `200 OK`
- Response:
  ```json
  {
    "success": true,
    "message": "Contact information unlocked! You can now view the contact details.",
    "payment_type": "contact_reveal",
    "target_post_id": 123
  }
  ```
- Contact reveal recorded in storage
- User can now access contact information

---

### 5.2 Contact Access Tests

#### Test Case: CR-003 - Access Paid Contact Information
**Objective**: Verify user can access contact info after payment

**Pre-conditions**:
- User has successfully paid for contact reveal of post ID `123`

**Test Steps**:
1. POST `/api/reveal-contact`
   ```json
   {
     "targetUserId": "123"
   }
   ```

**Expected Results**:
- HTTP Status: `200 OK`
- Response:
  ```json
  {
    "success": true,
    "message": "Contact information revealed",
    "contactInfo": "creator@example.com",
    "alreadyRevealed": true
  }
  ```
- Real contact information returned (not masked)

---

#### Test Case: CR-004 - Access Unpaid Contact Information
**Objective**: Verify payment required for unpaid contacts

**Pre-conditions**:
- User has NOT paid for contact reveal of post ID `456`

**Test Steps**:
1. POST `/api/reveal-contact`
   ```json
   {
     "targetUserId": "456"
   }
   ```

**Expected Results**:
- HTTP Status: `402 Payment Required`
- Response:
  ```json
  {
    "error": "Payment required to reveal contact information.",
    "requiresPayment": true,
    "message": "Please use the payment button to reveal this contact for $1.00"
  }
  ```
- Contact information not revealed

---

### 5.3 Post Listing with Contact Visibility

#### Test Case: CR-005 - Posts List Contact Visibility (Own Posts)
**Objective**: Verify users can see their own contact info

**Pre-conditions**:
- User `user1@example.com` has created a post
- Same user requests post list

**Test Steps**:
1. GET `/api/posts` with Authentication header

**Expected Results**:
- User's own post shows real `contactInfo`
- Other posts show masked `contactInfo: '••••••••@••••••••.com'`
- Own post has `contactHidden: undefined` (not hidden)

---

#### Test Case: CR-006 - Posts List Contact Visibility (Paid Reveals)
**Objective**: Verify paid contact reveals show real contact info

**Pre-conditions**:
- User has paid to reveal contact for post ID `789`
- User requests post list

**Test Steps**:
1. GET `/api/posts` with Authentication header

**Expected Results**:
- Post ID `789` shows real contact information
- Post has `contactHidden: undefined` (revealed)
- Other unpaid posts remain masked

---

#### Test Case: CR-007 - Posts List Contact Visibility (Unpaid)
**Objective**: Verify unpaid contacts remain hidden with payment info

**Pre-conditions**:
- User has NOT paid for any contact reveals
- User requests post list

**Test Steps**:
1. GET `/api/posts` with Authentication header

**Expected Results**:
- All non-own posts show masked contact: `'••••••••@••••••••.com'`
- All have `contactHidden: true`
- All have `revealCost: 1.00`

---

#### Test Case: CR-008 - Unauthenticated Posts List
**Objective**: Verify anonymous users see all contacts masked

**Test Steps**:
1. GET `/api/posts` without Authentication header

**Expected Results**:
- All posts show masked contact information
- All have `contactHidden: true`
- All have `revealCost: 1.00`
- No user-specific reveal information

---

### 5.4 Edge Cases & Error Handling

#### Test Case: CR-009 - Invalid Target Post ID
**Objective**: Handle contact reveal for non-existent post

**Test Steps**:
1. POST `/api/reveal-contact`
   ```json
   {
     "targetUserId": "99999"  // Non-existent post ID
   }
   ```

**Expected Results**:
- HTTP Status: `404 Not Found`
- Response: `{ "error": "Post not found" }`

---

#### Test Case: CR-010 - Missing Target User ID
**Objective**: Validate required fields in contact reveal

**Test Steps**:
1. POST `/api/reveal-contact`
   ```json
   {}  // Missing targetUserId
   ```

**Expected Results**:
- HTTP Status: `400 Bad Request`
- Response: `{ "error": "Target user ID is required" }`

---

#### Test Case: CR-011 - Reveal Own Contact
**Objective**: Test revealing user's own contact (should be free)

**Pre-conditions**:
- User has created post with ID `123`
- Same user attempts to reveal their own contact

**Test Steps**:
1. POST `/api/reveal-contact`
   ```json
   {
     "targetUserId": "123"  // User's own post ID
   }
   ```

**Expected Results**:
- HTTP Status: `200 OK`
- Contact information returned immediately
- No payment required (own post)

---

## 6. Integration Test Scenarios

### 6.1 Complete User Journey Tests

#### Test Case: INT-001 - Creator Complete Flow
**Objective**: Test entire creator journey from signup to contact reveal

**Test Flow**:
1. **Signup**: Register new creator account
2. **Verification**: Verify email address
3. **Login**: Login with verified account
4. **Payment**: Pay $5 posting fee via Stripe
5. **Post Creation**: Create creator post
6. **Post Visibility**: Verify post appears in listings
7. **Contact Reveal**: Another user pays to reveal creator's contact
8. **Access Verification**: Verify contact is accessible to paying user

**Success Criteria**:
- All steps complete without errors
- Creator post is visible to other users
- Payment methods are saved for future use
- Contact reveal works correctly

---

#### Test Case: INT-002 - Sponsor Complete Flow
**Objective**: Test entire sponsor journey

**Test Flow**:
1. Register sponsor account → verify → login
2. Pay posting fee (payment method saved)
3. Create sponsor post
4. View creator posts (contacts masked)
5. Pay to reveal creator contact (uses saved payment method)
6. Access revealed contact information
7. Contact creator successfully

**Success Criteria**:
- Sponsor can find suitable creators
- Payment flow is smooth with saved methods
- Contact information is accurate and accessible

---

### 6.2 Multi-User Interaction Tests

#### Test Case: INT-003 - Multiple Users, Multiple Reveals
**Objective**: Test system with multiple users and contact reveals

**Setup**:
- Create 3 users: `creator1`, `sponsor1`, `sponsor2`
- `creator1` creates post
- Both sponsors want to reveal creator's contact

**Test Flow**:
1. `sponsor1` pays to reveal `creator1` contact
2. `sponsor2` pays to reveal same `creator1` contact
3. Both sponsors access contact information
4. Verify no interference between payments

**Success Criteria**:
- Both sponsors can independently access contact
- Payments are tracked separately
- No data corruption or conflicts

---

#### Test Case: INT-004 - Payment Failure Recovery
**Objective**: Test system behavior when payments fail

**Test Scenarios**:
1. **Card Declined**: Simulate declined card
2. **Network Failure**: Interrupt payment process
3. **Session Timeout**: Expired checkout session

**Test Flow**:
1. Initiate contact reveal payment
2. Simulate payment failure
3. Verify contact remains hidden
4. Retry with successful payment
5. Verify contact becomes accessible

**Success Criteria**:
- Failed payments don't grant access
- System state remains consistent
- Users can retry payments successfully
- No orphaned payment records

---

### 6.3 Performance & Load Tests

#### Test Case: INT-005 - Concurrent User Registration
**Objective**: Test system under concurrent user load

**Test Setup**:
- Attempt to register 50 users simultaneously
- Mix of valid and invalid data
- Monitor for race conditions

**Success Criteria**:
- All valid registrations succeed
- No duplicate user creation
- All verification emails sent
- System remains stable

---

#### Test Case: INT-006 - Concurrent Contact Reveals
**Objective**: Test payment system under load

**Test Setup**:
- Multiple users simultaneously reveal same contact
- Monitor for payment processing conflicts

**Success Criteria**:
- All payments processed correctly
- No double-charging
- All users get access after payment
- Stripe customer creation handles concurrency

---

## 7. Test Automation Scripts

### 7.1 Setup Script
```bash
#!/bin/bash
# test-setup.sh

echo "Setting up test environment..."

# Start server in test mode
NODE_ENV=test npm run dev &
SERVER_PID=$!

# Wait for server to start
sleep 3

# Reset test database/storage
curl -X POST http://localhost:3000/api/test/reset

echo "Test environment ready. Server PID: $SERVER_PID"
```

### 7.2 Cleanup Script
```bash
#!/bin/bash
# test-cleanup.sh

echo "Cleaning up test environment..."

# Stop server
kill $SERVER_PID

# Clean test data
rm -f test-data.json

echo "Cleanup complete."
```

### 7.3 Test Runner Example (Jest/Mocha)
```javascript
// test/integration/user-flow.test.js
const request = require('supertest');
const app = require('../../server');

describe('User Registration Flow', () => {
  let verificationToken;
  let userToken;

  test('Should register new user successfully', async () => {
    const response = await request(app)
      .post('/api/auth/signup')
      .send({
        email: 'test@example.com',
        password: 'SecurePass123!'
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toContain('verification');
  });

  test('Should prevent duplicate email registration', async () => {
    const response = await request(app)
      .post('/api/auth/signup')
      .send({
        email: 'test@example.com', // Same email as above
        password: 'DifferentPass456!'
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Email already registered');
  });

  // Additional tests...
});
```

---

## 8. Test Data Management

### 8.1 Test Data Reset Endpoint
```javascript
// Add to server.js for testing
if (process.env.NODE_ENV === 'test') {
  app.post('/api/test/reset', (req, res) => {
    registeredUsers = [];
    posts = [...sampleData];
    verificationTokens.clear();
    paidUsers.clear();
    contactReveals.clear();
    paymentSessions.clear();

    res.json({ success: true, message: 'Test data reset' });
  });
}
```

### 8.2 Test Utilities
```javascript
// test/utils/test-helpers.js
const request = require('supertest');

async function createAndVerifyUser(app, email, password) {
  // Register user
  await request(app)
    .post('/api/auth/signup')
    .send({ email, password });

  // Get verification token (test environment)
  const token = getVerificationToken(email);

  // Verify email
  await request(app)
    .get(`/api/auth/verify/${token}`);

  // Login and get JWT
  const loginResponse = await request(app)
    .post('/api/auth/login')
    .send({ email, password });

  return loginResponse.body.token;
}

async function simulateStripePayment(sessionId) {
  // Simulate successful Stripe payment
  await request(app)
    .get(`/api/payment/success?session_id=${sessionId}&type=posting`);
}

module.exports = {
  createAndVerifyUser,
  simulateStripePayment
};
```

This comprehensive test suite covers all major user flows and edge cases for the Creator-Sponsor Platform, ensuring reliability and proper functionality before E2E deployment.