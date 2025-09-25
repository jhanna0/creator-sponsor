// Global state
let currentUsers = [];
let currentFilters = {
    userType: '',
    platform: '',
    search: '',
    priceRange: ''
};

// Platform icon mapping
const platformIcons = {
    youtube: 'fab fa-youtube',
    instagram: 'fab fa-instagram',
    tiktok: 'fab fa-tiktok',
    twitter: 'fab fa-twitter',
    twitch: 'fab fa-twitch',
    linkedin: 'fab fa-linkedin'
};

// Initialize app
document.addEventListener('DOMContentLoaded', function () {
    // Set up navigation
    setupNavigation();

    // Set up platform filter buttons
    setupPlatformFilters();

    // Load initial data
    loadUsers();

    // Set up modal form submission
    setupModalForm();

    // Show home section by default
    showSection('home');
});

// Navigation management
function setupNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active nav button
            navButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
}

function showSection(sectionId) {
    // Hide all sections
    const sections = document.querySelectorAll('.section');
    sections.forEach(section => section.classList.add('hidden'));

    // Show target section
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.remove('hidden');
    }

    // Load data for specific sections
    if (sectionId === 'creators') {
        displayUsers('creator');
        // Show recommendations for first sponsor (demo)
        const firstSponsor = currentUsers.find(u => u.userType === 'sponsor');
        if (firstSponsor) {
            showRecommendationsForUser(firstSponsor.id, 'sponsor');
        }
    } else if (sectionId === 'sponsors') {
        displayUsers('sponsor');
        // Show recommendations for first creator (demo)
        const firstCreator = currentUsers.find(u => u.userType === 'creator');
        if (firstCreator) {
            showRecommendationsForUser(firstCreator.id, 'creator');
        }
    }

    // Hide messages
    hideMessages();
}

// Platform filter setup
function setupPlatformFilters() {
    const platformBtns = document.querySelectorAll('.platform-btn');
    platformBtns.forEach(btn => {
        btn.addEventListener('click', async () => {
            // Update active platform button
            platformBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update filter and reload data
            currentFilters.platform = btn.dataset.platform === 'all' ? '' : btn.dataset.platform;

            // Apply filters with API call
            await applyFilters();
        });
    });
}

// Load users from API with current filters
async function loadUsers() {
    try {
        // Build query parameters from current filters
        const params = new URLSearchParams();

        if (currentFilters.platform) {
            params.append('platform', currentFilters.platform);
        }
        if (currentFilters.search) {
            params.append('interests', currentFilters.search);
        }
        if (currentFilters.priceRange) {
            const [min, max] = currentFilters.priceRange.split('-');
            if (min) params.append('minPrice', min);
            if (max && max !== '+') params.append('maxPrice', max.replace('+', ''));
        }

        const url = `/api/posts${params.toString() ? '?' + params.toString() : ''}`;
        const response = await fetch(url);
        const posts = await response.json();
        currentUsers = posts;
        return posts;
    } catch (error) {
        console.error('Failed to load posts:', error);
        showMessage('error', 'Failed to load posts');
        return [];
    }
}

