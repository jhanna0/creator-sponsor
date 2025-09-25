const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const pool = require('./db');
require('dotenv').config();

// Import Stripe payment handlers
const {
    createPostingCheckoutSession,
    createContactRevealCheckoutSession,
    handlePaymentSuccess,
    hasUserPaidForPosting,
    hasUserPaidForContact,
    getUserPaymentStatus,
    handleStripeWebhook,
    getOrCreateStripeCustomer
} = require('./stripe_handler');

// UUID replacement function
function uuidv4() {
    return crypto.randomUUID();
}

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Email configuration - for development, use ethereal for testing
let transporter;

async function createTransporter() {
    if (process.env.NODE_ENV === 'production') {
        // Production: Use SES or real email service
        transporter = nodemailer.createTransport({
            service: 'gmail', // Change to SES when deploying
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
    } else {
        // Development: Use ethereal for testing
        const testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass
            }
        });
    }
}

// Initialize transporter
createTransporter().catch(console.error);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Load sample data for migration (will insert into database)
const sampleData = require('./data.js');
const { migrateSampleData, clearDatabase } = require('./migrate-data');

// Authentication middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
    });
}

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Auth Routes
app.post('/api/auth/signup', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }

    try {
        // Check if email already exists and is verified
        const existingUser = await pool.query('SELECT email, verified FROM users WHERE email = $1', [email]);

        if (existingUser.rows.length > 0) {
            const user = existingUser.rows[0];
            if (user.verified) {
                return res.status(400).json({ error: 'Email already registered and verified' });
            } else {
                // Email exists but not verified - update password and resend verification
                const hashedPassword = await bcrypt.hash(password, 10);
                await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [hashedPassword, email]);

                // Delete any existing verification tokens for this email
                await pool.query('DELETE FROM verification_tokens WHERE user_email = $1', [email]);
                
                // Generate new verification token
                const verificationToken = uuidv4();
                await pool.query(
                    'INSERT INTO verification_tokens (user_email, token) VALUES ($1, $2)',
                    [email, verificationToken]
                );

                // Send verification email
                const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
                const verificationUrl = `${baseUrl}/api/auth/verify/${verificationToken}`;

                const info = await transporter.sendMail({
                    from: process.env.EMAIL_USER || 'noreply@yourapp.com',
                    to: email,
                    subject: 'Verify your email',
                    html: `
                        <h2>Welcome to Creator-Sponsor Platform!</h2>
                        <p>Please click the link below to verify your email:</p>
                        <a href="${verificationUrl}">Verify Email</a>
                        <p>Or copy this link: ${verificationUrl}</p>
                    `
                });

                // Log ethereal URL for development
                if (process.env.NODE_ENV !== 'production') {
                    console.log('Verification email sent!');
                    console.log('Preview URL: ' + nodemailer.getTestMessageUrl(info));
                }

                return res.json({
                    success: true,
                    message: 'Registration successful! Please check your email to verify your account.'
                });
            }
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user in database
        const userResult = await pool.query(
            'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
            [email, hashedPassword]
        );
        const user = userResult.rows[0];

        // Generate verification token
        const verificationToken = uuidv4();
        await pool.query(
            'INSERT INTO verification_tokens (user_email, token) VALUES ($1, $2)',
            [email, verificationToken]
        );

        // Send verification email
        const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
        const verificationUrl = `${baseUrl}/api/auth/verify/${verificationToken}`;

        const info = await transporter.sendMail({
            from: process.env.EMAIL_USER || 'noreply@yourapp.com',
            to: email,
            subject: 'Verify your email',
            html: `
                <h2>Welcome to Creator-Sponsor Platform!</h2>
                <p>Please click the link below to verify your email:</p>
                <a href="${verificationUrl}">Verify Email</a>
                <p>Or copy this link: ${verificationUrl}</p>
            `
        });

        // Log ethereal URL for development
        if (process.env.NODE_ENV !== 'production') {
            console.log('Verification email sent!');
            console.log('Preview URL: ' + nodemailer.getTestMessageUrl(info));
        }

        res.json({
            success: true,
            message: 'Registration successful! Please check your email to verify your account.'
        });

    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

app.get('/api/auth/verify/:token', async (req, res) => {
    const { token } = req.params;

    try {
        // Find verification token
        const tokenResult = await pool.query(
            'SELECT user_email FROM verification_tokens WHERE token = $1 AND expires_at > CURRENT_TIMESTAMP',
            [token]
        );

        if (tokenResult.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired verification token' });
        }

        const email = tokenResult.rows[0].user_email;

        // Update user as verified
        await pool.query('UPDATE users SET verified = true WHERE email = $1', [email]);

        // Delete the verification token
        await pool.query('DELETE FROM verification_tokens WHERE token = $1', [token]);

        res.json({ success: true, message: 'Email verified successfully!' });
    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).json({ error: 'Verification failed' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Find user by email
        const userResult = await pool.query(
            'SELECT id, email, password_hash, verified FROM users WHERE email = $1',
            [email]
        );

        if (userResult.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = userResult.rows[0];

        if (!user.verified) {
            return res.status(401).json({ error: 'Please verify your email first' });
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { userId: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            token,
            user: { id: user.id, email: user.email, verified: user.verified }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Protected post creation - requires auth AND payment
app.post('/api/posts', authenticateToken, async (req, res) => {
    const { userType, platform, followers, interests, pricePoint, description, contactInfo } = req.body;

    // Enforce contact email must match verified registration email
    if (contactInfo !== req.user.email) {
        return res.status(400).json({
            error: 'Contact email must match your verified registration email'
        });
    }

    try {
        // Check if user has paid the posting fee
        if (!(await hasUserPaidForPosting(req.user.email))) {
            return res.status(402).json({
                error: 'Payment required to create a post. Please pay the $5 posting fee first.',
                requiresPayment: true,
                paymentType: 'posting_fee'
            });
        }

        // Check if user already has an active post (one per email limitation)
        const existingPost = await pool.query('SELECT id FROM posts WHERE contact_info = $1', [req.user.email]);
        if (existingPost.rows.length > 0) {
            return res.status(400).json({
                error: 'You already have an active post. Please delete it first to create a new one.'
            });
        }

        const interestsArray = interests.split(',').map(i => i.trim());

        const postResult = await pool.query(`
            INSERT INTO posts (
                user_id, user_type, platform, followers, interests,
                price_point, description, contact_info, verified
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        `, [
            req.user.userId,
            userType,
            platform,
            parseInt(followers),
            interestsArray,
            parseFloat(pricePoint),
            description,
            req.user.email,
            true
        ]);

        const post = postResult.rows[0];
        res.json({ success: true, post });
    } catch (error) {
        console.error('Post creation error:', error);
        res.status(500).json({ error: 'Failed to create post' });
    }
});

// Delete user's post
app.delete('/api/posts/my-post', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'DELETE FROM posts WHERE contact_info = $1 RETURNING id',
            [req.user.email]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No post found' });
        }

        res.json({ success: true, message: 'Post deleted successfully' });
    } catch (error) {
        console.error('Post deletion error:', error);
        res.status(500).json({ error: 'Failed to delete post' });
    }
});

app.get('/api/posts', async (req, res) => {
    const { userType, platform, minFollowers, maxFollowers, interests, minPrice, maxPrice } = req.query;

    // Get requester email from auth header if available
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    let requesterEmail = null;

    if (token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            requesterEmail = decoded.email;
        } catch (err) {
            // Invalid token, but still show public posts
        }
    }

    try {
        let query = 'SELECT * FROM posts WHERE 1=1';
        const params = [];
        let paramCount = 0;

        // Build dynamic query based on filters
        if (userType) {
            paramCount++;
            query += ` AND user_type = $${paramCount}`;
            params.push(userType);
        }

        if (platform) {
            paramCount++;
            query += ` AND LOWER(platform) = LOWER($${paramCount})`;
            params.push(platform);
        }

        if (minFollowers) {
            paramCount++;
            query += ` AND followers >= $${paramCount}`;
            params.push(parseInt(minFollowers));
        }

        if (maxFollowers) {
            paramCount++;
            query += ` AND followers <= $${paramCount}`;
            params.push(parseInt(maxFollowers));
        }

        if (minPrice) {
            paramCount++;
            query += ` AND price_point >= $${paramCount}`;
            params.push(parseFloat(minPrice));
        }

        if (maxPrice) {
            paramCount++;
            query += ` AND price_point <= $${paramCount}`;
            params.push(parseFloat(maxPrice));
        }

        if (interests) {
            const searchTerms = interests.toLowerCase().split(' ').filter(term => term.trim());
            if (searchTerms.length > 0) {
                paramCount++;
                query += ` AND (LOWER(description) LIKE $${paramCount} OR EXISTS (
                    SELECT 1 FROM unnest(interests) AS interest
                    WHERE LOWER(interest) LIKE $${paramCount}
                ))`;
                params.push(`%${searchTerms.join('%')}%`);
            }
        }

        query += ' ORDER BY created_at DESC';

        const result = await pool.query(query, params);
        let posts = result.rows;

        // Hide contact information unless user has paid or it's their own post
        const postsWithContactInfo = [];
        for (const post of posts) {
            const isOwnPost = requesterEmail && post.contact_info === requesterEmail;
            const hasPaidForContact = requesterEmail && await hasUserPaidForContact(requesterEmail, post.id.toString());

            if (isOwnPost || hasPaidForContact) {
                postsWithContactInfo.push({
                    ...post,
                    userType: post.user_type,
                    pricePoint: parseFloat(post.price_point),
                    contactInfo: post.contact_info,
                    createdAt: post.created_at
                });
            } else {
                postsWithContactInfo.push({
                    ...post,
                    userType: post.user_type,
                    pricePoint: parseFloat(post.price_point),
                    contactInfo: '••••••••@••••••••.com',
                    contactHidden: true,
                    revealCost: parseFloat(process.env.CONTACT_REVEAL_FEE) / 100 || 1,
                    createdAt: post.created_at
                });
            }
        }

        res.json(postsWithContactInfo);
    } catch (error) {
        console.error('Posts fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch posts' });
    }
});

// Payment endpoints
app.post('/api/payment/create-posting-session', authenticateToken, createPostingCheckoutSession);

app.post('/api/payment/create-contact-reveal-session', authenticateToken, createContactRevealCheckoutSession);

// Removed bulk contact session - now using individual payments with Stripe saved payment methods

app.get('/api/payment/success', handlePaymentSuccess);

// Get contact info if user has paid for reveal
app.post('/api/reveal-contact', authenticateToken, async (req, res) => {
    const { targetUserId } = req.body;

    if (!targetUserId) {
        return res.status(400).json({ error: 'Target user ID is required' });
    }

    try {
        // Check if already revealed (paid)
        if (await hasUserPaidForContact(req.user.email, targetUserId)) {
            const postResult = await pool.query(
                'SELECT contact_info FROM posts WHERE id = $1',
                [parseInt(targetUserId)]
            );

            if (postResult.rows.length > 0) {
                return res.json({
                    success: true,
                    message: 'Contact information revealed',
                    contactInfo: postResult.rows[0].contact_info,
                    alreadyRevealed: true
                });
            } else {
                return res.status(404).json({ error: 'Post not found' });
            }
        } else {
            // User hasn't paid yet - they need to pay through Stripe checkout
            return res.status(402).json({
                error: 'Payment required to reveal contact information.',
                requiresPayment: true,
                message: 'Please use the payment button to reveal this contact for $1.00'
            });
        }
    } catch (error) {
        console.error('Contact reveal error:', error);
        res.status(500).json({ error: 'Failed to process contact reveal' });
    }
});

// Get user's payment status
app.get('/api/payment/status', authenticateToken, async (req, res) => {
    try {
        const status = await getUserPaymentStatus(req.user.email);
        res.json({
            success: true,
            ...status
        });
    } catch (error) {
        console.error('Payment status error:', error);
        res.status(500).json({ error: 'Failed to get payment status' });
    }
});

// Stripe webhook endpoint (for production)
app.post('/api/payment/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

// Serve payment success page
app.get('/payment-success', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'payment-success.html'));
});

// Serve payment cancelled page
app.get('/payment-cancelled', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'payment-cancelled.html'));
});

