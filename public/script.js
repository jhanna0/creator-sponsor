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
    } else if (sectionId === 'sponsors') {
        displayUsers('sponsor');
    }

    // Hide messages
    hideMessages();
}

// Platform filter setup
function setupPlatformFilters() {
    const platformBtns = document.querySelectorAll('.platform-btn');
    platformBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active platform button
            platformBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update filter
            currentFilters.platform = btn.dataset.platform === 'all' ? '' : btn.dataset.platform;
        });
    });
}

// Load users from API
async function loadUsers() {
    try {
        const response = await fetch('/api/users');
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

    // Filter users
    let filteredUsers = currentUsers.filter(user => {
        if (userType && user.userType !== userType) return false;
        if (currentFilters.platform && user.platform.toLowerCase() !== currentFilters.platform) return false;
        if (currentFilters.search) {
            const search = currentFilters.search.toLowerCase();
            const searchFields = [
                user.name,
                user.description,
                user.interests.join(' ')
            ].join(' ').toLowerCase();
            if (!searchFields.includes(search)) return false;
        }
        if (currentFilters.priceRange) {
            const price = user.pricePoint;
            const [min, max] = currentFilters.priceRange.split('-').map(p => parseInt(p.replace('+', '')));
            if (max) {
                if (price < min || price > max) return false;
            } else {
                if (price < min) return false;
            }
        }
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
                <i class="fas fa-envelope"></i>
                ${user.contactInfo}
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

// Apply filters
function applyFilters() {
    // Get filter values
    currentFilters.search = document.getElementById('searchInput').value;
    currentFilters.priceRange = document.getElementById('priceRange').value;

    // Re-display current section
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