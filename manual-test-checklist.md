# Manual Testing Checklist

## Pre-Test Setup ✅

- [ ] Server is running (`npm run dev`)
- [ ] Environment variables are set (`.env` file)
- [ ] Stripe test keys are configured
- [ ] Email service is configured (Ethereal for testing)

## 1. User Registration & Email Verification

### 1.1 New User Signup ✅
- [ ] Open browser to `http://localhost:3000`
- [ ] Click "Sign Up" or navigate to signup form
- [ ] Enter valid email: `test1@example.com`
- [ ] Enter valid password: `SecurePass123!`
- [ ] Click "Register"
- [ ] **Expected**: Success message about checking email
- [ ] **Expected**: User cannot login yet (unverified)

### 1.2 Duplicate Email Prevention ✅
- [ ] Try to register again with same email `test1@example.com`
- [ ] Use different password: `DifferentPass456!`
- [ ] **Expected**: Error "Email already registered"

### 1.3 Email Verification ✅
- [ ] Check server console for Ethereal email URL
- [ ] Click the Ethereal preview URL
- [ ] Find verification email in inbox
- [ ] Click verification link in email
- [ ] **Expected**: "Email verified successfully!" message
- [ ] **Expected**: User can now login

### 1.4 User Login ✅
- [ ] Go to login form
- [ ] Enter email: `test1@example.com`
- [ ] Enter password: `SecurePass123!`
- [ ] **Expected**: Successful login with JWT token
- [ ] **Expected**: Access to protected features

---

## 2. Payment Flow Testing

### 2.1 Posting Fee Payment ✅
- [ ] Login as verified user
- [ ] Try to create a post without paying
- [ ] **Expected**: Payment required error
- [ ] Click "Pay $5 Posting Fee" button
- [ ] **Expected**: Stripe Checkout opens
- [ ] Use test card: `4242 4242 4242 4242`
- [ ] Enter any future date, any CVC, any ZIP
- [ ] Complete payment
- [ ] **Expected**: Redirected to success page
- [ ] **Expected**: Can now create posts

### 2.2 Stripe Customer Creation ✅
- [ ] After first payment, check Stripe Dashboard
- [ ] **Expected**: New customer created with user's email
- [ ] **Expected**: Payment method saved to customer

---

## 3. Post Creation & Management

### 3.1 Creator Post Creation ✅
- [ ] After paying posting fee, create post:
  - User Type: Creator
  - Platform: YouTube
  - Followers: 50000
  - Interests: technology,gaming,reviews
  - Price Point: 800
  - Description: "Tech reviewer seeking sponsors"
  - Contact Info: (automatically filled with registration email)
- [ ] **Expected**: Post created successfully
- [ ] **Expected**: Post appears in public listings

### 3.2 Sponsor Post Creation ✅
- [ ] Create second user account (`test2@example.com`)
- [ ] Verify email and pay posting fee
- [ ] Create sponsor post:
  - User Type: Sponsor
  - Platform: Instagram
  - Followers: 25000
  - Interests: fitness,lifestyle
  - Price Point: 500
  - Description: "Fitness brand seeking creators"
- [ ] **Expected**: Sponsor post created successfully

### 3.3 One Post Per User Limit ✅
- [ ] Try to create second post with same user
- [ ] **Expected**: Error "You already have an active post"

### 3.4 Post Deletion ✅
- [ ] Delete own post using delete button
- [ ] **Expected**: Post removed from listings
- [ ] **Expected**: Can create new post after deletion

---

## 4. Contact Reveal Flow

### 4.1 Contact Visibility (Unauthenticated) ✅
- [ ] Logout or open incognito browser
- [ ] View posts listing at `/api/posts` or main page
- [ ] **Expected**: All contact info shows `••••••••@••••••••.com`
- [ ] **Expected**: "Reveal Contact $1.00" buttons visible

### 4.2 Contact Visibility (Authenticated, Unpaid) ✅
- [ ] Login as verified user
- [ ] View posts listing
- [ ] **Expected**: Own posts show real contact info
- [ ] **Expected**: Other posts show masked contact with reveal button

### 4.3 Contact Reveal Payment ✅
- [ ] Click "Reveal Contact $1.00" for another user's post
- [ ] **Expected**: Stripe Checkout opens
- [ ] **Expected**: Saved payment method appears (if previously used)
- [ ] Complete $1.00 payment with saved method or new card
- [ ] **Expected**: Payment success and contact revealed

### 4.4 Contact Access After Payment ✅
- [ ] Refresh posts listing
- [ ] **Expected**: Previously paid contact now shows real email
- [ ] **Expected**: No payment button for revealed contacts
- [ ] **Expected**: Contact remains accessible on subsequent visits

---

## 5. Filtering & Search

### 5.1 User Type Filtering ✅
- [ ] Filter posts by "Creators only"
- [ ] **Expected**: Only creator posts visible
- [ ] Filter posts by "Sponsors only"
- [ ] **Expected**: Only sponsor posts visible

