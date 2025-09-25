const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.USER,
    host: process.env.HOST,
    database: process.env.DB,
    password: process.env.PASSWORD,
    port: process.env.DB_PORT || 5432,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test PostgreSQL connection
pool.connect()
    .then(() => {
        console.log('✅ Connected to PostgreSQL');
    })
    .catch(err => {
        console.error('❌ PostgreSQL connection error:', err);
        process.exit(1);
    });

// Initialize the database (create tables if they don't exist)
const initDB = async () => {
    // Users table
    const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        verified BOOLEAN DEFAULT false,
        stripe_customer_id VARCHAR(255) UNIQUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_verified ON users(verified);
    CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id);
    `;

    // Posts table
    const createPostsTable = `
    CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
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

    CREATE INDEX IF NOT EXISTS idx_posts_user_type ON posts(user_type);
    CREATE INDEX IF NOT EXISTS idx_posts_platform ON posts(platform);
    CREATE INDEX IF NOT EXISTS idx_posts_followers ON posts(followers);
    CREATE INDEX IF NOT EXISTS idx_posts_price_point ON posts(price_point);
    CREATE INDEX IF NOT EXISTS idx_posts_interests ON posts USING GIN(interests);
    CREATE INDEX IF NOT EXISTS idx_posts_contact_info ON posts(contact_info);
    CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);
    `;

    // Email verification tokens table
    const createVerificationTokensTable = `
    CREATE TABLE IF NOT EXISTS verification_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_email VARCHAR(255) NOT NULL REFERENCES users(email) ON DELETE CASCADE,
        token VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours'),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_verification_tokens_token ON verification_tokens(token);
    CREATE INDEX IF NOT EXISTS idx_verification_tokens_expires_at ON verification_tokens(expires_at);
    `;

    // Payment sessions table
    const createPaymentSessionsTable = `
    CREATE TABLE IF NOT EXISTS payment_sessions (
        id VARCHAR(255) PRIMARY KEY,
        user_email VARCHAR(255) NOT NULL REFERENCES users(email) ON DELETE CASCADE,
        payment_type VARCHAR(50) NOT NULL CHECK (payment_type IN ('posting_fee', 'contact_reveal')),
        amount INTEGER NOT NULL,
        metadata JSONB,
        status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
        stripe_session_data JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP WITH TIME ZONE
    );

    CREATE INDEX IF NOT EXISTS idx_payment_sessions_user_email ON payment_sessions(user_email);
    CREATE INDEX IF NOT EXISTS idx_payment_sessions_type ON payment_sessions(payment_type);
    CREATE INDEX IF NOT EXISTS idx_payment_sessions_status ON payment_sessions(status);
    `;

    // User payments table
    const createUserPaymentsTable = `
    CREATE TABLE IF NOT EXISTS user_payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_email VARCHAR(255) NOT NULL REFERENCES users(email) ON DELETE CASCADE,
        payment_type VARCHAR(50) NOT NULL,
        amount INTEGER NOT NULL,
        stripe_session_id VARCHAR(255),
        paid_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_user_payments_user_email ON user_payments(user_email);
    CREATE INDEX IF NOT EXISTS idx_user_payments_type ON user_payments(payment_type);
    CREATE INDEX IF NOT EXISTS idx_user_payments_paid_at ON user_payments(paid_at);
    `;

    // Contact reveals table
    const createContactRevealsTable = `
    CREATE TABLE IF NOT EXISTS contact_reveals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        requester_email VARCHAR(255) NOT NULL REFERENCES users(email) ON DELETE CASCADE,
        target_post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        stripe_payment_intent_id VARCHAR(255) NOT NULL,
        amount_paid INTEGER NOT NULL,
        revealed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT unique_reveal UNIQUE (requester_email, target_post_id)
    );

    CREATE INDEX IF NOT EXISTS idx_contact_reveals_requester ON contact_reveals(requester_email);
    CREATE INDEX IF NOT EXISTS idx_contact_reveals_target ON contact_reveals(target_post_id);
    CREATE INDEX IF NOT EXISTS idx_contact_reveals_revealed_at ON contact_reveals(revealed_at);
    `;

    // User reports table
    const createUserReportsTable = `
    CREATE TABLE IF NOT EXISTS user_reports (
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

    CREATE INDEX IF NOT EXISTS idx_user_reports_status ON user_reports(status);
    CREATE INDEX IF NOT EXISTS idx_user_reports_created_at ON user_reports(created_at);
    `;

    // Update timestamp trigger function
    const createUpdateTriggerFunction = `
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    $$ language 'plpgsql';
    `;

    // Apply triggers
    const createTriggers = `
    DROP TRIGGER IF EXISTS update_users_updated_at ON users;
    CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    DROP TRIGGER IF EXISTS update_posts_updated_at ON posts;
    CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON posts
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `;

    try {
        await pool.query(createUsersTable);
        await pool.query(createPostsTable);
        await pool.query(createVerificationTokensTable);
        await pool.query(createPaymentSessionsTable);
        await pool.query(createUserPaymentsTable);
        await pool.query(createContactRevealsTable);
        await pool.query(createUserReportsTable);
        await pool.query(createUpdateTriggerFunction);
        await pool.query(createTriggers);
        console.log('✅ Database initialized with all tables.');
    } catch (err) {
        console.error('❌ Error initializing database:', err);
    }
};

// Clean up expired verification tokens
const cleanupExpiredTokens = async () => {
    try {
        await pool.query('DELETE FROM verification_tokens WHERE expires_at < CURRENT_TIMESTAMP');
        console.log('✅ Cleaned up expired verification tokens');
    } catch (err) {
        console.error('❌ Error cleaning up tokens:', err);
    }
};

initDB();

// Run cleanup every hour
setInterval(cleanupExpiredTokens, 60 * 60 * 1000);

module.exports = pool;