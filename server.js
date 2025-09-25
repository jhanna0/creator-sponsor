const express = require('express');
const cors = require('cors');
const path = require('path');

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
    const { userType, platform, minFollowers, maxFollowers, interests, maxPrice } = req.query;

    let filtered = users.filter(user => {
        if (userType && user.userType !== userType) return false;
        if (platform && user.platform !== platform) return false;
        if (minFollowers && user.followers < parseInt(minFollowers)) return false;
        if (maxFollowers && user.followers > parseInt(maxFollowers)) return false;
        if (maxPrice && user.pricePoint > parseFloat(maxPrice)) return false;
        if (interests && !user.interests.some(interest =>
            interest.toLowerCase().includes(interests.toLowerCase())
        )) return false;

        return true;
    });

    res.json(filtered);
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});