import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'smr-form-tools.db');

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    name TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tools (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tool_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    price_paise INTEGER NOT NULL DEFAULT 200,
    ad_unlock_enabled INTEGER NOT NULL DEFAULT 1,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    razorpay_order_id TEXT UNIQUE,
    razorpay_payment_id TEXT UNIQUE,
    amount_paise INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    tool_id TEXT,
    purpose TEXT,
    status TEXT NOT NULL DEFAULT 'verified',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS downloads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tool_id TEXT NOT NULL,
    unlock_type TEXT NOT NULL,
    payment_id INTEGER,
    user_id INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (payment_id) REFERENCES payments(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS ad_unlocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tool_id TEXT NOT NULL,
    reward_status TEXT NOT NULL DEFAULT 'granted',
    user_id INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const defaultTools = [
  {
    tool_id: 'photo-compressor',
    name: 'Photo KB Compressor',
    description: 'Photo ko required KB size mein compress karo.',
    price_paise: 200,
  },
  {
    tool_id: 'image-resize',
    name: 'Image Resize',
    description: 'Image ka exact width aur height set karke resize karo.',
    price_paise: 200,
  },
  {
    tool_id: 'signature-resize',
    name: 'Signature Resize',
    description: 'Signature ko required size mein resize karo.',
    price_paise: 200,
  },
  {
    tool_id: 'jpg-to-pdf',
    name: 'JPG to PDF',
    description: 'JPG images ko PDF mein convert karo.',
    price_paise: 200,
  },
  {
    tool_id: 'pdf-compress',
    name: 'PDF Compress',
    description: 'PDF file ka size reduce karo.',
    price_paise: 200,
  },
  {
    tool_id: 'passport-photo',
    name: 'Passport Photo',
    description: 'Passport/form ke liye photo ready karo.',
    price_paise: 200,
  },
];

const insertTool = db.prepare(`
  INSERT OR IGNORE INTO tools (
    tool_id,
    name,
    description,
    price_paise,
    ad_unlock_enabled,
    active
  )
  VALUES (
    @tool_id,
    @name,
    @description,
    @price_paise,
    1,
    1
  )
`);

const insertManyTools = db.transaction((items) => {
  for (const item of items) {
    insertTool.run(item);
  }
});

insertManyTools(defaultTools);

export default db;