### 5.2 Platform Filtering ✅
- [ ] Select "YouTube" platform filter
- [ ] **Expected**: Only YouTube posts shown
- [ ] Test other platforms (Instagram, TikTok, etc.)

### 5.3 Follower Count Filtering ✅
- [ ] Set minimum followers: 30000
- [ ] **Expected**: Only posts with 30k+ followers shown
- [ ] Set maximum followers: 60000
- [ ] **Expected**: Posts filtered by range

### 5.4 Price Point Filtering ✅
- [ ] Set price range: $300 - $600
- [ ] **Expected**: Posts filtered by price range

### 5.5 Interest Search ✅
- [ ] Search for "technology"
- [ ] **Expected**: Posts with tech-related interests shown
- [ ] Search for "fitness gaming"
- [ ] **Expected**: Posts containing either term shown

---

## 6. Error Handling & Edge Cases

### 6.1 Network Interruption ✅
- [ ] Start a payment flow
- [ ] Disable internet briefly during Stripe checkout
- [ ] **Expected**: Graceful error handling
- [ ] **Expected**: Can retry payment successfully

### 6.2 Invalid Payment Data ✅
- [ ] Use test card: `4000 0000 0000 0002` (declined)
- [ ] **Expected**: Payment fails with clear error message
- [ ] **Expected**: Contact remains hidden
- [ ] **Expected**: Can retry with valid card

### 6.3 Session Timeout ✅
- [ ] Login and leave browser idle for extended period
- [ ] Try to access protected endpoint
- [ ] **Expected**: Redirected to login or error message
- [ ] **Expected**: Can login again successfully

### 6.4 Malformed Requests ✅
- [ ] Try to access `/api/posts` with malformed auth header
- [ ] Try POST requests with missing required fields
- [ ] **Expected**: Appropriate 400/401 error responses

---

## 7. Domain Verification (Optional Feature)

### 7.1 Start Domain Verification ✅
- [ ] Access domain verification feature
- [ ] Enter domain: `example.com`
- [ ] **Expected**: Receives DNS TXT record instructions
- [ ] **Expected**: Verification code generated

### 7.2 DNS Verification Check ✅
- [ ] Add TXT record to test domain (if available)
- [ ] Click "Check Verification"
- [ ] **Expected**: Successful verification or clear error

---

## 8. Recommendations System

### 8.1 Creator Recommendations ✅
- [ ] Login as creator
- [ ] Access recommendations page
- [ ] **Expected**: Shows matching sponsors
- [ ] **Expected**: Match scores calculated
- [ ] **Expected**: Sorted by relevance

### 8.2 Sponsor Recommendations ✅
- [ ] Login as sponsor
- [ ] Access recommendations
- [ ] **Expected**: Shows matching creators
- [ ] **Expected**: Relevant matches based on interests/budget

---

## 9. User Reporting

### 9.1 Report User ✅
- [ ] Click "Report" button on user post
- [ ] Enter reason: "Inappropriate content"
- [ ] Submit report
- [ ] **Expected**: Report submitted successfully
- [ ] **Expected**: Confirmation message shown

---

## 10. Mobile Responsiveness

### 10.1 Mobile View ✅
- [ ] Open site on mobile device or use browser dev tools
- [ ] Test all major flows on mobile:
  - Registration
  - Login
  - Post creation
  - Payment flows
  - Contact reveals
- [ ] **Expected**: All features work on mobile
- [ ] **Expected**: UI is responsive and usable

---

## 11. Performance Testing

### 11.1 Multiple Users ✅
- [ ] Create 5+ user accounts
- [ ] Create posts for each
- [ ] Test concurrent access
- [ ] **Expected**: No performance degradation
- [ ] **Expected**: All data remains consistent

### 11.2 Large Data Sets ✅
- [ ] Create 50+ posts (can be automated)
- [ ] Test filtering and search performance
- [ ] **Expected**: Reasonable response times
- [ ] **Expected**: Pagination works if implemented

---

## Post-Test Verification

### Database/Storage Integrity ✅
- [ ] Check that all test users are properly stored
- [ ] Verify payment records match Stripe dashboard
- [ ] Confirm email verification states are correct
- [ ] Validate contact reveal permissions are accurate

### Cleanup ✅
- [ ] Clear test data if needed
- [ ] Reset Stripe test environment
- [ ] Document any bugs found during testing

---

## Test Results Template

```
## Manual Test Results - [Date]

**Tester**: [Name]
**Environment**: [Development/Staging]
**Browser**: [Chrome/Firefox/Safari/Mobile]

### Summary
- Total Tests: __
- Passed: __
- Failed: __
- Issues Found: __

### Critical Issues
1. [Issue description]
   - Severity: High/Medium/Low
   - Steps to reproduce:
   - Expected behavior:
   - Actual behavior:

### Minor Issues
1. [Issue description]
   - Severity: Low
   - Notes:

### Additional Notes
- [Any observations or recommendations]
```

---

## Automated Test Running

To run the automated test suite alongside manual testing:

```bash
# Start server in one terminal
npm run dev

# Run automated tests in another terminal
npm test
```

The automated tests will validate API endpoints while you perform UI testing manually.