// Development helper - get verification link for testing
app.get('/api/dev/verification-link/:email', async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(404).json({ error: 'Not available in production' });
    }

    try {
        const { email } = req.params;
        const result = await pool.query(
            'SELECT token FROM verification_tokens WHERE user_email = $1 AND expires_at > CURRENT_TIMESTAMP ORDER BY created_at DESC LIMIT 1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No active verification token found' });
        }

        const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
        const verificationUrl = `${baseUrl}/api/auth/verify/${result.rows[0].token}`;

        res.json({
            success: true,
            verificationUrl,
            message: 'Click this link to verify your email'
        });
    } catch (error) {
        console.error('Error getting verification link:', error);
        res.status(500).json({ error: 'Failed to get verification link' });
    }
});

// Report user endpoint
app.post('/api/report', async (req, res) => {
    const { userId, postId, reason } = req.body;

    if ((!userId && !postId) || !reason) {
        return res.status(400).json({ error: 'User ID or Post ID and reason are required' });
    }

    try {
        // Get reporter email from auth header if available
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        let reporterEmail = null;

        if (token) {
            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                reporterEmail = decoded.email;
            } catch (err) {
                // Anonymous report is fine
            }
        }

        // Store report in database
        await pool.query(`
            INSERT INTO user_reports (reported_user_id, reported_post_id, reporter_email, reason)
            VALUES ($1, $2, $3, $4)
        `, [userId || null, postId || null, reporterEmail, reason]);

        console.log(`Report received: User/Post ${userId || postId} reported for: ${reason}`);
        res.json({ success: true, message: 'Report submitted successfully' });
    } catch (error) {
        console.error('Report submission error:', error);
        res.status(500).json({ error: 'Failed to submit report' });
    }
});

