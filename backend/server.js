import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Razorpay from 'razorpay';
import { OAuth2Client } from 'google-auth-library';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './database/database.js';

const app = express();
const PORT = Number(process.env.PORT || 8000);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FRONTEND_ORIGIN =
  process.env.FRONTEND_ORIGIN || 'http://localhost:5173';

const allowedOrigins = new Set([
  FRONTEND_ORIGIN,
  'http://localhost:5173',
  'http://127.0.0.1:5173'
]);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      return callback(null, true);
    }

    return callback(
      new Error(`CORS blocked origin: ${origin}`)
    );
  },
  credentials: true
}));

app.use(express.json({ limit: '1mb' }));

app.use((req, _res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
});

const razorpay =
  process.env.RAZORPAY_KEY_ID &&
  process.env.RAZORPAY_KEY_SECRET
    ? new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
      })
    : null;

    const JWT_SECRET = String(process.env.JWT_SECRET || '').trim();

    const GOOGLE_CLIENT_ID =
  String(process.env.GOOGLE_CLIENT_ID || '').trim();

const googleClient = GOOGLE_CLIENT_ID
  ? new OAuth2Client(GOOGLE_CLIENT_ID)
  : null;

if (!JWT_SECRET) {
  console.warn('WARNING: JWT_SECRET is not configured.');
}

function createAuthToken(user) {
  return jwt.sign(
    {
      sub: String(user.id),
      email: user.email
    },
    JWT_SECRET,
    {
      expiresIn: '7d'
    }
  );
}

function requireAuth(req, res, next) {
  try {
    if (!JWT_SECRET) {
      return res.status(503).json({
        error: 'Authentication service configured nahi hai.'
      });
    }

    const header = String(req.headers.authorization || '');

    if (!header.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Authentication token required hai.'
      });
    }

    const token = header.slice(7).trim();

    if (!token) {
      return res.status(401).json({
        error: 'Authentication token missing hai.'
      });
    }

    const payload = jwt.verify(token, JWT_SECRET);

    const userId = Number(payload.sub);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({
        error: 'Invalid authentication token.'
      });
    }

    const user = db.prepare(`
      SELECT
        id,
        email,
        name,
        email_verified,
        created_at
      FROM users
      WHERE id = ?
      LIMIT 1
    `).get(userId);

    if (!user) {
      return res.status(401).json({
        error: 'User account nahi mila.'
      });
    }

    req.user = user;

    next();

  } catch (error) {
    console.error('AUTH MIDDLEWARE ERROR:', error);

    return res.status(401).json({
      error: 'Invalid or expired authentication token.'
    });
  }
}

/*
 * Admin Authentication
 */

function createAdminAuthToken(admin) {
  return jwt.sign(
    {
      sub: String(admin.id),
      username: admin.username,
      role: 'admin'
    },
    JWT_SECRET,
    {
      expiresIn: '7d'
    }
  );
}

function requireAdmin(req, res, next) {
  try {
    if (!JWT_SECRET) {
      return res.status(503).json({
        error: 'Authentication service configured nahi hai.'
      });
    }

    const header = String(req.headers.authorization || '');

    if (!header.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Admin authentication token required hai.'
      });
    }

    const token = header.slice(7).trim();

    if (!token) {
      return res.status(401).json({
        error: 'Admin authentication token missing hai.'
      });
    }

    const payload = jwt.verify(token, JWT_SECRET);

    if (payload.role !== 'admin') {
      return res.status(403).json({
        error: 'Admin access required hai.'
      });
    }

    const adminId = Number(payload.sub);

    if (!Number.isInteger(adminId) || adminId <= 0) {
      return res.status(401).json({
        error: 'Invalid admin authentication token.'
      });
    }

    const admin = db.prepare(`
      SELECT
        id,
        username,
        created_at
      FROM admins
      WHERE id = ?
      LIMIT 1
    `).get(adminId);

    if (!admin) {
      return res.status(401).json({
        error: 'Admin account nahi mila.'
      });
    }

    req.admin = admin;

    next();
  } catch (error) {
    console.error('ADMIN AUTH MIDDLEWARE ERROR:', error);

    return res.status(401).json({
      error: 'Invalid or expired admin authentication token.'
    });
  }
}

