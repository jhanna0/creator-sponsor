const pool = require('./db');
const sampleData = require('./data.js');

// Clear all data from database (for testing)
const clearDatabase = async () => {
    try {
        console.log('🧹 Clearing database for testing...');
        
        // Clear all tables in the correct order (respecting foreign key constraints)
        // Only clear tables that actually exist
        await pool.query('DELETE FROM user_reports');
        await pool.query('DELETE FROM contact_reveals');
        await pool.query('DELETE FROM user_payments');
        await pool.query('DELETE FROM payment_sessions');
        await pool.query('DELETE FROM verification_tokens');
        await pool.query('DELETE FROM posts');
        await pool.query('DELETE FROM users');
        
        // Reset sequences
        await pool.query('ALTER SEQUENCE posts_id_seq RESTART WITH 1');
        
        console.log('✅ Database cleared successfully!');
    } catch (error) {
        console.error('❌ Error clearing database:', error);
        throw error;
    }
};

// Migrate sample data to database
const migrateSampleData = async () => {
    try {
        console.log('🔄 Starting data migration...');

        // First, check if we already have posts in the database
        const existingPosts = await pool.query('SELECT COUNT(*) FROM posts');
        if (existingPosts.rows[0].count > 0) {
            console.log('✅ Database already has posts, skipping sample data migration');
            return;
        }

        // Create a dummy user for each sample post since posts require user_id
        for (const post of sampleData) {
            // Create a dummy user
            const dummyEmail = `demo-${post.id}@example.com`;
            let userId;

            try {
                const userResult = await pool.query(
                    'INSERT INTO users (email, password_hash, verified) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING RETURNING id',
                    [dummyEmail, 'dummy-hash', true]
                );

                if (userResult.rows.length > 0) {
                    userId = userResult.rows[0].id;
                } else {
                    // User already exists, get the ID
                    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [dummyEmail]);
                    userId = existingUser.rows[0].id;
                }
            } catch (userError) {
                console.error(`Error creating user for post ${post.id}:`, userError);
                continue;
            }

            // Insert the post
            try {
                await pool.query(`
                    INSERT INTO posts (
                        id, user_id, user_type, name, platform, followers,
                        interests, price_point, description, contact_info,
                        avatar, verified
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                    ON CONFLICT (id) DO NOTHING
                `, [
                    post.id,
                    userId,
                    post.userType,
                    post.name,
                    post.platform,
                    post.followers,
                    post.interests,
                    post.pricePoint,
                    post.description,
                    post.contactInfo,
                    post.avatar,
                    post.verified || true
                ]);

                console.log(`✅ Migrated post ${post.id}: ${post.name}`);
            } catch (postError) {
                console.error(`❌ Error migrating post ${post.id}:`, postError);
            }
        }

        // Update the sequence for posts table
        const maxId = await pool.query('SELECT MAX(id) FROM posts');
        if (maxId.rows[0].max) {
            await pool.query(`SELECT setval('posts_id_seq', $1)`, [maxId.rows[0].max]);
            console.log(`✅ Updated posts sequence to ${maxId.rows[0].max}`);
        }

        console.log('✅ Data migration completed successfully!');

    } catch (error) {
        console.error('❌ Migration error:', error);
        process.exit(1);
    }
};

// Run migration if this file is executed directly
if (require.main === module) {
    migrateSampleData().then(() => {
        console.log('🎉 Migration finished');
        process.exit(0);
    });
}

module.exports = { migrateSampleData, clearDatabase };