#!/usr/bin/env node

/**
 * Configuration Test - Validates environment setup without database connection
 */

require('dotenv').config();

console.log('🔍 Testing Creator-Sponsor Platform Configuration...\n');

// Test 1: Environment Variables
console.log('📋 Environment Variables Check:');
const requiredVars = [
    'USER', 'HOST', 'DB', 'PASSWORD', 'DB_PORT',
    'JWT_SECRET', 'STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY',
    'EMAIL_USER', 'EMAIL_PASS', 'BASE_URL', 'POST_FEE', 'CONTACT_REVEAL_FEE'
];

let missingVars = [];
requiredVars.forEach(varName => {
    if (process.env[varName]) {
        console.log(`✅ ${varName}: ${process.env[varName].substring(0, 20)}${process.env[varName].length > 20 ? '...' : ''}`);
    } else {
        console.log(`❌ ${varName}: Missing`);
        missingVars.push(varName);
    }
});

// Test 2: Database Configuration
console.log('\n🗄️  Database Configuration:');
console.log(`Host: ${process.env.HOST || 'localhost'}`);
console.log(`Port: ${process.env.DB_PORT || '5432'}`);
console.log(`Database: ${process.env.DB || 'creator_sponsor_platform'}`);
console.log(`User: ${process.env.USER || 'postgres'}`);

// Test 3: Application Configuration
console.log('\n⚙️  Application Configuration:');
console.log(`Port: ${process.env.PORT || '3000'}`);
console.log(`Base URL: ${process.env.BASE_URL || 'http://localhost:3000'}`);
console.log(`Node Environment: ${process.env.NODE_ENV || 'development'}`);

// Test 4: Pricing Configuration
console.log('\n💰 Pricing Configuration:');
console.log(`Post Fee: $${(parseFloat(process.env.POST_FEE) / 100).toFixed(2)}`);
console.log(`Contact Reveal Fee: $${(parseFloat(process.env.CONTACT_REVEAL_FEE) / 100).toFixed(2)}`);

// Test 5: Dependencies Check
console.log('\n📦 Dependencies Check:');
try {
    const pg = require('pg');
    console.log(`✅ pg: ${pg.version || 'installed'}`);
} catch (e) {
    console.log('❌ pg: Not installed');
}

try {
    const dotenv = require('dotenv');
    console.log(`✅ dotenv: ${dotenv.version || 'installed'}`);
} catch (e) {
    console.log('❌ dotenv: Not installed');
}

try {
    const express = require('express');
    console.log(`✅ express: ${express.version || 'installed'}`);
} catch (e) {
    console.log('❌ express: Not installed');
}

// Summary
console.log('\n' + '='.repeat(50));
if (missingVars.length === 0) {
    console.log('✅ Configuration looks good! Ready for deployment.');
    console.log('\n📝 Next Steps:');
    console.log('1. Install PostgreSQL on your Lightsail instance');
    console.log('2. Create the database: createdb creator_sponsor_platform');
    console.log('3. Run: npm start');
    console.log('4. Run tests: npm test');
} else {
    console.log(`❌ Missing ${missingVars.length} required environment variables:`);
    missingVars.forEach(varName => console.log(`   - ${varName}`));
    console.log('\n📝 Update your .env file with the missing variables.');
}
console.log('='.repeat(50));
