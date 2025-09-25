# Creator-Sponsor Platform Database Schema

This document defines the complete database schema for the Creator-Sponsor Platform, including all entities, relationships, and data structures needed for E2E deployment.

## Core Entities

### 1. Users (Authentication)

**Purpose**: Stores registered user accounts with authentication and verification data.

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    verified BOOLEAN DEFAULT false,
    stripe_customer_id VARCHAR(255) UNIQUE, -- Stripe Customer ID for saved payment methods
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_verified ON users(verified);
CREATE INDEX idx_users_stripe_customer ON users(stripe_customer_id);
```

**Current Implementation**: In-memory array `registeredUsers`
**Fields Used**:
- `id`: UUID v4 generated identifier
- `email`: User's email address (unique)
- `password`: Hashed with bcryptjs (10 rounds)
- `verified`: Email verification status
- `createdAt`: Account creation timestamp

### 2. Posts (Creator/Sponsor Listings)

**Purpose**: Stores both creator and sponsor posts/listings with their details and requirements.

```sql
CREATE TABLE posts (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('creator', 'sponsor')),
    name VARCHAR(255),
    platform VARCHAR(100) NOT NULL,
    followers INTEGER NOT NULL DEFAULT 0,
    interests TEXT[] NOT NULL,
    price_point DECIMAL(10,2) NOT NULL,
    description TEXT NOT NULL,
    contact_info VARCHAR(255) NOT NULL,
    avatar VARCHAR(10),
    verified BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_user_post UNIQUE (user_id)
);

CREATE INDEX idx_posts_user_type ON posts(user_type);
CREATE INDEX idx_posts_platform ON posts(platform);
CREATE INDEX idx_posts_followers ON posts(followers);
CREATE INDEX idx_posts_price_point ON posts(price_point);
CREATE INDEX idx_posts_interests ON posts USING GIN(interests);
CREATE INDEX idx_posts_contact_info ON posts(contact_info);
CREATE INDEX idx_posts_created_at ON posts(created_at);
```

**Current Implementation**: In-memory array `posts` (combined with sample data)
**Fields Used**:
- `id`: Auto-incrementing integer
- `userId`: Foreign key to users table
- `userType`: 'creator' or 'sponsor'
- `name`: Display name (optional in current implementation)
- `platform`: Social media platform
- `followers`: Follower/audience count
- `interests`: Array of interest categories
- `pricePoint`: Budget/rate in dollars
- `description`: Detailed description
- `contactInfo`: Contact information (email/handle)
- `avatar`: Emoji avatar (optional)
- `verified`: Verification status

### 3. Email Verification Tokens

**Purpose**: Manages email verification workflow.

```sql
CREATE TABLE verification_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email VARCHAR(255) NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_verification_tokens_token ON verification_tokens(token);
CREATE INDEX idx_verification_tokens_expires_at ON verification_tokens(expires_at);
```

**Current Implementation**: In-memory Map `verificationTokens`

### 4. Domain Verification

**Purpose**: Manages domain ownership verification for enhanced trust.

```sql
CREATE TABLE domain_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    domain VARCHAR(255) NOT NULL,
    verification_code VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'failed')),
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_user_domain UNIQUE (user_id, domain)
);

CREATE INDEX idx_domain_verifications_status ON domain_verifications(status);
CREATE INDEX idx_domain_verifications_domain ON domain_verifications(domain);
```

**Current Implementation**: Stored within user object as `domainVerification` property

## Payment System Entities

### 5. Payment Sessions

**Purpose**: Tracks Stripe checkout sessions for payment processing.

```sql
CREATE TABLE payment_sessions (
    id VARCHAR(255) PRIMARY KEY, -- Stripe session ID
    user_email VARCHAR(255) NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    payment_type VARCHAR(50) NOT NULL CHECK (payment_type IN ('posting_fee', 'contact_reveal', 'bulk_contact_reveal')),
    amount INTEGER NOT NULL, -- Amount in cents
    metadata JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
    stripe_session_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_payment_sessions_user_email ON payment_sessions(user_email);
CREATE INDEX idx_payment_sessions_type ON payment_sessions(payment_type);
CREATE INDEX idx_payment_sessions_status ON payment_sessions(status);
```

**Current Implementation**: In-memory Map `paymentSessions`

### 6. User Payments

**Purpose**: Records successful payments and user payment status.

```sql
CREATE TABLE user_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email VARCHAR(255) NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    payment_type VARCHAR(50) NOT NULL,
    amount INTEGER NOT NULL, -- Amount in cents
    stripe_session_id VARCHAR(255),
    paid_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_payments_user_email ON user_payments(user_email);
CREATE INDEX idx_user_payments_type ON user_payments(payment_type);
CREATE INDEX idx_user_payments_paid_at ON user_payments(paid_at);
```

**Current Implementation**: In-memory Set `paidUsers` for posting fees only

### 7. Contact Reveals

**Purpose**: Tracks which contacts have been revealed to which users via individual Stripe payments.

```sql
CREATE TABLE contact_reveals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_email VARCHAR(255) NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    target_post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    stripe_payment_intent_id VARCHAR(255) NOT NULL, -- Stripe PaymentIntent ID
    amount_paid INTEGER NOT NULL, -- Amount in cents ($1.00 = 100)
    revealed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_reveal UNIQUE (requester_email, target_post_id)
);

