# Entity Relationship Documentation

## Entity Relationship Diagram (ERD)

```
┌─────────────────┐    1:1    ┌─────────────────┐
│     USERS       │◄─────────►│ CONTACT_CREDITS │
│                 │           │                 │
│ • id (PK)       │           │ • id (PK)       │
│ • email         │           │ • user_email(FK)│
│ • password_hash │           │ • total_credits │
│ • verified      │           │ • used_credits  │
│ • created_at    │           │ • remaining     │
│ • updated_at    │           └─────────────────┘
└─────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────┐
│      POSTS      │
│                 │
│ • id (PK)       │
│ • user_id (FK)  │
│ • user_type     │
│ • platform      │
│ • followers     │
│ • interests[]   │
│ • price_point   │
│ • description   │
│ • contact_info  │
│ • verified      │
└─────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────┐
│ CONTACT_REVEALS │
│                 │
│ • id (PK)       │
│ • requester(FK) │
│ • target_post   │
│   _id (FK)      │
│ • revealed_via  │
│ • revealed_at   │
└─────────────────┘

┌─────────────────┐    1:N    ┌─────────────────┐
│     USERS       │◄─────────►│VERIFICATION_    │
│                 │           │    TOKENS       │
│                 │           │                 │
│                 │           │ • id (PK)       │
│                 │           │ • user_email(FK)│
│                 │           │ • token         │
│                 │           │ • expires_at    │
│                 │           │ • created_at    │
│                 │           └─────────────────┘
│                 │
│                 │    1:N    ┌─────────────────┐
│                 │◄─────────►│DOMAIN_          │
│                 │           │VERIFICATIONS    │
│                 │           │                 │
│                 │           │ • id (PK)       │
│                 │           │ • user_id (FK)  │
│                 │           │ • domain        │
│                 │           │ • verification  │
│                 │           │   _code         │
│                 │           │ • status        │
│                 │           │ • verified_at   │
│                 │           └─────────────────┘
│                 │
│                 │    1:N    ┌─────────────────┐
│                 │◄─────────►│ PAYMENT_        │
│                 │           │   SESSIONS      │
│                 │           │                 │
│                 │           │ • id (PK)       │
│                 │           │ • user_email(FK)│
│                 │           │ • payment_type  │
│                 │           │ • amount        │
│                 │           │ • status        │
│                 │           │ • metadata      │
│                 │           └─────────────────┘
│                 │
│                 │    1:N    ┌─────────────────┐
│                 │◄─────────►│ USER_PAYMENTS   │
│                 │           │                 │
│                 │           │ • id (PK)       │
│                 │           │ • user_email(FK)│
│                 │           │ • payment_type  │
│                 │           │ • amount        │
│                 │           │ • stripe_session│
│                 │           │   _id           │
│                 │           │ • paid_at       │
│                 │           └─────────────────┘
│                 │
│                 │    1:N    ┌─────────────────┐
│                 │◄─────────►│ CREDIT_         │
│                 │           │   PURCHASES     │
│                 │           │                 │
│                 │           │ • id (PK)       │
│                 │           │ • user_email(FK)│
│                 │           │ • credits       │
│                 │           │   _purchased    │
│                 │           │ • amount_paid   │
│                 │           │ • stripe_session│
│                 │           │   _id           │
│                 │           │ • purchased_at  │
│                 │           └─────────────────┘
│                 │
│                 │    1:N    ┌─────────────────┐
│                 │◄─────────►│ USER_REPORTS    │
│                 │           │                 │
│                 │           │ • id (PK)       │
│                 │           │ • reported_user │
│                 │           │   _id (FK)      │
│                 │           │ • reported_post │
│                 │           │   _id (FK)      │
│                 │           │ • reporter_email│
│                 │           │ • reason        │
│                 │           │ • status        │
│                 │           └─────────────────┘
```

## Detailed Relationship Mapping

### Core Entity Relationships

#### 1. USERS → POSTS (One-to-Many)
- **Relationship**: One user can have multiple posts, but each post belongs to one user
- **Foreign Key**: `posts.user_id` references `users.id`
- **Constraint**: Currently enforced as one-to-one in application logic (business rule)
- **Cascade**: ON DELETE CASCADE - when user is deleted, their posts are deleted

#### 2. USERS → CONTACT_CREDITS (One-to-One)
- **Relationship**: Each user has exactly one credit balance record
- **Foreign Key**: `contact_credits.user_email` references `users.email`
- **Constraint**: UNIQUE constraint on user_email
- **Cascade**: ON DELETE CASCADE

#### 3. POSTS → CONTACT_REVEALS (One-to-Many)
- **Relationship**: One post can be revealed to many users
- **Foreign Key**: `contact_reveals.target_post_id` references `posts.id`
- **Additional Key**: `contact_reveals.requester_email` references `users.email`
- **Constraint**: Composite UNIQUE on (requester_email, target_post_id)
- **Cascade**: ON DELETE CASCADE

### Authentication & Verification Relationships

#### 4. USERS → VERIFICATION_TOKENS (One-to-Many)
- **Relationship**: User can have multiple verification attempts
- **Foreign Key**: `verification_tokens.user_email` references `users.email`
- **Business Logic**: Only one active token per user (enforced in application)
- **Cleanup**: Automated cleanup of expired tokens

