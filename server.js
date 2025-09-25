const express = require('express');
const cors = require('cors');
const path = require('path');
const dns = require('dns').promises;

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Load sample data
const sampleData = require('./data.js');

// In-memory storage (for demo purposes)
let users = [...sampleData];
let nextId = users.length + 1;

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API Routes
app.post('/api/register', (req, res) => {
    const { userType, platform, followers, interests, pricePoint, description, contactInfo } = req.body;

    const user = {
        id: nextId++,
        userType,
        platform,
        followers: parseInt(followers),
        interests: interests.split(',').map(i => i.trim()),
        pricePoint: parseFloat(pricePoint),
        description,
        contactInfo,
        createdAt: new Date()
    };

    users.push(user);
    res.json({ success: true, user });
});

app.get('/api/users', (req, res) => {
    const { userType, platform, minFollowers, maxFollowers, interests, minPrice, maxPrice } = req.query;

    let filtered = users.filter(user => {
        if (userType && user.userType !== userType) return false;
        if (platform && user.platform.toLowerCase() !== platform.toLowerCase()) return false;
        if (minFollowers && user.followers < parseInt(minFollowers)) return false;
        if (maxFollowers && user.followers > parseInt(maxFollowers)) return false;
        if (minPrice && user.pricePoint < parseFloat(minPrice)) return false;
        if (maxPrice && user.pricePoint > parseFloat(maxPrice)) return false;
        if (interests) {
            const searchTerms = interests.toLowerCase().split(' ');
            const userText = [
                user.name,
                user.description,
                ...user.interests
            ].join(' ').toLowerCase();

            const hasAllTerms = searchTerms.every(term =>
                term.trim() && userText.includes(term.trim())
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

// Get recommendations endpoint
app.get('/api/recommendations/:userId', (req, res) => {
    const userId = parseInt(req.params.userId);
    const user = users.find(u => u.id === userId);

    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    // Get opposite user type
    const targetUserType = user.userType === 'creator' ? 'sponsor' : 'creator';

    // Calculate match scores with all opposite type users
    const matches = users
        .filter(u => u.id !== userId && u.userType === targetUserType)
        .map(targetUser => ({
            ...targetUser,
            matchScore: calculateMatchScore(user, targetUser)
        }))
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 6); // Top 6 matches

    res.json({
        user: user,
        matches: matches,
        totalMatches: matches.length
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});