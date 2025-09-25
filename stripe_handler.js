const Stripe = require('stripe');
const pool = require('./db');
require('dotenv').config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Create or get Stripe customer for user
async function getOrCreateStripeCustomer(userEmail) {
    try {
        // Check if we already have a customer ID in database
        const existingCustomer = await pool.query(
            'SELECT stripe_customer_id FROM users WHERE email = $1 AND stripe_customer_id IS NOT NULL',
            [userEmail]
        );

        if (existingCustomer.rows.length > 0) {
            return existingCustomer.rows[0].stripe_customer_id;
        }

        // Check if customer exists in Stripe
        const existingStripeCustomers = await stripe.customers.list({
            email: userEmail,
            limit: 1
        });

        let customer;
        if (existingStripeCustomers.data.length > 0) {
            customer = existingStripeCustomers.data[0];
        } else {
            // Create new customer
            customer = await stripe.customers.create({
                email: userEmail,
                metadata: {
                    platform: 'creator-sponsor-platform'
                }
            });
        }

        // Save customer ID to database
        await pool.query(
            'UPDATE users SET stripe_customer_id = $1 WHERE email = $2',
            [customer.id, userEmail]
        );

        return customer.id;
    } catch (error) {
        console.error('Error creating/fetching Stripe customer:', error);
        throw error;
    }
}

// Create checkout session for posting fee ($5)
async function createPostingCheckoutSession(req, res) {
    try {
        const { userEmail } = req.body;

        if (!userEmail) {
            return res.status(400).json({ error: 'User email is required' });
        }

        // Get or create Stripe customer for saved payment methods
        const customerId = await getOrCreateStripeCustomer(userEmail);

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: 'Creator-Sponsor Platform - Post Creation Fee',
                            description: 'One-time fee to create and publish your post'
                        },
                        unit_amount: parseInt(process.env.POST_FEE) || 500, // $5.00
                    },
                    quantity: 1,
                },
            ],
            customer: customerId,
            customer_email: userEmail,
            payment_method_options: {
                card: {
                    setup_future_usage: 'on_session',
                },
            },
            metadata: {
                payment_type: 'posting_fee',
                user_email: userEmail
            },
            success_url: `${process.env.BASE_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}&type=posting`,
            cancel_url: `${process.env.BASE_URL}/payment-cancelled?type=posting`,
        });

        // Store session info in database
        await pool.query(`
            INSERT INTO payment_sessions (id, user_email, payment_type, amount, metadata, stripe_session_data)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [
            session.id,
            userEmail,
            'posting_fee',
            parseInt(process.env.POST_FEE) || 500,
            JSON.stringify({ payment_type: 'posting_fee' }),
            JSON.stringify(session)
        ]);

        res.json({
            success: true,
            sessionId: session.id,
            sessionUrl: session.url
        });
    } catch (error) {
        console.error('Error creating posting checkout session:', error);
        res.status(500).json({ error: 'Payment session creation failed' });
    }
}

// Create checkout session for individual contact reveal ($1.00)
async function createContactRevealCheckoutSession(req, res) {
    try {
        const { userEmail, targetPostId, targetUserName } = req.body;

        if (!userEmail || !targetPostId) {
            return res.status(400).json({ error: 'User email and target post ID are required' });
        }

        // Get or create Stripe customer for saved payment methods
        const customerId = await getOrCreateStripeCustomer(userEmail);

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: 'Creator-Sponsor Platform - Contact Reveal',
                            description: `Reveal contact information for ${targetUserName || 'selected user'}`
                        },
                        unit_amount: parseInt(process.env.CONTACT_REVEAL_FEE) || 100, // $1.00
                    },
                    quantity: 1,
                },
            ],
            customer: customerId,
            customer_email: userEmail,
            metadata: {
                payment_type: 'contact_reveal',
                user_email: userEmail,
                target_post_id: targetPostId.toString()
            },
            success_url: `${process.env.BASE_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}&type=contact&target=${targetPostId}`,
            cancel_url: `${process.env.BASE_URL}/payment-cancelled?type=contact`,
        });

        // Store session info in database
        await pool.query(`
            INSERT INTO payment_sessions (id, user_email, payment_type, amount, metadata, stripe_session_data)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [
            session.id,
            userEmail,
            'contact_reveal',
            parseInt(process.env.CONTACT_REVEAL_FEE) || 100,
            JSON.stringify({ payment_type: 'contact_reveal', target_post_id: targetPostId }),
            JSON.stringify(session)
        ]);

        res.json({
            success: true,
            sessionId: session.id,
            sessionUrl: session.url,
            amount: (parseInt(process.env.CONTACT_REVEAL_FEE) || 100) / 100
        });
    } catch (error) {
        console.error('Error creating contact reveal checkout session:', error);
        res.status(500).json({ error: 'Payment session creation failed' });
    }
}