#### 5. USERS → DOMAIN_VERIFICATIONS (One-to-Many)
- **Relationship**: User can verify multiple domains
- **Foreign Key**: `domain_verifications.user_id` references `users.id`
- **Constraint**: UNIQUE on (user_id, domain) - one verification per domain per user
- **Cascade**: ON DELETE CASCADE

### Payment System Relationships

#### 6. USERS → PAYMENT_SESSIONS (One-to-Many)
- **Relationship**: User can have multiple payment sessions
- **Foreign Key**: `payment_sessions.user_email` references `users.email`
- **Lifecycle**: Sessions are cleaned up after completion/expiry
- **Cascade**: ON DELETE CASCADE

#### 7. USERS → USER_PAYMENTS (One-to-Many)
- **Relationship**: User can make multiple payments
- **Foreign Key**: `user_payments.user_email` references `users.email`
- **Audit Trail**: Permanent record of all payments
- **Cascade**: ON DELETE CASCADE (consider SET NULL for audit purposes)

#### 8. USERS → CREDIT_PURCHASES (One-to-Many)
- **Relationship**: User can purchase credits multiple times
- **Foreign Key**: `credit_purchases.user_email` references `users.email`
- **Business Logic**: Each purchase adds to total credits in CONTACT_CREDITS
- **Cascade**: ON DELETE CASCADE

### Reporting & Moderation Relationships

#### 9. USERS → USER_REPORTS (One-to-Many as Reporter)
- **Relationship**: User can file multiple reports
- **Foreign Key**: `user_reports.reporter_email` references `users.email` (nullable)
- **Note**: Anonymous reporting allowed

#### 10. USERS → USER_REPORTS (One-to-Many as Reported User)
- **Relationship**: User can be reported multiple times
- **Foreign Key**: `user_reports.reported_user_id` references `users.id`
- **Cascade**: ON DELETE CASCADE

#### 11. POSTS → USER_REPORTS (One-to-Many)
- **Relationship**: Post can be reported multiple times
- **Foreign Key**: `user_reports.reported_post_id` references `posts.id`
- **Cascade**: ON DELETE CASCADE

### Configuration Relationships

#### 12. PRICING_TIERS (Standalone)
- **Type**: Configuration table with no foreign key relationships
- **Purpose**: Defines available credit purchase options
- **Business Logic**: Referenced by application for pricing calculations

#### 13. PLATFORM_CONFIG (Standalone)
- **Type**: Key-value configuration store
- **Purpose**: System-wide settings and constants
- **No Direct Relationships**: Referenced by application logic

## Business Logic Constraints

### Referential Integrity Rules

1. **Email Consistency**: All email references must be consistent across tables
2. **Credit Balance**: `contact_credits.used_credits` ≤ `contact_credits.total_credits`
3. **Post Uniqueness**: One active post per user (enforced in application)
4. **Payment Completion**: Payment sessions must be completed before granting benefits

### Data Flow Relationships

#### User Registration Flow
```
USERS → VERIFICATION_TOKENS → EMAIL_VERIFICATION → USERS.verified = true
```

#### Post Creation Flow
```
USERS.verified = true → USER_PAYMENTS(posting_fee) → POSTS creation allowed
```

#### Contact Reveal Flow
```
CONTACT_CREDITS.remaining > 0 → CONTACT_REVEALS creation → CONTACT_CREDITS.used_credits++
```

#### Payment Flow
```
PAYMENT_SESSIONS → Stripe Processing → USER_PAYMENTS + benefit grant
```

#### Credit Purchase Flow
```
PAYMENT_SESSIONS(bulk_contact) → CREDIT_PURCHASES → CONTACT_CREDITS.total_credits++
```

### Index Strategy for Relationships

#### Foreign Key Indexes (Performance)
- All foreign key columns have indexes
- Composite indexes on frequently queried combinations

#### Unique Constraint Indexes (Data Integrity)
- Email uniqueness across users
- User-post uniqueness (one post per user)
- User-contact reveal uniqueness (one reveal per user-post pair)

#### Business Logic Indexes (Query Optimization)
- Posts filtered by user_type, platform, followers, price_point
- Contact reveals by requester for user's revealed contacts
- Payment history by user and date for analytics

## Migration Considerations

### Foreign Key Dependencies (Creation Order)
1. `users` (no dependencies)
2. `posts` (depends on users)
3. `contact_credits` (depends on users)
4. `verification_tokens` (depends on users)
5. `domain_verifications` (depends on users)
6. `payment_sessions` (depends on users)
7. `user_payments` (depends on users)
8. `credit_purchases` (depends on users)
9. `contact_reveals` (depends on users and posts)
10. `user_reports` (depends on users and posts)
11. `pricing_tiers` (standalone)
12. `platform_config` (standalone)

### Data Migration Order (From In-Memory)
1. Migrate `registeredUsers` → `users`
2. Migrate `posts` (including sample data) → `posts`
3. Migrate `verificationTokens` → `verification_tokens`
4. Migrate `paidUsers` → `user_payments`
5. Migrate `bulkContactSessions` → `contact_credits` + `credit_purchases`
6. Migrate `contactReveals` → `contact_reveals`
7. Initialize `platform_config` with environment variables
8. Initialize `pricing_tiers` with current pricing structure