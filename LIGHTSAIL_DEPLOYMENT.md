# Creator-Sponsor Platform - AWS Lightsail Deployment Guide

This guide will help you deploy the Creator-Sponsor Platform on AWS Lightsail with PostgreSQL running directly on the server (same setup as the `/links` project).

## Prerequisites

- AWS Lightsail instance (Ubuntu 20.04 LTS recommended)
- Domain name (optional, for production)
- Stripe account for payment processing
- Email service (Gmail SMTP recommended)

## Step 1: Set Up Lightsail Instance

1. **Create Lightsail Instance**:
   - Choose Ubuntu 20.04 LTS
   - Select appropriate instance size (at least 1GB RAM for PostgreSQL)
   - Enable automatic snapshots

2. **Connect to Instance**:
   ```bash
   ssh -i your-key.pem ubuntu@your-instance-ip
   ```

## Step 2: Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Install PM2 for process management
sudo npm install -g pm2

# Install Git
sudo apt install git -y
```

## Step 3: Configure PostgreSQL

```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE creator_sponsor_platform;
CREATE USER postgres WITH ENCRYPTED PASSWORD 'your_secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE creator_sponsor_platform TO postgres;
\q

# Configure PostgreSQL to accept connections
sudo nano /etc/postgresql/12/main/postgresql.conf
# Uncomment and set: listen_addresses = 'localhost'

sudo nano /etc/postgresql/12/main/pg_hba.conf
# Add: local   all             postgres                                md5

# Restart PostgreSQL
sudo systemctl restart postgresql
sudo systemctl enable postgresql
```

## Step 4: Deploy Application

```bash
# Clone your repository
git clone https://github.com/yourusername/creator-sponsor-platform.git
cd creator-sponsor-platform

# Install dependencies
npm install

# Create environment file
cp env-template.txt .env
nano .env
# Update with your actual values:
# - Database password
# - JWT secret (generate a secure random string)
# - Stripe keys
# - Email credentials
# - Domain name

# Test database connection
node -e "require('./db.js')"
```

## Step 5: Configure Firewall and Security

```bash
# Configure UFW firewall
sudo ufw allow ssh
sudo ufw allow 3000
sudo ufw enable

# Optional: Configure SSL with Let's Encrypt
sudo apt install certbot python3-certbot-nginx -y
# Follow Let's Encrypt setup for your domain
```

## Step 6: Set Up Process Management

```bash
# Create PM2 ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'creator-sponsor-platform',
    script: 'server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
EOF

# Start application with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## Step 7: Configure Nginx (Optional)

```bash
# Install Nginx
sudo apt install nginx -y

# Create Nginx configuration
sudo nano /etc/nginx/sites-available/creator-sponsor-platform

# Add configuration:
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Enable site
sudo ln -s /etc/nginx/sites-available/creator-sponsor-platform /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Step 8: Set Up Monitoring and Backups

```bash
# Set up log rotation
sudo nano /etc/logrotate.d/creator-sponsor-platform

# Add:
/home/ubuntu/creator-sponsor-platform/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 ubuntu ubuntu
    postrotate
        pm2 reloadLogs
    endscript
}

# Set up database backups
crontab -e
# Add: 0 2 * * * pg_dump -h localhost -U postgres creator_sponsor_platform > /home/ubuntu/backups/db_$(date +\%Y\%m\%d).sql
```

## Environment Variables Reference

Copy `env-template.txt` to `.env` and update these values:

- `USER`: postgres
- `HOST`: localhost
- `DB`: creator_sponsor_platform
- `PASSWORD`: Your secure PostgreSQL password
- `PORT`: 5432
- `JWT_SECRET`: Generate a secure random string (256+ bits)
- `STRIPE_SECRET_KEY`: Your Stripe secret key
- `STRIPE_PUBLISHABLE_KEY`: Your Stripe publishable key
- `STRIPE_WEBHOOK_SECRET`: Your Stripe webhook secret
- `EMAIL_USER`: Your SMTP email
- `EMAIL_PASS`: Your SMTP password
- `BASE_URL`: Your domain (e.g., https://yourdomain.com)

## Verification Steps

1. **Database Connection**: `node -e "require('./db.js')"`
2. **Application Start**: `npm start`
3. **PM2 Status**: `pm2 status`
4. **Database Tables**: Check if all tables are created
5. **API Endpoints**: Test key endpoints

## Maintenance Commands

```bash
# View logs
pm2 logs creator-sponsor-platform

# Restart application
pm2 restart creator-sponsor-platform

# Database backup
pg_dump -h localhost -U postgres creator_sponsor_platform > backup.sql

# Update application
git pull
npm install
pm2 restart creator-sponsor-platform
```

## Troubleshooting

- **Database connection issues**: Check PostgreSQL status with `sudo systemctl status postgresql`
- **Port conflicts**: Ensure port 3000 is available
- **Permission issues**: Check file permissions and PostgreSQL user access
- **Memory issues**: Monitor with `htop` and consider upgrading instance size

This setup provides the same PostgreSQL-on-server configuration as your `/links` project, ensuring consistency across your deployments.
