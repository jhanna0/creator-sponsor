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
document.addEventListener('DOMContentLoaded', function() {
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

        const url = `/api/users${params.toString() ? '?' + params.toString() : ''}`;
        const response = await fetch(url);
        const users = await response.json();
        currentUsers = users;
        return users;
    } catch (error) {
        console.error('Failed to load users:', error);
        showMessage('error', 'Failed to load users');
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

    return `
        <div class="card">
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
                ${user.interests.map(interest => `<span class="tag">${interest}</span>`).join('')}
            </div>

            <div class="card-contact">
                <button class="contact-btn" onclick="showContactModal(${user.id})">
                    <i class="fas fa-envelope"></i>
                    Contact ${user.userType === 'creator' ? 'Creator' : 'Sponsor'}
                </button>
                ${!user.verified && user.userType === 'creator' ? `
                    <button class="verify-btn" onclick="showVerificationModal(${user.id})" title="Verify your domain">
                        <i class="fas fa-shield-alt"></i>
                    </button>
                ` : ''}
                <button class="report-btn" onclick="showReportModal(${user.id})" title="Report this profile">
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

// Registration modal
function showRegistration(userType) {
    const modal = document.getElementById('registrationModal');
    const modalTitle = document.getElementById('modalTitle');
    const formFields = document.getElementById('formFields');

    modalTitle.textContent = `Join as ${userType === 'creator' ? 'Creator' : 'Sponsor'}`;

    // Generate form fields
    const fields = getFormFields(userType);
    formFields.innerHTML = fields;

    // Store user type for form submission
    modal.dataset.userType = userType;

    // Show modal
    modal.classList.remove('hidden');
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
            <label for="regContact">Contact Information</label>
            <input type="text" id="regContact" name="contactInfo" required placeholder="Email or preferred contact method">
        </div>
    `;
}

// Setup modal form submission
function setupModalForm() {
    const form = document.getElementById('registrationForm');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const modal = document.getElementById('registrationModal');
        const userType = modal.dataset.userType;

        // Get form data
        const formData = new FormData(form);
        const data = {
            userType: userType,
            name: formData.get('name'),
            platform: formData.get('platform'),
            followers: parseInt(formData.get('followers')),
            interests: formData.get('interests').split(',').map(i => i.trim()),
            pricePoint: parseFloat(formData.get('pricePoint')),
            description: formData.get('description'),
            contactInfo: formData.get('contactInfo'),
            avatar: getRandomAvatar(userType),
            verified: false
        };

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                const result = await response.json();
                showMessage('success', 'Registration successful! Welcome to CreatorBridge.');
                closeModal();

                // Reload users and refresh current view
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
                throw new Error('Registration failed');
            }
        } catch (error) {
            showMessage('error', 'Registration failed. Please try again.');
        }
    });
}

// Get random avatar for new users
function getRandomAvatar(userType) {
    const creatorAvatars = ['🎬', '📸', '🎨', '🎵', '📝', '🎭', '🎪', '🌟', '💫', '🚀'];
    const sponsorAvatars = ['💼', '🏢', '🛍️', '📱', '💻', '🎯', '💡', '🔥', '⚡', '🎊'];

    const avatars = userType === 'creator' ? creatorAvatars : sponsorAvatars;
    return avatars[Math.floor(Math.random() * avatars.length)];
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
document.addEventListener('DOMContentLoaded', function() {
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
async function loadRecommendations(userId) {
    try {
        const response = await fetch(`/api/recommendations/${userId}`);
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

// Verification functions
function showVerificationModal(userId) {
    const modal = document.getElementById('verificationModal');
    modal.dataset.userId = userId;
    modal.classList.remove('hidden');
    // Reset state
    document.querySelectorAll('.verification-method').forEach(m => m.classList.add('hidden'));
    document.querySelectorAll('.verification-option').forEach(o => o.classList.remove('selected'));
}

function selectVerificationMethod(method) {
    // Hide all methods
    document.querySelectorAll('.verification-method').forEach(m => m.classList.add('hidden'));
    document.querySelectorAll('.verification-option').forEach(o => o.classList.remove('selected'));

    // Show selected method
    if (method === 'social') {
        document.getElementById('socialVerification').classList.remove('hidden');
        document.querySelector('.verification-option').classList.add('selected');
    } else if (method === 'domain') {
        document.getElementById('domainVerification').classList.remove('hidden');
        document.querySelectorAll('.verification-option')[1].classList.add('selected');
    }
}

function closeVerificationModal() {
    const modal = document.getElementById('verificationModal');
    modal.classList.add('hidden');
    document.getElementById('domainInput').value = '';
    document.getElementById('verificationInstructions').classList.add('hidden');
    document.getElementById('domainForm').classList.remove('hidden');
}

async function startDomainVerification() {
    const modal = document.getElementById('verificationModal');
    const userId = parseInt(modal.dataset.userId);
    const domain = document.getElementById('domainInput').value.trim();

    if (!domain) {
        showMessage('error', 'Please enter a domain name');
        return;
    }

    try {
        const response = await fetch('/api/verify/domain/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, domain })
        });

        const result = await response.json();

        if (result.success) {
            // Show instructions
            document.getElementById('domainForm').classList.add('hidden');
            const instructions = document.getElementById('verificationInstructions');
            instructions.innerHTML = `
                <div class="verification-steps">
                    <h4><i class="fas fa-list-ol"></i> Verification Steps</h4>
                    <ol>
                        <li>Go to your DNS provider (where you manage ${domain})</li>
                        <li>Add a new TXT record with these details:</li>
                    </ol>
                    <div class="dns-record">
                        <strong>Type:</strong> TXT<br>
                        <strong>Name:</strong> @ (or leave blank)<br>
                        <strong>Value:</strong> <code>${result.verificationCode}</code>
                    </div>
                    <p><i class="fas fa-info-circle"></i> DNS changes may take up to 10 minutes to propagate.</p>
                    <button class="btn btn-primary" onclick="checkDomainVerification()">
                        <i class="fas fa-check"></i> Check Verification
                    </button>
                    <button class="btn btn-outline" onclick="closeVerificationModal()">Cancel</button>
                </div>
            `;
            instructions.classList.remove('hidden');
        } else {
            showMessage('error', result.error || 'Failed to start verification');
        }
    } catch (error) {
        showMessage('error', 'Network error. Please try again.');
    }
}

async function checkDomainVerification() {
    const modal = document.getElementById('verificationModal');
    const userId = parseInt(modal.dataset.userId);

    try {
        const response = await fetch('/api/verify/domain/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        });

        const result = await response.json();

        if (result.success) {
            showMessage('success', 'Domain verified successfully! Your profile is now verified.');
            closeVerificationModal();
            // Reload users to show updated verification status
            await loadUsers();
            const activeSection = document.querySelector('.section:not(.hidden)');
            if (activeSection && (activeSection.id === 'creators' || activeSection.id === 'sponsors')) {
                const sectionType = activeSection.id === 'creators' ? 'creator' : 'sponsor';
                displayUsers(sectionType);
            }
        } else {
            showMessage('error', result.message || 'Verification failed');
        }
    } catch (error) {
        showMessage('error', 'Network error. Please try again.');
    }
}