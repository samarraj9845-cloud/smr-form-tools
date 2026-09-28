import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'smr-form-tools.db');

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

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

  CREATE TABLE IF NOT EXISTS pricing_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id TEXT UNIQUE,
    name TEXT,
    description TEXT,
    price_paise INTEGER,
    duration_hours INTEGER,
    scope TEXT DEFAULT 'tool',
    active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS user_access (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    tool_id TEXT,
    plan_id TEXT NOT NULL,
    payment_id INTEGER,
    starts_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (payment_id) REFERENCES payments(id)
  );
`);

/*
 * Safe schema migration helper.
 * Existing databases are preserved.
 */
function ensureColumn(tableName, columnName, definition) {
  const columns = db
    .prepare(`PRAGMA table_info(${tableName})`)
    .all();

  const exists = columns.some(
    (column) => column.name === columnName
  );

  if (!exists) {
    db.exec(
      `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`
    );

    console.log(
      `Database migration: added ${tableName}.${columnName}`
    );
  }
}

/*
 * Existing local databases created before
 * authentication/payment plans need these columns.
 */
ensureColumn(
  'users',
  'password_hash',
  'TEXT'
);

ensureColumn(
  'users',
  'email_verified',
  'INTEGER NOT NULL DEFAULT 0'
);

ensureColumn(
  'payments',
  'plan_id',
  'TEXT'
);

ensureColumn(
  'payments',
  'user_id',
  'INTEGER'
);

/*
 * Default tools.
 */
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

/*
 * Default pricing plans.
 *
 * INSERT OR IGNORE prevents duplicate plans.
 */
const defaultPlans = [
  {
    plan_id: 'day-pass',
    name: '1-Day Pass',
    description: 'One tool ke liye 24-hour access.',
    price_paise: 200,
    duration_hours: 24,
    scope: 'tool',
  },
  {
    plan_id: 'weekly-pass',
    name: '7-Day Pass',
    description: 'One tool ke liye 7-day access.',
    price_paise: 900,
    duration_hours: 168,
    scope: 'tool',
  },
  {
    plan_id: 'monthly-tool',
    name: '30-Day Tool Pass',
    description: 'One tool ke liye 30-day access.',
    price_paise: 2900,
    duration_hours: 720,
    scope: 'tool',
  },
  {
    plan_id: 'all-tools-5h',
    name: '5-Hour All Tools Pass',
    description: 'Sabhi available tools ke liye 5-hour unlimited access.',
    price_paise: 500,
    duration_hours: 5,
    scope: 'all_tools',
  },
  {
    plan_id: 'all-tools-monthly',
    name: 'All Tools Pass',
    description: 'Sabhi available tools ke liye 30-day access.',
    price_paise: 4900,
    duration_hours: 720,
    scope: 'all_tools',
  },
];

const insertPlan = db.prepare(`
  INSERT OR IGNORE INTO pricing_plans (
    plan_id,
    name,
    description,
    price_paise,
    duration_hours,
    scope,
    active
  )
  VALUES (
    @plan_id,
    @name,
    @description,
    @price_paise,
    @duration_hours,
    @scope,
    1
  )
`);

const insertManyPlans = db.transaction((items) => {
  for (const item of items) {
    insertPlan.run(item);
  }
});

insertManyPlans(defaultPlans);

/*
 * Helpful indexes.
 */
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_payments_user_id
  ON payments(user_id);

  CREATE INDEX IF NOT EXISTS idx_payments_plan_id
  ON payments(plan_id);

  CREATE INDEX IF NOT EXISTS idx_user_access_user_id
  ON user_access(user_id);

  CREATE INDEX IF NOT EXISTS idx_user_access_expires_at
  ON user_access(expires_at);

  CREATE INDEX IF NOT EXISTS idx_downloads_user_id
  ON downloads(user_id);
`);

/*
 * Production admin bootstrap.
 *
 * Admin credentials are supplied through environment variables.
 * Password is never stored in source code or logged.
 */
const ADMIN_USERNAME = String(
  process.env.ADMIN_USERNAME || ''
).trim();

const ADMIN_PASSWORD = String(
  process.env.ADMIN_PASSWORD || ''
);

if (ADMIN_USERNAME && ADMIN_PASSWORD) {
  const existingAdmin = db.prepare(`
    SELECT id
    FROM admins
    WHERE username = ?
    LIMIT 1
  `).get(ADMIN_USERNAME);

  const passwordHash = bcrypt.hashSync(
    ADMIN_PASSWORD,
    12
  );

  if (existingAdmin) {
    db.prepare(`
      UPDATE admins
      SET
        password_hash = ?
      WHERE id = ?
    `).run(
      passwordHash,
      existingAdmin.id
    );

    console.log(
      `Admin credentials synchronized for username: ${ADMIN_USERNAME}`
    );
  } else {
    db.prepare(`
      INSERT INTO admins (
        username,
        password_hash
      )
      VALUES (?, ?)
    `).run(
      ADMIN_USERNAME,
      passwordHash
    );

    console.log(
      `Admin account created for username: ${ADMIN_USERNAME}`
    );
  }
}

console.log('Database initialization/migration complete.');

export default db;
