import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 8000);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';

const allowedOrigins = new Set([
  FRONTEND_ORIGIN,
  'http://localhost:5173',
  'http://127.0.0.1:5173'
]);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use((req, _res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
});

const razorpay = (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
  ? new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET })
  : null;

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'smr-form-tools', razorpayConfigured: Boolean(razorpay) });
});

app.post('/api/create-order', async (req, res) => {
  try {
    if (!razorpay) return res.status(503).json({ error: 'Razorpay backend keys configured nahi hain.' });
    const amountRupees = Number(req.body?.amount);
    if (!Number.isFinite(amountRupees) || amountRupees < 1 || amountRupees > 10000) {
      return res.status(400).json({ error: 'Invalid amount.' });
    }
    const order = await razorpay.orders.create({
      amount: Math.round(amountRupees * 100),
      currency: 'INR',
      receipt: `smr_${Date.now()}`,
      notes: { purpose: String(req.body?.purpose || 'download_unlock') }
    });
    res.json({ id: order.id, amount: order.amount, currency: order.currency });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Razorpay order create nahi hua.' });
  }
});

app.post('/api/verify-payment', (req, res) => {
  try {
    if (!process.env.RAZORPAY_KEY_SECRET) return res.status(503).json({ error: 'Razorpay secret configured nahi hai.' });
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Payment response incomplete.' });
    }
    const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');
    const ok = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(razorpay_signature)));
    if (!ok) return res.status(400).json({ error: 'Invalid payment signature.' });
    res.json({ ok: true, orderId: razorpay_order_id, paymentId: razorpay_payment_id });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Payment verification failed.' });
  }
});

const frontendDist = path.join(__dirname, '../frontend/dist');

app.use(express.static(frontendDist));

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }

  res.sendFile(path.join(frontendDist, 'index.html'), (error) => {
    if (error) {
      next(error);
    }
  });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, () => console.log(`SMR Form Tools API running at http://localhost:${PORT}`));