// Matching algorithm
function calculateMatchScore(user1, user2) {
    let score = 0;

    // Interest overlap (40% of score)
    const commonInterests = user1.interests.filter(interest =>
        user2.interests.some(otherInterest =>
            interest.toLowerCase().includes(otherInterest.toLowerCase()) ||
            otherInterest.toLowerCase().includes(interest.toLowerCase())
        )
    );
    score += (commonInterests.length / Math.max(user1.interests.length, user2.interests.length)) * 40;

    // Budget compatibility (35% of score)
    if (user1.userType === 'creator' && user2.userType === 'sponsor') {
        const budgetDiff = Math.abs(user1.pricePoint - user2.pricePoint);
        const maxBudget = Math.max(user1.pricePoint, user2.pricePoint);
        const budgetCompatibility = Math.max(0, 1 - (budgetDiff / maxBudget));
        score += budgetCompatibility * 35;
    } else if (user1.userType === 'sponsor' && user2.userType === 'creator') {
        const budgetDiff = Math.abs(user1.pricePoint - user2.pricePoint);
        const maxBudget = Math.max(user1.pricePoint, user2.pricePoint);
        const budgetCompatibility = Math.max(0, 1 - (budgetDiff / maxBudget));
        score += budgetCompatibility * 35;
    }

    // Platform match (15% of score)
    if (user1.platform.toLowerCase() === user2.platform.toLowerCase()) {
        score += 15;
    }

    // Audience size compatibility (10% of score)
    const audienceDiff = Math.abs(user1.followers - user2.followers);
    const maxAudience = Math.max(user1.followers, user2.followers);
    const audienceCompatibility = Math.max(0, 1 - (audienceDiff / maxAudience));
    score += audienceCompatibility * 10;

    return Math.round(score);
}