// Handle successful payments
async function handlePaymentSuccess(req, res) {
    try {
        const { session_id, type, target } = req.query;

        if (!session_id) {
            return res.status(400).json({ error: 'Session ID required' });
        }

        // Verify session with Stripe
        const session = await stripe.checkout.sessions.retrieve(session_id);

        if (session.payment_status !== 'paid') {
            return res.status(400).json({ error: 'Payment not completed' });
        }

        // Get session data from database
        const sessionResult = await pool.query(
            'SELECT * FROM payment_sessions WHERE id = $1',
            [session_id]
        );

        if (sessionResult.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid session' });
        }

        const sessionData = sessionResult.rows[0];

        // Process payment based on type
        if (sessionData.payment_type === 'posting_fee') {
            // Record payment in user_payments table
            await pool.query(`
                INSERT INTO user_payments (user_email, payment_type, amount, stripe_session_id)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT DO NOTHING
            `, [
                sessionData.user_email,
                'posting_fee',
                sessionData.amount,
                session_id
            ]);

            // Update session status
            await pool.query(
                'UPDATE payment_sessions SET status = $1, completed_at = CURRENT_TIMESTAMP WHERE id = $2',
                ['completed', session_id]
            );

            return res.json({
                success: true,
                message: 'Posting fee paid successfully! You can now create your post.',
                payment_type: 'posting_fee'
            });

        } else if (sessionData.payment_type === 'contact_reveal') {
            const metadata = JSON.parse(sessionData.metadata);
            const targetPostId = metadata.target_post_id;

            // Record contact reveal
            await pool.query(`
                INSERT INTO contact_reveals (requester_email, target_post_id, stripe_payment_intent_id, amount_paid)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (requester_email, target_post_id) DO NOTHING
            `, [
                sessionData.user_email,
                parseInt(targetPostId),
                session.payment_intent,
                sessionData.amount
            ]);

            // Update session status
            await pool.query(
                'UPDATE payment_sessions SET status = $1, completed_at = CURRENT_TIMESTAMP WHERE id = $2',
                ['completed', session_id]
            );

            return res.json({
                success: true,
                message: 'Contact information unlocked! You can now view the contact details.',
                payment_type: 'contact_reveal',
                target_post_id: targetPostId
            });
        } else {
            return res.status(400).json({ error: 'Unknown payment type' });
        }

    } catch (error) {
        console.error('Error handling payment success:', error);
        res.status(500).json({ error: 'Error processing payment' });
    }
}

// Check if user has paid for posting
async function hasUserPaidForPosting(userEmail) {
    try {
        const result = await pool.query(
            'SELECT 1 FROM user_payments WHERE user_email = $1 AND payment_type = $2',
            [userEmail, 'posting_fee']
        );
        return result.rows.length > 0;
    } catch (error) {
        console.error('Error checking posting payment:', error);
        return false;
    }
}

// Check if user has paid to reveal specific contact
async function hasUserPaidForContact(userEmail, targetUserId) {
    try {
        const result = await pool.query(
            'SELECT 1 FROM contact_reveals WHERE requester_email = $1 AND target_post_id = $2',
            [userEmail, parseInt(targetUserId)]
        );
        return result.rows.length > 0;
    } catch (error) {
        console.error('Error checking contact reveal payment:', error);
        return false;
    }
}

// Get payment status for user
async function getUserPaymentStatus(userEmail) {
    try {
        // Check posting fee payment
        const postingResult = await pool.query(
            'SELECT 1 FROM user_payments WHERE user_email = $1 AND payment_type = $2',
            [userEmail, 'posting_fee']
        );

        // Get revealed contacts
        const contactsResult = await pool.query(
            'SELECT target_post_id FROM contact_reveals WHERE requester_email = $1',
            [userEmail]
        );

        return {
            hasPaidForPosting: postingResult.rows.length > 0,
            revealedContacts: contactsResult.rows.map(row => row.target_post_id.toString())
        };
    } catch (error) {
        console.error('Error getting payment status:', error);
        return {
            hasPaidForPosting: false,
            revealedContacts: []
        };
    }
}

// Webhook handler for Stripe events
async function handleStripeWebhook(req, res) {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error('Webhook signature verification failed:', err);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed':
            const session = event.data.object;
            console.log('Payment succeeded:', session.id);
            // Additional webhook processing can be added here
            break;
        case 'payment_intent.payment_failed':
            console.log('Payment failed:', event.data.object);
            // Mark session as failed in database
            break;
        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    res.json({received: true});
}

module.exports = {
    createPostingCheckoutSession,
    createContactRevealCheckoutSession,
    handlePaymentSuccess,
    hasUserPaidForPosting,
    hasUserPaidForContact,
    getUserPaymentStatus,
    handleStripeWebhook,
    getOrCreateStripeCustomer
};