// Display users in grid
function displayUsers(userType = '') {
    const gridId = userType === 'creator' ? 'creatorsGrid' : 'sponsorsGrid';
    const grid = document.getElementById(gridId);

    if (!grid) return;

    // Filter by userType only (API handles other filters)
    let filteredUsers = currentUsers.filter(user => {
        if (userType && user.userType !== userType) return false;
        return true;
    });

    // Display users
    if (filteredUsers.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 4rem; color: var(--gray-600);">
                <i class="fas fa-search" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                <h3>No ${userType}s found</h3>
                <p>Try adjusting your search criteria or check back later.</p>
            </div>
        `;
        return;
    }

    const cardsHTML = filteredUsers.map(user => createUserCard(user)).join('');
    grid.innerHTML = cardsHTML;
}

// Create user card HTML
function createUserCard(user) {
    const platformIcon = platformIcons[user.platform.toLowerCase()] || 'fas fa-globe';
    const typeClass = user.userType === 'sponsor' ? 'sponsor' : 'creator';

    // Format the creation date
    const createdDate = new Date(user.createdAt);
    const timeAgo = formatTimeAgo(createdDate);

    return `
        <div class="card" onclick="showUserDetails(${user.id})">
            <div class="type-badge ${typeClass}">${user.userType}</div>

            <div class="card-header">
                <div class="card-avatar">${user.avatar}</div>
                <div class="card-info">
                    <h3>${user.name}</h3>
                    <div class="card-platform">
                        <i class="${platformIcon}"></i>
                        ${user.platform}
                        ${user.verified ? '<i class="fas fa-check-circle" style="color: var(--accent-blue); margin-left: 0.5rem;"></i>' : ''}
                    </div>
                </div>
            </div>

            <div class="card-stats">
                <div class="stat-item">
                    <div class="value">${formatNumber(user.followers)}</div>
                    <div class="label">${user.userType === 'creator' ? 'Followers' : 'Target Audience'}</div>
                </div>
                <div class="stat-item">
                    <div class="value">$${user.pricePoint}</div>
                    <div class="label">${user.userType === 'creator' ? 'Per Post' : 'Budget'}</div>
                </div>
            </div>

            <div class="card-description">${user.description}</div>

            <div class="card-tags">
                ${user.interests.slice(0, 4).map(interest => `<span class="tag">${interest}</span>`).join('')}
            </div>

            <div class="card-date">
                <i class="fas fa-clock"></i> Posted ${timeAgo}
            </div>

            <div class="card-contact">
                <button class="contact-btn" onclick="event.stopPropagation(); showContactModal(${user.id})">
                    <i class="fas fa-envelope"></i>
                    Contact ${user.userType === 'creator' ? 'Creator' : 'Sponsor'}
                </button>
                <button class="report-btn" onclick="event.stopPropagation(); showReportModal(${user.id})" title="Report this profile">
                    <i class="fas fa-flag"></i>
                </button>
            </div>
        </div>
    `;
}

// Format number for display
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(0) + 'K';
    }
    return num.toString();
}

// Format time ago
function formatTimeAgo(date) {
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffTime / (1000 * 60));

    if (diffDays > 30) {
        return date.toLocaleDateString();
    } else if (diffDays > 0) {
        return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
        return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffMinutes > 0) {
        return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    } else {
        return 'Just now';
    }
}

// Show user details modal
function showUserDetails(userId) {
    const user = currentUsers.find(u => u.id === userId);
    if (!user) return;

    const modal = document.getElementById('userDetailsModal');

    // Populate modal with user details
    document.getElementById('detailsUserName').textContent = user.name;
    document.getElementById('detailsUserType').textContent = user.userType;
    document.getElementById('detailsUserType').className = `detail-badge ${user.userType}`;
    document.getElementById('detailsPlatform').innerHTML = `
        <i class="${platformIcons[user.platform.toLowerCase()] || 'fas fa-globe'}"></i>
        ${user.platform}
        ${user.verified ? '<i class="fas fa-check-circle" style="color: var(--accent-blue); margin-left: 0.5rem;"></i>' : ''}
    `;
    document.getElementById('detailsFollowers').textContent = formatNumber(user.followers);
    document.getElementById('detailsPricePoint').textContent = `$${user.pricePoint}`;
    document.getElementById('detailsDescription').textContent = user.description;
    document.getElementById('detailsInterests').innerHTML = user.interests.map(interest =>
        `<span class="tag">${interest}</span>`
    ).join('');
    document.getElementById('detailsCreatedAt').textContent = formatTimeAgo(new Date(user.createdAt));

    // Store user ID for modal actions
    modal.dataset.userId = userId;

    modal.classList.remove('hidden');
}

function closeUserDetailsModal() {
    const modal = document.getElementById('userDetailsModal');
    modal.classList.add('hidden');
}

// Apply filters with API call
async function applyFilters() {
    // Get filter values
    currentFilters.search = document.getElementById('searchInput').value.trim();
    currentFilters.priceRange = document.getElementById('priceRange').value;

    // Load filtered users from API
    await loadUsers();

    // Re-display current section with fresh data
    const activeSection = document.querySelector('.section:not(.hidden)');
    if (activeSection) {
        if (activeSection.id === 'creators') {
            displayUsers('creator');
        } else if (activeSection.id === 'sponsors') {
            displayUsers('sponsor');
        }
    }
}

// Auth state
let currentUser = null;
let authToken = localStorage.getItem('authToken');

// Check auth status on load
document.addEventListener('DOMContentLoaded', function () {
    checkAuthStatus();
});

async function checkAuthStatus() {
    if (authToken) {
        // TODO: Validate token with server
        // For now, just assume valid if exists
        currentUser = JSON.parse(localStorage.getItem('userData') || '{}');
        updateUIForAuth();
    }
}

function updateUIForAuth() {
    const authButtons = document.querySelector('.auth-buttons');
    const userMenu = document.querySelector('.user-menu');

    if (currentUser && authToken) {
        authButtons?.classList.add('hidden');
        if (userMenu) {
            userMenu.classList.remove('hidden');
            document.getElementById('userEmail').textContent = currentUser.email;
        }
    } else {
        authButtons?.classList.remove('hidden');
        userMenu?.classList.add('hidden');
    }
}

// Registration modal - now shows auth form
function showRegistration(userType) {
    const modal = document.getElementById('registrationModal');
    const modalTitle = document.getElementById('modalTitle');
    const formFields = document.getElementById('formFields');

    // Handle auth-only buttons (login/signup from header)
    if (userType === 'login' || userType === 'signup') {
        modalTitle.textContent = 'Sign Up / Login';
        formFields.innerHTML = `
            <div class="auth-tabs">
                <button type="button" class="auth-tab ${userType === 'signup' ? 'active' : ''}" onclick="showAuthTab('signup')">Sign Up</button>
                <button type="button" class="auth-tab ${userType === 'login' ? 'active' : ''}" onclick="showAuthTab('login')">Login</button>
            </div>
            <div id="signupForm" class="auth-form ${userType === 'login' ? 'hidden' : ''}">
                <div class="form-group">
                    <label for="signupEmail">Email</label>
                    <input type="email" id="signupEmail">
                </div>
                <div class="form-group">
                    <label for="signupPassword">Password</label>
                    <input type="password" id="signupPassword">
                </div>
            </div>
            <div id="loginForm" class="auth-form ${userType === 'signup' ? 'hidden' : ''}">
                <div class="form-group">
                    <label for="loginEmail">Email</label>
                    <input type="email" id="loginEmail">
                </div>
                <div class="form-group">
                    <label for="loginPassword">Password</label>
                    <input type="password" id="loginPassword">
                </div>
            </div>
        `;
        modal.dataset.step = 'auth';
        modal.dataset.userType = 'creator'; // Default for post creation later
    } else if (!currentUser) {
        // Show signup/login form first for post creation
        modalTitle.textContent = 'Sign Up / Login';
        formFields.innerHTML = `
            <div class="auth-tabs">
                <button type="button" class="auth-tab active" onclick="showAuthTab('signup')">Sign Up</button>
                <button type="button" class="auth-tab" onclick="showAuthTab('login')">Login</button>
            </div>
            <div id="signupForm" class="auth-form">
                <div class="form-group">
                    <label for="signupEmail">Email</label>
                    <input type="email" id="signupEmail">
                </div>
                <div class="form-group">
                    <label for="signupPassword">Password</label>
                    <input type="password" id="signupPassword">
                </div>
            </div>
            <div id="loginForm" class="auth-form hidden">
                <div class="form-group">
                    <label for="loginEmail">Email</label>
                    <input type="email" id="loginEmail">
                </div>
                <div class="form-group">
                    <label for="loginPassword">Password</label>
                    <input type="password" id="loginPassword">
                </div>
            </div>
        `;
        modal.dataset.step = 'auth';
        modal.dataset.userType = userType;
    } else {
        // User is logged in, show post creation form
        showPostForm(userType);
    }

    modal.classList.remove('hidden');
}

function showAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.add('hidden'));

    document.querySelector(`[onclick="showAuthTab('${tab}')"]`).classList.add('active');
    document.getElementById(`${tab}Form`).classList.remove('hidden');
}

function showPostForm(userType) {
    const modal = document.getElementById('registrationModal');
    const modalTitle = document.getElementById('modalTitle');
    const formFields = document.getElementById('formFields');

    modalTitle.textContent = `Create ${userType === 'creator' ? 'Creator' : 'Sponsor'} Post`;

    // Generate form fields
    const fields = getFormFields(userType);
    formFields.innerHTML = fields;

    // Store user type for form submission
    modal.dataset.userType = userType;
    modal.dataset.step = 'post';
}

function closeModal() {
    const modal = document.getElementById('registrationModal');
    modal.classList.add('hidden');

    // Reset form
    const form = document.getElementById('registrationForm');
    form.reset();
}

function getFormFields(userType) {
    const isCreator = userType === 'creator';

    return `
        <div class="form-group">
            <label for="regName">${isCreator ? 'Creator/Channel Name' : 'Business Name'}</label>
            <input type="text" id="regName" name="name" required placeholder="Enter your ${isCreator ? 'creator' : 'business'} name">
        </div>

        <div class="form-group">
            <label for="regPlatform">Primary Platform</label>
            <select id="regPlatform" name="platform" required>
                <option value="">Select Platform</option>
                <option value="youtube">YouTube</option>
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
                <option value="twitter">Twitter</option>
                <option value="twitch">Twitch</option>
                <option value="linkedin">LinkedIn</option>
            </select>
        </div>

        <div class="form-group">
            <label for="regFollowers">${isCreator ? 'Follower Count' : 'Target Audience Size'}</label>
            <input type="number" id="regFollowers" name="followers" required placeholder="${isCreator ? 'Your current followers' : 'Minimum audience size you want'}">
        </div>

        <div class="form-group">
            <label for="regInterests">${isCreator ? 'Content Categories' : 'Business Categories'}</label>
            <input type="text" id="regInterests" name="interests" required placeholder="e.g. gaming, lifestyle, tech">
        </div>

        <div class="form-group">
            <label for="regPrice">${isCreator ? 'Rate per sponsored post ($)' : 'Budget per post ($)'}</label>
            <input type="number" id="regPrice" name="pricePoint" required step="0.01" placeholder="Enter your ${isCreator ? 'rate' : 'budget'}">
        </div>

        <div class="form-group">
            <label for="regDescription">${isCreator ? 'Bio/Description' : 'Business Description'}</label>
            <textarea id="regDescription" name="description" required placeholder="${isCreator ? 'Tell sponsors about your audience and content style...' : 'Describe your business and what you want to promote...'}"></textarea>
        </div>

        <div class="form-group">
            <label for="regContact">Contact Email (must match your account email)</label>
            <input type="email" id="regContact" name="contactInfo" required readonly value="${currentUser?.email || ''}" placeholder="Your verified email will be used">
            <small>This will be automatically set to your verified email address</small>
        </div>
    `;
}

// Setup modal form submission
function setupModalForm() {
    const form = document.getElementById('registrationForm');
    console.log('Setting up modal form:', form);

    if (!form) {
        console.error('Registration form not found!');
        return;
    }

    form.addEventListener('submit', async (e) => {
        console.log('Form submit event triggered!');
        e.preventDefault();
        console.log('Form submitted!');

        const modal = document.getElementById('registrationModal');
        const step = modal.dataset.step;
        console.log('Modal step:', step);

        if (step === 'auth') {
            console.log('Calling handleAuth...');
            await handleAuth();
        } else if (step === 'post') {
            console.log('Calling handlePostCreation...');
            await handlePostCreation();
        } else {
            console.error('Unknown step:', step);
        }
    });
}

async function handleAuth() {
    console.log('handleAuth called');
    const modal = document.getElementById('registrationModal');
    const isSignup = !document.getElementById('signupForm').classList.contains('hidden');
    console.log('Is signup:', isSignup);

    let email, password;
    if (isSignup) {
        const emailEl = document.getElementById('signupEmail');
        const passwordEl = document.getElementById('signupPassword');
        console.log('Signup elements:', emailEl, passwordEl);
        email = emailEl ? emailEl.value : '';
        password = passwordEl ? passwordEl.value : '';
    } else {
        const emailEl = document.getElementById('loginEmail');
        const passwordEl = document.getElementById('loginPassword');
        console.log('Login elements:', emailEl, passwordEl);
        email = emailEl ? emailEl.value : '';
        password = passwordEl ? passwordEl.value : '';
    }

    console.log('Email:', email, 'Password length:', password ? password.length : 0);

    // Manual validation
    if (!email || !password) {
        showMessage('error', 'Please fill in all fields');
        return;
    }

    if (!email.includes('@')) {
        showMessage('error', 'Please enter a valid email address');
        return;
    }

    if (password.length < 6) {
        showMessage('error', 'Password must be at least 6 characters long');
        return;
    }

    try {
        const endpoint = isSignup ? '/api/auth/signup' : '/api/auth/login';
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const result = await response.json();

        if (result.success) {
            if (isSignup) {
                showMessage('success', result.message);
                // Show verification instructions
                showVerificationInstructions();
                showAuthTab('login');
            } else {
                // Login successful
                authToken = result.token;
                currentUser = result.user;
                localStorage.setItem('authToken', authToken);
                localStorage.setItem('userData', JSON.stringify(currentUser));

                updateUIForAuth();
                showMessage('success', 'Login successful!');

                // Now show post creation form
                const userType = modal.dataset.userType;
                showPostForm(userType);
            }
        } else {
            showMessage('error', result.error || 'Authentication failed');
        }
    } catch (error) {
        showMessage('error', 'Network error. Please try again.');
    }
}

async function showVerificationInstructions() {
    const modal = document.getElementById('registrationModal');
    const formFields = document.getElementById('formFields');

    // Get the verification link for the user
    const email = document.getElementById('signupEmail').value;
    let verificationLink = '';

    try {
        const response = await fetch(`/api/dev/verification-link/${encodeURIComponent(email)}`);
        const result = await response.json();
        if (result.success) {
            verificationLink = result.verificationUrl;
        }
    } catch (error) {
        console.log('Could not get verification link:', error);
    }

    formFields.innerHTML = `
        <div class="verification-instructions">
            <div class="verification-icon">
                <i class="fas fa-envelope-open"></i>
            </div>
            <h3>Check Your Email!</h3>
            <p>We've sent you a verification link. Please check your email and click the link to verify your account.</p>
            <div class="verification-note">
                <strong>Development Mode:</strong> Since this is a test environment, the verification email is sent to a test service.
                ${verificationLink ? `
                    <br><br>
                    <strong>Verification Link:</strong><br>
                    <a href="${verificationLink}" target="_blank" class="verification-link">${verificationLink}</a>
                ` : ''}
                <br><br>
                <button type="button" class="btn btn-outline" onclick="skipVerification()">
                    <i class="fas fa-fast-forward"></i>
                    Skip Verification (Dev Only)
                </button>
            </div>
            <div class="verification-actions">
                <button type="button" class="btn btn-primary" onclick="showAuthTab('login')">
                    <i class="fas fa-sign-in-alt"></i>
                    Go to Login
                </button>
            </div>
        </div>
    `;
}

function skipVerification() {
    showMessage('success', 'Verification skipped (development mode)');
    showAuthTab('login');
}

async function handlePostCreation() {
    const modal = document.getElementById('registrationModal');
    const userType = modal.dataset.userType;

    // Get form data
    const formData = new FormData(document.getElementById('registrationForm'));
    const data = {
        userType: userType,
        name: formData.get('name'),
        platform: formData.get('platform'),
        followers: parseInt(formData.get('followers')),
        interests: formData.get('interests'),
        pricePoint: parseFloat(formData.get('pricePoint')),
        description: formData.get('description'),
        contactInfo: currentUser.email // Always use verified email
    };

    try {
        const response = await fetch('/api/posts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
            showMessage('success', 'Post created successfully!');
            closeModal();

            // Reload posts and refresh current view
            await loadUsers();
            const activeSection = document.querySelector('.section:not(.hidden)');
            if (activeSection && (activeSection.id === 'creators' || activeSection.id === 'sponsors')) {
                const sectionType = activeSection.id === 'creators' ? 'creator' : 'sponsor';
                displayUsers(sectionType);
            }

            // Go to appropriate section
            setTimeout(() => {
                showSection(userType === 'creator' ? 'creators' : 'sponsors');

                // Update nav
                const navButtons = document.querySelectorAll('.nav-btn');
                navButtons.forEach(btn => btn.classList.remove('active'));
                const targetNav = document.querySelector(`[data-section="${userType}s"]`);
                if (targetNav) targetNav.classList.add('active');
            }, 1000);

        } else {
            showMessage('error', result.error || 'Failed to create post');
        }
    } catch (error) {
        showMessage('error', 'Network error. Please try again.');
    }
}

// Get random avatar for new users
function getRandomAvatar(userType) {
    const creatorAvatars = ['🎬', '📸', '🎨', '🎵', '📝', '🎭', '🎪', '🌟', '💫', '🚀'];
    const sponsorAvatars = ['💼', '🏢', '🛍️', '📱', '💻', '🎯', '💡', '🔥', '⚡', '🎊'];

    const avatars = userType === 'creator' ? creatorAvatars : sponsorAvatars;
    return avatars[Math.floor(Math.random() * avatars.length)];
}

// Logout function
function logout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    updateUIForAuth();
    showMessage('success', 'Logged out successfully');
    showSection('home');
}

// Message system
function showMessage(type, text) {
    hideMessages();

    const messageElement = document.getElementById(type + 'Message');
    if (messageElement) {
        if (text) {
            const textElement = messageElement.querySelector('span') || messageElement;
            textElement.textContent = text;
        }
        messageElement.classList.remove('hidden');

        // Auto hide after 5 seconds
        setTimeout(() => {
            messageElement.classList.add('hidden');
        }, 5000);
    }
}

function hideMessages() {
    document.getElementById('successMessage').classList.add('hidden');
    document.getElementById('errorMessage').classList.add('hidden');
}

// Real-time search
document.addEventListener('DOMContentLoaded', function () {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(applyFilters, 300));
    }

    const priceRange = document.getElementById('priceRange');
    if (priceRange) {
        priceRange.addEventListener('change', applyFilters);
    }
});

// Utility: Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Recommendations functionality
async function loadRecommendations() {
    if (!authToken) return null;

    try {
        const response = await fetch('/api/recommendations', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Failed to load recommendations:', error);
        return null;
    }
}

function displayRecommendations(recommendations, userType) {
    const sectionId = userType === 'creator' ? 'recommendedSection' : 'recommendedSponsorsSection';
    const gridId = userType === 'creator' ? 'recommendedGrid' : 'recommendedSponsorsGrid';

    const section = document.getElementById(sectionId);
    const grid = document.getElementById(gridId);

    if (!recommendations || !recommendations.matches || recommendations.matches.length === 0) {
        section.classList.add('hidden');
        return;
    }

    // Create cards with match scores
    const cardsHTML = recommendations.matches.map(match => {
        const card = createUserCard(match);
        // Add match score badge
        const matchBadge = `<div class="match-score">${match.matchScore}% Match</div>`;
        return card.replace('<div class="type-badge', matchBadge + '<div class="type-badge');
    }).join('');

    grid.innerHTML = cardsHTML;
    section.classList.remove('hidden');
}

// Show recommendations for current user (demo - in real app you'd have user authentication)
async function showRecommendationsForUser(userId, userType) {
    const recommendations = await loadRecommendations(userId);
    if (recommendations) {
        displayRecommendations(recommendations, userType === 'creator' ? 'sponsor' : 'creator');
    }
}

// Function to show all users (hide recommendations)
function showAllUsers() {
    document.getElementById('recommendedSection').classList.add('hidden');
    document.getElementById('recommendedSponsorsSection').classList.add('hidden');
}

// Contact modal functionality
function showContactModal(userId) {
    const user = currentUsers.find(u => u.id === userId);
    if (!user) return;

    const modal = document.getElementById('contactModal');
    const userName = document.getElementById('contactUserName');
    const captchaQuestion = document.getElementById('captchaQuestion');
    const captchaInput = document.getElementById('captchaInput');

    userName.textContent = user.name;

    // Generate simple math captcha
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    const answer = num1 + num2;

    captchaQuestion.textContent = `What is ${num1} + ${num2}?`;
    captchaInput.dataset.answer = answer;
    captchaInput.value = '';

    // Store user data for reveal
    modal.dataset.userId = userId;
    modal.dataset.contactInfo = user.contactInfo;

    modal.classList.remove('hidden');
}

function closeContactModal() {
    const modal = document.getElementById('contactModal');
    modal.classList.add('hidden');
    document.getElementById('captchaInput').value = '';
    document.getElementById('contactError').classList.add('hidden');
}

function verifyCaptchaAndShowContact() {
    const modal = document.getElementById('contactModal');
    const captchaInput = document.getElementById('captchaInput');
    const correctAnswer = parseInt(captchaInput.dataset.answer);
    const userAnswer = parseInt(captchaInput.value);
    const contactError = document.getElementById('contactError');

    if (userAnswer !== correctAnswer) {
        contactError.classList.remove('hidden');
        captchaInput.value = '';
        return;
    }

    // Show contact info
    const contactInfo = modal.dataset.contactInfo;
    const contactReveal = document.getElementById('contactReveal');
    contactReveal.innerHTML = `
        <div class="contact-success">
            <i class="fas fa-check-circle"></i>
            <h4>Contact Information</h4>
            <p class="contact-info">${contactInfo}</p>
            <p class="contact-note">
                <i class="fas fa-info-circle"></i>
                Please verify this creator/sponsor owns the contact information before proceeding.
            </p>
        </div>
    `;
    contactReveal.classList.remove('hidden');

    // Hide form
    document.querySelector('.captcha-form').classList.add('hidden');
}

// Report functionality
async function reportUser(userId, reason = '') {
    const user = currentUsers.find(u => u.id === userId);
    if (!user) return;

    try {
        const response = await fetch('/api/report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, reason })
        });

        const result = await response.json();

        if (result.success) {
            showMessage('success', 'Thank you for your report. We will investigate this profile.');
        } else {
            showMessage('error', 'Failed to submit report. Please try again.');
        }
    } catch (error) {
        console.error('Report error:', error);
        showMessage('error', 'Network error. Please try again.');
    }
}

function showReportModal(userId) {
    const modal = document.getElementById('reportModal');
    const user = currentUsers.find(u => u.id === userId);

    if (!user) return;

    document.getElementById('reportUserName').textContent = user.name;
    modal.dataset.userId = userId;
    modal.classList.remove('hidden');
}

function closeReportModal() {
    const modal = document.getElementById('reportModal');
    modal.classList.add('hidden');
    document.getElementById('reportReason').value = '';
}

function submitReport() {
    const modal = document.getElementById('reportModal');
    const userId = parseInt(modal.dataset.userId);
    const reason = document.getElementById('reportReason').value.trim();

    if (!reason) {
        showMessage('error', 'Please provide a reason for reporting.');
        return;
    }

    reportUser(userId, reason);
    closeReportModal();
}

// Report functions
function showReportModal(userId) {
    const modal = document.getElementById('reportModal');
    const userName = document.getElementById('reportUserName');

    // Find the user name from the current users array
    const user = currentUsers.find(u => u.id === userId);
    userName.textContent = user ? user.name : 'User';

    modal.dataset.userId = userId;
    modal.classList.remove('hidden');
}

function closeReportModal() {
    document.getElementById('reportModal').classList.add('hidden');
}

async function submitReport() {
    const modal = document.getElementById('reportModal');
    const userId = parseInt(modal.dataset.userId);
    const reason = document.getElementById('reportReason').value;

    if (!reason) {
        showMessage('error', 'Please select a reason for reporting');
        return;
    }

    try {
        const response = await fetch('/api/report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, reason })
        });

        const result = await response.json();

        if (result.success) {
            showMessage('success', 'Report submitted successfully. Thank you for helping keep our community safe.');
            closeReportModal();
        } else {
            showMessage('error', result.error || 'Failed to submit report');
        }
    } catch (error) {
        showMessage('error', 'Network error. Please try again.');
    }
}