app.post('/api/admin/login', async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');

    if (!username || !password) {
      return res.status(400).json({
        error: 'Username aur password required hain.'
      });
    }

    const admin = db.prepare(`
      SELECT
        id,
        username,
        password_hash,
        created_at
      FROM admins
      WHERE username = ?
      LIMIT 1
    `).get(username);

    if (!admin) {
      return res.status(401).json({
        error: 'Invalid admin credentials.'
      });
    }

    const passwordOk = await bcrypt.compare(
      password,
      admin.password_hash
    );

    if (!passwordOk) {
      return res.status(401).json({
        error: 'Invalid admin credentials.'
      });
    }

    const token = createAdminAuthToken(admin);

    return res.json({
      ok: true,
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        created_at: admin.created_at
      }
    });
  } catch (error) {
    console.error('ADMIN LOGIN ERROR:', error);

    return res.status(500).json({
      error: 'Admin login failed.'
    });
  }
});
/*
 * User Authentication
 */

app.post('/api/auth/register', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const name = String(req.body?.name || '').trim();
    const password = String(req.body?.password || '');

    if (!email || !name || !password) {
      return res.status(400).json({
        error: 'Name, email aur password required hain.'
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        error: 'Valid email address required hai.'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: 'Password minimum 8 characters ka hona chahiye.'
      });
    }

    const existingUser = db.prepare(`
      SELECT id
      FROM users
      WHERE email = ?
      LIMIT 1
    `).get(email);

    if (existingUser) {
      return res.status(409).json({
        error: 'Is email se user already registered hai.'
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = db.prepare(`
      INSERT INTO users (
        email,
        name,
        password_hash,
        email_verified
      )
      VALUES (?, ?, ?, 0)
    `).run(
      email,
      name,
      passwordHash
    );

    const user = db.prepare(`
      SELECT
        id,
        email,
        name,
        created_at,
        email_verified
      FROM users
      WHERE id = ?
      LIMIT 1
    `).get(result.lastInsertRowid);

    return res.status(201).json({
      ok: true,
      user
    });

  } catch (error) {
    console.error('REGISTER ERROR:', error);

    return res.status(500).json({
      error: 'Registration failed.'
    });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email aur password required hain.'
      });
    }

    const user = db.prepare(`
      SELECT
        id,
        email,
        name,
        password_hash,
        email_verified,
        created_at
      FROM users
      WHERE email = ?
      LIMIT 1
    `).get(email);

    if (!user || !user.password_hash) {
      return res.status(401).json({
        error: 'Email ya password incorrect hai.'
      });
    }

    const passwordOk = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordOk) {
      return res.status(401).json({
        error: 'Email ya password incorrect hai.'
      });
    }

    const token = createAuthToken(user);
    
    return res.json({
      ok: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        email_verified: user.email_verified,
        created_at: user.created_at
      }
    });

  } catch (error) {
    console.error('LOGIN ERROR:', error);

    return res.status(500).json({
      error: 'Login failed.'
    });
  }
});

app.post('/api/auth/google', async (req, res) => {
  try {
    if (!GOOGLE_CLIENT_ID || !googleClient) {
      return res.status(503).json({
        error: 'Google login backend configured nahi hai.'
      });
    }

    const credential =
      String(req.body?.credential || '').trim();

    if (!credential) {
      return res.status(400).json({
        error: 'Google credential required hai.'
      });
    }

    const ticket =
      await googleClient.verifyIdToken({
        idToken: credential,
        audience: GOOGLE_CLIENT_ID
      });

    const payload =
      ticket.getPayload();

    if (
      !payload?.sub ||
      !payload?.email
    ) {
      return res.status(401).json({
        error: 'Google account information incomplete hai.'
      });
    }

    if (payload.email_verified !== true) {
      return res.status(401).json({
        error: 'Google email verified nahi hai.'
      });
    }

    const email =
      String(payload.email)
        .trim()
        .toLowerCase();

    const name =
      String(
        payload.name ||
        email.split('@')[0]
      ).trim();

    let user = db.prepare(`
      SELECT
        id,
        email,
        name,
        password_hash,
        email_verified,
        created_at
      FROM users
      WHERE email = ?
      LIMIT 1
    `).get(email);

    /*
     * Existing account:
     * Google login ko existing email account
     * ke saath connect kar do.
     */
    if (user) {
      db.prepare(`
        UPDATE users
        SET
          name = ?,
          email_verified = 1
        WHERE id = ?
      `).run(
        name,
        user.id
      );

      user = db.prepare(`
        SELECT
          id,
          email,
          name,
          email_verified,
          created_at
        FROM users
        WHERE id = ?
        LIMIT 1
      `).get(user.id);
    }

    /*
     * New Google user:
     * Password ki zarurat nahi hai.
     */
    else {
      const result = db.prepare(`
        INSERT INTO users (
          email,
          name,
          password_hash,
          email_verified
        )
        VALUES (?, ?, NULL, 1)
      `).run(
        email,
        name
      );

      user = db.prepare(`
        SELECT
          id,
          email,
          name,
          email_verified,
          created_at
        FROM users
        WHERE id = ?
        LIMIT 1
      `).get(
        result.lastInsertRowid
      );
    }

    const token =
      createAuthToken(user);

    return res.json({
      ok: true,
      token,
      user
    });

  } catch (error) {
    console.error(
      'GOOGLE LOGIN ERROR:',
      error
    );

    return res.status(401).json({
      error:
        'Google login verify nahi hua.'
    });
  }
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  return res.json({
    ok: true,
    user: req.user
  });
});