CREATE INDEX idx_contact_reveals_requester ON contact_reveals(requester_email);
CREATE INDEX idx_contact_reveals_target ON contact_reveals(target_post_id);
CREATE INDEX idx_contact_reveals_revealed_at ON contact_reveals(revealed_at);
```

**Current Implementation**: In-memory Map `contactReveals` with key format `{email}-{userId}`
**New Approach**: Each contact reveal is a separate $1 Stripe payment using saved payment methods

## Supporting Entities

### 8. User Reports

**Purpose**: Stores user reports for moderation.

```sql
CREATE TABLE user_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reported_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    reported_post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
    reporter_email VARCHAR(255),
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by VARCHAR(255)
);

CREATE INDEX idx_user_reports_status ON user_reports(status);
CREATE INDEX idx_user_reports_created_at ON user_reports(created_at);
```

**Current Implementation**: Basic logging to console only

### 9. Platform Configuration

**Purpose**: Stores system configuration and pricing.

```sql
CREATE TABLE platform_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value VARCHAR(500) NOT NULL,
    data_type VARCHAR(20) NOT NULL DEFAULT 'string' CHECK (data_type IN ('string', 'integer', 'decimal', 'boolean', 'json')),
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO platform_config (config_key, config_value, data_type, description) VALUES
('POST_FEE', '500', 'integer', 'Posting fee in cents ($5.00)'),
('CONTACT_REVEAL_FEE', '100', 'integer', 'Contact reveal fee in cents ($1.00)'),
('JWT_SECRET', 'your-secret-key-change-in-production', 'string', 'JWT signing secret'),
('BASE_URL', 'http://localhost:3000', 'string', 'Application base URL'),
('STRIPE_WEBHOOK_SECRET', '', 'string', 'Stripe webhook endpoint secret');
```

**Current Implementation**: Environment variables and hardcoded values

## Simplified Pricing

**Contact Reveals**: $1.00 per contact reveal (individual payments using saved Stripe payment methods)
**Post Creation**: $5.00 one-time fee per post

## Environment Variables Required

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/creator_sponsor_platform
DATABASE_SSL=false

# Authentication
JWT_SECRET=your-super-secret-jwt-key-min-256-bits

# Stripe Payment Processing
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Email Configuration
EMAIL_USER=your-email@domain.com
EMAIL_PASS=your-app-password
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587

# Application
NODE_ENV=production
PORT=3000
BASE_URL=https://yourdomain.com

# Pricing (in cents)
POST_FEE=500
CONTACT_REVEAL_FEE=100
```

## Data Migration Notes

### From Current In-Memory to Database

1. **Users Migration**: Transfer `registeredUsers` array to `users` table + create Stripe customers
2. **Posts Migration**: Combine sample data and user-created posts into `posts` table
3. **Payment Data**:
   - Transfer `paidUsers` Set to `user_payments` table
   - Transfer `contactReveals` Map to `contact_reveals` table (simplified - no credit system)
4. **Verification Data**: Transfer `verificationTokens` Map to `verification_tokens` table

**Note**: Credit system (`bulkContactSessions`) is eliminated in favor of Stripe's native saved payment methods

### Database Triggers and Functions

```sql
-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Clean up expired verification tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM verification_tokens WHERE expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-tokens', '0 * * * *', 'SELECT cleanup_expired_tokens();');
```

## Indexes for Performance

```sql
-- Composite indexes for common query patterns
CREATE INDEX idx_posts_user_type_platform ON posts(user_type, platform);
CREATE INDEX idx_posts_user_type_followers ON posts(user_type, followers);
CREATE INDEX idx_posts_user_type_price ON posts(user_type, price_point);

-- Full-text search on posts
CREATE INDEX idx_posts_search ON posts USING gin(to_tsvector('english', description || ' ' || array_to_string(interests, ' ')));

-- Payment analytics
CREATE INDEX idx_user_payments_date ON user_payments(date_trunc('day', paid_at));
CREATE INDEX idx_credit_purchases_date ON credit_purchases(date_trunc('day', purchased_at));
```

## Database Constraints

```sql
-- Business logic constraints
ALTER TABLE posts ADD CONSTRAINT check_positive_followers CHECK (followers >= 0);
ALTER TABLE posts ADD CONSTRAINT check_positive_price CHECK (price_point > 0);
ALTER TABLE contact_credits ADD CONSTRAINT check_non_negative_credits CHECK (total_credits >= 0 AND used_credits >= 0);
ALTER TABLE contact_credits ADD CONSTRAINT check_used_not_exceed_total CHECK (used_credits <= total_credits);

-- Data validation
ALTER TABLE users ADD CONSTRAINT check_valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
ALTER TABLE posts ADD CONSTRAINT check_valid_platform CHECK (platform IN ('youtube', 'instagram', 'tiktok', 'twitch', 'linkedin', 'twitter', 'facebook'));
```

This schema provides a complete foundation for E2E deployment while maintaining backward compatibility with the current implementation.