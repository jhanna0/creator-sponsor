const Stripe = require('stripe');
const crypto = require('crypto');
require('dotenv').config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// In-memory payment tracking (in production, use database)
let paymentSessions = new Map();
let paidUsers = new Set(); // Users who paid for posting
let contactReveals = new Map(); // email -> userId tracking who paid to see contact
let stripeCustomers = new Map(); // email -> stripe_customer_id mapping

// Create or get Stripe customer for user
async function getOrCreateStripeCustomer(userEmail) {
    // Check if we already have a customer ID cached
    if (stripeCustomers.has(userEmail)) {
        return stripeCustomers.get(userEmail);
    }

    try {
        // Check if customer exists in Stripe
        const existingCustomers = await stripe.customers.list({
            email: userEmail,
            limit: 1
        });

        let customer;
        if (existingCustomers.data.length > 0) {
            customer = existingCustomers.data[0];
        } else {
            // Create new customer
            customer = await stripe.customers.create({
                email: userEmail,
                metadata: {
                    platform: 'creator-sponsor-platform'
                }
            });
        }

        // Cache the customer ID
        stripeCustomers.set(userEmail, customer.id);
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
            customer: customerId, // Use customer ID for saved payment methods
            customer_email: userEmail, // Required for billing_details.email
            payment_method_options: {
                card: {
                    setup_future_usage: 'on_session', // Save payment method for future use
                },
            },
            metadata: {
                payment_type: 'posting_fee',
                user_email: userEmail
            },
            success_url: `${process.env.BASE_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}&type=posting`,
            cancel_url: `${process.env.BASE_URL}/payment-cancelled?type=posting`,
        });

        // Store session info
        paymentSessions.set(session.id, {
            type: 'posting_fee',
            userEmail: userEmail,
            amount: parseInt(process.env.POST_FEE) || 500,
            createdAt: new Date()
        });

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
            customer: customerId, // Use customer ID for saved payment methods
            customer_email: userEmail, // Required for billing_details.email
            metadata: {
                payment_type: 'contact_reveal',
                user_email: userEmail,
                target_post_id: targetPostId.toString()
            },
            success_url: `${process.env.BASE_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}&type=contact&target=${targetPostId}`,
            cancel_url: `${process.env.BASE_URL}/payment-cancelled?type=contact`,
        });

        // Store session info
        paymentSessions.set(session.id, {
            type: 'contact_reveal',
            userEmail: userEmail,
            targetPostId: targetPostId,
            amount: parseInt(process.env.CONTACT_REVEAL_FEE) || 100,
            createdAt: new Date()
        });

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

// Remove bulk contact reveal function - no longer needed with Stripe saved payment methods

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

        const sessionData = paymentSessions.get(session_id);
        if (!sessionData) {
            return res.status(400).json({ error: 'Invalid session' });
        }

        // Process payment based on type
        if (sessionData.type === 'posting_fee') {
            // Mark user as paid for posting
            paidUsers.add(sessionData.userEmail);

            // Clean up session data
            paymentSessions.delete(session_id);

            return res.json({
                success: true,
                message: 'Posting fee paid successfully! You can now create your post.',
                payment_type: 'posting_fee'
            });

        } else if (sessionData.type === 'contact_reveal') {
            // Mark contact as revealed for this user
            const revealKey = `${sessionData.userEmail}-${sessionData.targetPostId}`;
            contactReveals.set(revealKey, {
                paidAt: new Date(),
                amount: sessionData.amount,
                stripeSessionId: session_id
            });

            // Clean up session data
            paymentSessions.delete(session_id);

            return res.json({
                success: true,
                message: 'Contact information unlocked! You can now view the contact details.',
                payment_type: 'contact_reveal',
                target_post_id: sessionData.targetPostId
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
function hasUserPaidForPosting(userEmail) {
    return paidUsers.has(userEmail);
}

// Check if user has paid to reveal specific contact
function hasUserPaidForContact(userEmail, targetUserId) {
    const revealKey = `${userEmail}-${targetUserId}`;
    return contactReveals.has(revealKey);
}

// Get payment status for user
function getUserPaymentStatus(userEmail) {
    return {
        hasPaidForPosting: hasUserPaidForPosting(userEmail),
        revealedContacts: Array.from(contactReveals.keys())
            .filter(key => key.startsWith(`${userEmail}-`))
            .map(key => key.split('-')[1])
    };
}

// Webhook handler for Stripe events (optional but recommended for production)
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
            break;
        case 'payment_intent.payment_failed':
            console.log('Payment failed:', event.data.object);
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
    getOrCreateStripeCustomer // Export for use in user registration
};