/*
 * Tool access check
 *
 * Checks whether the logged-in user currently has:
 * 1. A tool-specific active plan, OR
 * 2. An all-tools active plan.
 *
 * Expired access is automatically treated as inactive.
 */
app.get('/api/access/:toolId', requireAuth, (req, res) => {
  try {
    const toolId =
      String(req.params.toolId || '').trim();

    if (!toolId) {
      return res.status(400).json({
        error: 'Tool ID required hai.'
      });
    }

    const now = new Date().toISOString();

    /*
     * Mark expired access rows inactive.
     */
    db.prepare(`
      UPDATE user_access
      SET active = 0
      WHERE user_id = ?
        AND active = 1
        AND expires_at <= ?
    `).run(
      req.user.id,
      now
    );

    /*
     * First match:
     * - exact tool access
     * - OR all-tools access where tool_id is NULL
     */
    const access = db.prepare(`
      SELECT
        ua.id,
        ua.user_id,
        ua.tool_id,
        ua.plan_id,
        ua.payment_id,
        ua.starts_at,
        ua.expires_at,
        ua.active,
        pp.name AS plan_name,
        pp.scope
      FROM user_access ua
      LEFT JOIN pricing_plans pp
        ON pp.plan_id = ua.plan_id
      WHERE ua.user_id = ?
        AND ua.active = 1
        AND ua.starts_at <= ?
        AND ua.expires_at > ?
        AND (
          ua.tool_id = ?
          OR ua.tool_id IS NULL
        )
      ORDER BY
        CASE
          WHEN ua.tool_id = ? THEN 0
          ELSE 1
        END,
        ua.expires_at DESC
      LIMIT 1
    `).get(
      req.user.id,
      now,
      now,
      toolId,
      toolId
    );

    if (!access) {
      return res.json({
        ok: true,
        hasAccess: false,
        accessType: null,
        planId: null,
        planName: null,
        expiresAt: null,
        remainingMinutes: 0
      });
    }

    const expiresAtMs =
      new Date(access.expires_at).getTime();

    const remainingMinutes = Math.max(
      0,
      Math.ceil(
        (expiresAtMs - Date.now()) / 60000
      )
    );

    return res.json({
      ok: true,
      hasAccess: true,
      accessType:
        access.tool_id === null
          ? 'all_tools'
          : 'tool',
      planId: access.plan_id,
      planName: access.plan_name || null,
      expiresAt: access.expires_at,
      remainingMinutes
    });
  } catch (error) {
    console.error(
      'ACCESS CHECK ERROR:',
      error
    );

    return res.status(500).json({
      error: 'Tool access check failed.'
    });
  }
});


/*
 * Health
 */
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'smr-form-tools',
    razorpayConfigured: Boolean(razorpay)
  });
});

/*
 * Create Razorpay order
 *
 * IMPORTANT:
 * Frontend amount is NOT trusted.
 * Backend gets the price from the tools table.
 */