// Get recommendations endpoint - requires auth
app.get('/api/recommendations', authenticateToken, async (req, res) => {
    try {
        // Find user's post to get their preferences
        const userPostResult = await pool.query(
            'SELECT * FROM posts WHERE contact_info = $1',
            [req.user.email]
        );

        if (userPostResult.rows.length === 0) {
            return res.status(400).json({ error: 'You need to create a post first' });
        }

        const userPost = {
            ...userPostResult.rows[0],
            userType: userPostResult.rows[0].user_type,
            pricePoint: parseFloat(userPostResult.rows[0].price_point),
            contactInfo: userPostResult.rows[0].contact_info
        };

        // Get opposite user type
        const targetUserType = userPost.userType === 'creator' ? 'sponsor' : 'creator';

        // Get all opposite type posts
        const matchesResult = await pool.query(
            'SELECT * FROM posts WHERE id != $1 AND user_type = $2 ORDER BY created_at DESC',
            [userPost.id, targetUserType]
        );

        // Calculate match scores and format posts
        const matches = matchesResult.rows
            .map(post => {
                const targetPost = {
                    ...post,
                    userType: post.user_type,
                    pricePoint: parseFloat(post.price_point),
                    contactInfo: post.contact_info
                };
                return {
                    ...targetPost,
                    matchScore: calculateMatchScore(userPost, targetPost)
                };
            })
            .sort((a, b) => b.matchScore - a.matchScore)
            .slice(0, 6); // Top 6 matches

        res.json({
            userPost: userPost,
            matches: matches,
            totalMatches: matches.length
        });
    } catch (error) {
        console.error('Recommendations error:', error);
        res.status(500).json({ error: 'Failed to get recommendations' });
    }
});

// Initialize server with data migration
async function startServer() {
    try {
        // Clear database for testing (controlled by environment variable)
        if (process.env.CLEAR_DB_ON_STARTUP !== 'false') {
            await clearDatabase();
        }

        // Run data migration on startup
        await migrateSampleData();

        app.listen(PORT, () => {
            console.log(`🚀 Server running on http://localhost:${PORT}`);
            console.log('💾 Database connected and initialized');
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

startServer();