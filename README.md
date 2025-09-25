# CreatorBridge

**A modern platform connecting content creators with brand sponsors**

CreatorBridge is a clean, professional web application that helps small to medium content creators connect with new businesses looking for authentic promotion opportunities. Built with a focus on simplicity, modern design, and user experience.

## 🌟 Features

### Core Functionality
- **Creator Profiles**: Content creators can showcase their audience, platform, and rates
- **Sponsor Listings**: Businesses can display their products and budgets
- **Smart Filtering**: Filter by platform, budget range, and content categories
- **Real-time Search**: Instant search through descriptions and interests
- **Registration System**: Clean modal forms for both creators and sponsors

### Design Philosophy
- **Modern Black & White Theme**: Professional, clean aesthetic using CSS variables
- **Material Design Inspired**: Card-based layouts with subtle shadows and rounded corners
- **Platform Icons**: Real brand icons (YouTube, Instagram, TikTok, Twitter, Twitch, LinkedIn)
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile
- **NO Transform Animations**: Absolutely no translate/transform hover/focus effects for better accessibility

### User Experience
- **Fixed Header Navigation**: Always accessible main navigation
- **Left Sidebar Filters**: Intuitive filtering system with platform buttons
- **Card-Based Browsing**: Beautiful cards showing user profiles with stats
- **Modal Registration**: Clean popup forms instead of separate pages
- **Success/Error Notifications**: Clear feedback for user actions

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm

### Installation
```bash
# Clone or download the project
cd creator-sponsor-platform

# Install dependencies
npm install

# Start the server
npm start
```

The application will be available at `http://localhost:3000`

## 📁 Project Structure

```
creator-sponsor-platform/
├── public/
│   ├── index.html          # Main HTML file with modern layout
│   ├── styles.css          # Complete CSS with black/white theme
│   └── script.js           # Frontend JavaScript functionality
├── server.js               # Express.js backend server
├── data.js                 # Sample database with 20 users
├── package.json            # Project dependencies
└── README.md              # This file
```

## 🎨 Design Guidelines

### Color Scheme
- **Primary**: Black (#000000)
- **Secondary**: White (#ffffff)
- **Accent Red**: #ff3b30 (for creators)
- **Accent Blue**: #007aff (for sponsors)
- **Grays**: 50, 100, 200, 300, 400, 600, 800, 900

### Typography
- **Font**: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif
- **Headers**: 700-800 font weight
- **Body**: 400-500 font weight
- **Small text**: 300 font weight

### Animation Policy
**IMPORTANT**: This application contains **NO translate/transform animations** on hover or focus states. All animations are limited to:
- Color transitions
- Box-shadow changes
- Opacity changes
- Scale transforms are explicitly avoided for accessibility

## 🛠 Technical Details

### Backend (Express.js)
- RESTful API endpoints
- In-memory data storage (easily replaceable with database)
- CORS enabled for development
- Static file serving

### Frontend (Vanilla JavaScript)
- Modern ES6+ syntax
- Async/await for API calls
- Real-time filtering with debouncing
- Responsive design with CSS Grid/Flexbox
- Font Awesome icons for platforms

### API Endpoints
```
GET  /                     # Serve main application
POST /api/register         # Register new user (creator/sponsor)
GET  /api/users           # Get all users with optional filtering
```

## 📱 Platform Support

The application includes full support for major social media platforms:
- **YouTube** (fab fa-youtube)
- **Instagram** (fab fa-instagram)
- **TikTok** (fab fa-tiktok)
- **Twitter** (fab fa-twitter)
- **Twitch** (fab fa-twitch)
- **LinkedIn** (fab fa-linkedin)

## 🎯 Sample Data

The application comes with 20 pre-loaded users:
- 10 Content Creators (various platforms and niches)
- 10 Brand Sponsors (different industries and budgets)
- Realistic follower counts, rates, and descriptions
- Emoji avatars for visual appeal

## 💻 Development

### Adding New Features
1. Update the HTML structure if needed
2. Add CSS styling following the existing design system
3. Implement JavaScript functionality
4. Update API endpoints in server.js if required

### Customization
- **Colors**: Modify CSS variables in `:root`
- **Fonts**: Update the font-family declarations
- **Layout**: Adjust the grid systems and flexbox layouts
- **Data**: Replace `data.js` with database connection

## 🔧 Configuration

### Environment Variables
Currently, the app uses default configurations. For production:
- Set `PORT` environment variable for server port
- Configure CORS for specific domains
- Add database connection strings

### Database Integration
To replace the in-memory storage:
1. Install database driver (MongoDB, PostgreSQL, etc.)
2. Replace the user array in `server.js`
3. Update API endpoints to use database queries
4. Add user authentication if needed

## 🚀 Deployment

### Local Development
```bash
npm start
```

### Production
1. Set NODE_ENV=production
2. Configure reverse proxy (nginx)
3. Use process manager (PM2)
4. Set up database
5. Configure SSL certificates

## 🤝 Contributing

When contributing to this project, please maintain:
- The black and white design aesthetic
- No transform/translate animations
- Modern, clean code structure
- Responsive design principles
- Accessibility best practices

## 📄 License

This project is open source and available under the MIT License.

---

**Built with ❤️ for the creator economy**