app.post('/api/create-order', requireAuth, async (req, res) => {
  try {
    if (!razorpay) {
      return res.status(503).json({
        error: 'Razorpay backend keys configured nahi hain.'
      });
    }

    const toolId =
      String(req.body?.toolId || '').trim();

    const planId =
      String(req.body?.planId || '').trim();

    if (!toolId || !planId) {
      return res.status(400).json({
        error: 'toolId aur planId required hain.'
      });
    }

    const tool = db.prepare(`
      SELECT
        tool_id,
        name,
        active
      FROM tools
      WHERE tool_id = ?
      LIMIT 1
    `).get(toolId);

    if (!tool) {
      return res.status(404).json({
        error: 'Tool nahi mila.'
      });
    }

    if (!tool.active) {
      return res.status(403).json({
        error: 'Ye tool abhi available nahi hai.'
      });
    }

    const plan = db.prepare(`
      SELECT
        plan_id,
        name,
        description,
        price_paise,
        duration_hours,
        scope,
        active
      FROM pricing_plans
      WHERE plan_id = ?
      LIMIT 1
    `).get(planId);

    if (!plan) {
      return res.status(404).json({
        error: 'Pricing plan nahi mila.'
      });
    }

    if (!plan.active) {
      return res.status(403).json({
        error: 'Ye pricing plan abhi available nahi hai.'
      });
    }

    if (
      plan.scope !== 'tool' &&
      plan.scope !== 'all_tools'
    ) {
      return res.status(400).json({
        error: 'Pricing plan scope invalid hai.'
      });
    }

    const amountPaise = Number(plan.price_paise);

    if (
      !Number.isInteger(amountPaise) ||
      amountPaise < 100 ||
      amountPaise > 1000000
    ) {
      return res.status(500).json({
        error: 'Pricing configuration invalid hai.'
      });
    }

    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: `smr_${Date.now()}`,
      notes: {
        purpose: String(
          req.body?.purpose ||
          'plan_purchase'
        ),
        toolId: tool.tool_id,
        planId: plan.plan_id
      }
    });

    db.prepare(`
      INSERT INTO payments (
        razorpay_order_id,
        razorpay_payment_id,
        amount_paise,
        currency,
        tool_id,
        purpose,
        status,
        plan_id,
        user_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      order.id,
      null,
      order.amount,
      order.currency,
      tool.tool_id,
      String(
        req.body?.purpose ||
        'plan_purchase'
      ),
      'pending',
      plan.plan_id,
      req.user.id
    );

    res.json({
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      toolId: tool.tool_id,
      toolName: tool.name,
      planId: plan.plan_id,
      planName: plan.name,
      planDescription: plan.description,
      durationHours: plan.duration_hours,
      scope: plan.scope
    });
  } catch (error) {
    console.error(
      'CREATE ORDER ERROR:',
      error
    );

    res.status(500).json({
      error: 'Razorpay order create nahi hua.'
    });
  }
});

/*
/*
 * Verify Razorpay payment
 */
app.post('/api/verify-payment', requireAuth, (req, res) => {
  try {
    if (!process.env.RAZORPAY_KEY_SECRET) {
      return res.status(503).json({
        error: 'Razorpay secret configured nahi hai.'
      });
    }

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body || {};

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({
        error: 'Payment response incomplete.'
      });
    }

    const expected = crypto
      .createHmac(
        'sha256',
        process.env.RAZORPAY_KEY_SECRET
      )
      .update(
        `${razorpay_order_id}|${razorpay_payment_id}`
      )
      .digest('hex');

    const received = String(razorpay_signature);

    if (
      expected.length !== received.length
    ) {
      return res.status(400).json({
        error: 'Invalid payment signature.'
      });
    }

    const ok = crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(received)
    );

    if (!ok) {
      return res.status(400).json({
        error: 'Invalid payment signature.'
      });
    }

    /*
     * Find payment created by our backend.
     */
    const payment = db.prepare(`
      SELECT
        id,
        razorpay_order_id,
        razorpay_payment_id,
        amount_paise,
        currency,
        tool_id,
        purpose,
        status,
        plan_id,
        user_id
      FROM payments
      WHERE razorpay_order_id = ?
      LIMIT 1
    `).get(razorpay_order_id);

    if (!payment) {
      return res.status(404).json({
        error:
          'Payment order database mein nahi mila.'
      });
    }

    /*
     * Payment order must belong to the logged-in user.
     */
    if (Number(payment.user_id) !== Number(req.user.id)) {
      return res.status(403).json({
        error:
          'Ye payment order is user account se belong nahi karta.'
      });
    }

    /*
     * Prevent accidental duplicate verification.
     */
    if (
      payment.status === 'verified' &&
      payment.razorpay_payment_id ===
        razorpay_payment_id
    ) {
      return res.json({
        ok: true,
        alreadyVerified: true,
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        toolId: payment.tool_id,
        planId: payment.plan_id || null
      });
    }

    /*
     * Plan must exist for a plan purchase.
     */
    let plan = null;

    if (payment.plan_id) {
      plan = db.prepare(`
        SELECT
          plan_id,
          name,
          description,
          price_paise,
          duration_hours,
          scope,
          active
        FROM pricing_plans
        WHERE plan_id = ?
        LIMIT 1
      `).get(payment.plan_id);

      if (!plan) {
        return res.status(400).json({
          error:
            'Payment ka pricing plan database mein nahi mila.'
        });
      }

      if (!plan.active) {
        return res.status(400).json({
          error:
            'Payment ka pricing plan active nahi hai.'
        });
      }

      /*
       * Backend price is the source of truth.
       */
      if (
        Number(payment.amount_paise) !==
        Number(plan.price_paise)
      ) {
        return res.status(400).json({
          error:
            'Payment amount pricing plan se match nahi karta.'
        });
      }
    }

    /*
     * Complete payment + access + download
     * atomically.
     *
     * user_id is currently NULL because
     * login/user identity is not connected yet.
     */
    const verifyTransaction = db.transaction(() => {
      db.prepare(`
        UPDATE payments
        SET
          razorpay_payment_id = ?,
          status = 'verified'
        WHERE id = ?
      `).run(
        razorpay_payment_id,
        payment.id
      );

      /*
       * Record paid download/unlock.
       */
      db.prepare(`
        INSERT INTO downloads (
          tool_id,
          unlock_type,
          payment_id,
          user_id
        )
        VALUES (?, 'paid', ?, ?)
      `).run(
        payment.tool_id,
        payment.id,
        req.user.id
      );

      /*
       * Create plan access.
       */
      if (plan) {
        const startsAt = new Date();

        const expiresAt = new Date(
          startsAt.getTime() +
          Number(plan.duration_hours) *
          60 *
          60 *
          1000
        );

        if (plan.scope === 'all_tools') {
          db.prepare(`
            INSERT INTO user_access (
              user_id,
              tool_id,
              plan_id,
              payment_id,
              starts_at,
              expires_at,
              active
            )
            VALUES (
              ?,
              NULL,
              ?,
              ?,
              ?,
              ?,
              1
            )
          `).run(
            req.user.id,
            plan.plan_id,
            payment.id,
            startsAt.toISOString(),
            expiresAt.toISOString()
);
        } else {
          db.prepare(`
            INSERT INTO user_access (
              user_id,
              tool_id,
              plan_id,
              payment_id,
              starts_at,
              expires_at,
              active
            )
            VALUES (
              ?,
              ?,
              ?,
              ?,
              ?,
              ?,
              1
            )
          `).run(
            req.user.id,
            payment.tool_id,
            plan.plan_id,
            payment.id,
            startsAt.toISOString(),
            expiresAt.toISOString()
);
        }
      }
    });

    verifyTransaction();

    res.json({
      ok: true,
      alreadyVerified: false,
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      toolId: payment.tool_id,
      planId: payment.plan_id || null,
      accessCreated: Boolean(plan)
    });
  } catch (error) {
    console.error(
      'VERIFY PAYMENT ERROR:',
      error
    );

    res.status(400).json({
      error:
        'Payment verification failed.'
    });
  }
});
/*
 * Admin-friendly payment summary API.
 *
 * Temporary read endpoint for local development.
 * Authentication will be added before production.
 */
app.get('/api/admin/payments', requireAdmin, (_req, res) => {
  try {
    const payments = db.prepare(`
      SELECT
        id,
        razorpay_order_id,
        razorpay_payment_id,
        amount_paise,
        currency,
        tool_id,
        purpose,
        status,
        created_at
      FROM payments
      ORDER BY id DESC
      LIMIT 100
    `).all();

    res.json({
      ok: true,
      payments
    });
  } catch (error) {
    console.error(
      'ADMIN PAYMENTS ERROR:',
      error
    );

    res.status(500).json({
      error:
        'Payments load nahi ho paye.'
    });
  }
});

/*
 * Admin dashboard overview API.
 * Protected by admin authentication.
 */
app.get('/api/admin/overview', requireAdmin, (_req, res) => {
  try {
    const totalUsers = db.prepare(`
      SELECT COUNT(*) AS count
      FROM users
    `).get().count;

    const totalPayments = db.prepare(`
      SELECT COUNT(*) AS count
      FROM payments
    `).get().count;

    const verifiedPayments = db.prepare(`
      SELECT COUNT(*) AS count
      FROM payments
      WHERE LOWER(status) IN ('verified', 'paid')
    `).get().count;

    const pendingPayments = db.prepare(`
      SELECT COUNT(*) AS count
      FROM payments
      WHERE LOWER(status) IN ('pending', 'created')
    `).get().count;

    const failedPayments = db.prepare(`
      SELECT COUNT(*) AS count
      FROM payments
      WHERE LOWER(status) = 'failed'
    `).get().count;

    const activeAccess = db.prepare(`
      SELECT COUNT(*) AS count
      FROM user_access
      WHERE active = 1
        AND datetime(expires_at) > datetime('now')
    `).get().count;

    const revenue = db.prepare(`
      SELECT COALESCE(SUM(amount_paise), 0) AS amount_paise
      FROM payments
      WHERE LOWER(status) IN ('verified', 'paid')
    `).get().amount_paise;

    const recentUsers = db.prepare(`
      SELECT
        id,
        email,
        name,
        email_verified,
        created_at
      FROM users
      ORDER BY id DESC
      LIMIT 10
    `).all();

    const recentPayments = db.prepare(`
      SELECT
        p.id,
        p.razorpay_order_id,
        p.razorpay_payment_id,
        p.amount_paise,
        p.currency,
        p.tool_id,
        p.plan_id,
        p.purpose,
        p.status,
        p.user_id,
        u.email AS user_email,
        u.name AS user_name,
        p.created_at
      FROM payments p
      LEFT JOIN users u
        ON u.id = p.user_id
      ORDER BY p.id DESC
      LIMIT 20
    `).all();

    const access = db.prepare(`
      SELECT
        ua.id,
        ua.user_id,
        ua.tool_id,
        ua.plan_id,
        ua.payment_id,
        ua.starts_at,
        ua.expires_at,
        ua.active,
        u.email AS user_email,
        u.name AS user_name,
        pp.name AS plan_name
      FROM user_access ua
      LEFT JOIN users u
        ON u.id = ua.user_id
      LEFT JOIN pricing_plans pp
        ON pp.plan_id = ua.plan_id
      ORDER BY ua.id DESC
      LIMIT 50
    `).all();

    res.json({
      ok: true,
      stats: {
        totalUsers: Number(totalUsers || 0),
        totalPayments: Number(totalPayments || 0),
        verifiedPayments: Number(verifiedPayments || 0),
        pendingPayments: Number(pendingPayments || 0),
        failedPayments: Number(failedPayments || 0),
        activeAccess: Number(activeAccess || 0),
        revenuePaise: Number(revenue || 0)
      },
      recentUsers,
      recentPayments,
      access
    });
  } catch (error) {
    console.error(
      'ADMIN OVERVIEW ERROR:',
      error
    );

    res.status(500).json({
      error:
        'Admin dashboard data load nahi ho paya.'
    });
  }
});
/*
 * Serve built React frontend
 */
const frontendDist = path.join(
  __dirname,
  '../frontend/dist'
);

app.use(
  express.static(frontendDist)
);

/*
 * React fallback
 */
app.use((req, res, next) => {
  if (
    req.path.startsWith('/api/')
  ) {
    return next();
  }

  res.sendFile(
    path.join(
      frontendDist,
      'index.html'
    ),
    (error) => {
      if (error) {
        next(error);
      }
    }
  );
});

/*
 * Error handler
 */
app.use(
  (err, _req, res, _next) => {
    console.error(err);

    res.status(500).json({
      error:
        'Internal server error.'
    });
  }
);

app.listen(PORT, () => {
  console.log(
    `SMR Form Tools API running on port ${PORT}`
  );
});











