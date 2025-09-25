const express = require('express');
const cors = require('cors');
const path = require('path');
const dns = require('dns').promises;
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

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

// Load sample data
const sampleData = require('./data.js');

// In-memory storage (for demo purposes)
let users = [...sampleData];
let nextId = users.length + 1;
let registeredUsers = []; // For auth users
let verificationTokens = new Map(); // email -> token
let posts = [...sampleData]; // Rename users to posts for clarity

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

    // Check if email already exists
    if (registeredUsers.find(u => u.email === email)) {
        return res.status(400).json({ error: 'Email already registered' });
    }

    try {
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Generate verification token
        const verificationToken = uuidv4();
        verificationTokens.set(email, verificationToken);

        // Send verification email
        const verificationUrl = `http://localhost:${PORT}/api/auth/verify/${verificationToken}`;

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

        // Store user (unverified)
        const user = {
            id: uuidv4(),
            email,
            password: hashedPassword,
            verified: false,
            createdAt: new Date()
        };

        registeredUsers.push(user);

        res.json({
            success: true,
            message: 'Registration successful! Please check your email to verify your account.'
        });

    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

app.get('/api/auth/verify/:token', (req, res) => {
    const { token } = req.params;

    // Find user by verification token
    const email = [...verificationTokens.entries()].find(([, t]) => t === token)?.[0];

    if (!email) {
        return res.status(400).json({ error: 'Invalid verification token' });
    }

    const user = registeredUsers.find(u => u.email === email);
    if (!user) {
        return res.status(400).json({ error: 'User not found' });
    }

    // Mark as verified
    user.verified = true;
    verificationTokens.delete(email);

    res.json({ success: true, message: 'Email verified successfully!' });
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    const user = registeredUsers.find(u => u.email === email);
    if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.verified) {
        return res.status(401).json({ error: 'Please verify your email first' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
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
});

// Protected post creation - requires auth
app.post('/api/posts', authenticateToken, (req, res) => {
    const { userType, platform, followers, interests, pricePoint, description, contactInfo } = req.body;

    // Enforce contact email must match verified registration email
    if (contactInfo !== req.user.email) {
        return res.status(400).json({
            error: 'Contact email must match your verified registration email'
        });
    }

    // Check if user already has an active post (one per email limitation)
    const existingPost = posts.find(p => p.contactInfo === req.user.email);
    if (existingPost) {
        return res.status(400).json({
            error: 'You already have an active post. Please delete it first to create a new one.'
        });
    }

    const post = {
        id: nextId++,
        userType,
        platform,
        followers: parseInt(followers),
        interests: interests.split(',').map(i => i.trim()),
        pricePoint: parseFloat(pricePoint),
        description,
        contactInfo: req.user.email, // Always use verified email
        userId: req.user.userId,
        verified: true, // All auth users are verified
        createdAt: new Date()
    };

    posts.push(post);
    res.json({ success: true, post });
});

// Delete user's post
app.delete('/api/posts/my-post', authenticateToken, (req, res) => {
    const postIndex = posts.findIndex(p => p.contactInfo === req.user.email);

    if (postIndex === -1) {
        return res.status(404).json({ error: 'No post found' });
    }

    posts.splice(postIndex, 1);
    res.json({ success: true, message: 'Post deleted successfully' });
});

app.get('/api/posts', (req, res) => {
    const { userType, platform, minFollowers, maxFollowers, interests, minPrice, maxPrice } = req.query;

    let filtered = posts.filter(post => {
        if (userType && post.userType !== userType) return false;
        if (platform && post.platform.toLowerCase() !== platform.toLowerCase()) return false;
        if (minFollowers && post.followers < parseInt(minFollowers)) return false;
        if (maxFollowers && post.followers > parseInt(maxFollowers)) return false;
        if (minPrice && post.pricePoint < parseFloat(minPrice)) return false;
        if (maxPrice && post.pricePoint > parseFloat(maxPrice)) return false;
        if (interests) {
            const searchTerms = interests.toLowerCase().split(' ');
            const postText = [
                post.name,
                post.description,
                ...post.interests
            ].join(' ').toLowerCase();

            const hasAllTerms = searchTerms.every(term =>
                term.trim() && postText.includes(term.trim())
            );
            if (!hasAllTerms) return false;
        }

        return true;
    });

    res.json(filtered);
});

// Domain verification endpoints
app.post('/api/verify/domain/start', (req, res) => {
    const { userId, domain } = req.body;

    if (!userId || !domain) {
        return res.status(400).json({ error: 'User ID and domain are required' });
    }

    // Generate verification code
    const verificationCode = 'creator-verify-' + Math.random().toString(36).substring(2, 15);

    // Store verification attempt (in real app, use database)
    const user = users.find(u => u.id === userId);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    user.domainVerification = {
        domain: domain,
        code: verificationCode,
        status: 'pending',
        createdAt: new Date()
    };

    res.json({
        success: true,
        verificationCode,
        instructions: `Add a TXT record to ${domain} with the value: ${verificationCode}`
    });
});

app.post('/api/verify/domain/check', async (req, res) => {
    const { userId } = req.body;

    const user = users.find(u => u.id === userId);
    if (!user || !user.domainVerification) {
        return res.status(404).json({ error: 'No verification in progress' });
    }

    const { domain, code } = user.domainVerification;

    try {
        // Check DNS TXT record
        const txtRecords = await dns.resolveTxt(domain);
        const hasVerificationCode = txtRecords.some(record =>
            record.some(txt => txt.includes(code))
        );

        if (hasVerificationCode) {
            user.domainVerified = true;
            user.verifiedDomain = domain;
            user.domainVerification.status = 'verified';
            user.verified = true;

            res.json({ success: true, message: 'Domain verified successfully!' });
        } else {
            res.json({ success: false, message: 'Verification code not found in DNS records' });
        }
    } catch (error) {
        console.error('DNS verification error:', error);
        res.json({ success: false, message: 'Could not verify domain. Please ensure DNS records are properly set.' });
    }
});

// Report user endpoint
app.post('/api/report', (req, res) => {
    const { userId, reason } = req.body;

    if (!userId || !reason) {
        return res.status(400).json({ error: 'User ID and reason are required' });
    }

    // In a real app, store in database and notify moderators
    console.log(`Report received: User ${userId} reported for: ${reason}`);

    res.json({ success: true, message: 'Report submitted successfully' });
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
app.get('/api/recommendations', authenticateToken, (req, res) => {
    // Find user's post to get their preferences
    const userPost = posts.find(p => p.contactInfo === req.user.email);

    if (!userPost) {
        return res.status(400).json({ error: 'You need to create a post first' });
    }

    // Get opposite user type
    const targetUserType = userPost.userType === 'creator' ? 'sponsor' : 'creator';

    // Calculate match scores with all opposite type posts
    const matches = posts
        .filter(p => p.id !== userPost.id && p.userType === targetUserType)
        .map(targetPost => ({
            ...targetPost,
            matchScore: calculateMatchScore(userPost, targetPost)
        }))
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 6); // Top 6 matches

    res.json({
        userPost: userPost,
        matches: matches,
        totalMatches: matches.length
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});