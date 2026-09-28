import { useEffect, useMemo, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: '?' },
  { id: 'users', label: 'Users', icon: '?' },
  { id: 'payments', label: 'Payments', icon: '?' },
  { id: 'access', label: 'Active Access', icon: '?' },
  { id: 'tools', label: 'Tools', icon: '?' },
  { id: 'settings', label: 'Settings', icon: '?' },
];

export default function Admin() {
  const [token, setToken] = useState(
    () => localStorage.getItem('smr_admin_token') || ''
  );

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [activePage, setActivePage] = useState('dashboard');

  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [error, setError] = useState('');

  async function apiFetch(path, options = {}, authToken = token) {
    const headers = {
      ...(options.headers || {}),
      Authorization: `Bearer ${authToken}`,
    };

    const response = await fetch(
      `${API_BASE}${path}`,
      {
        ...options,
        headers,
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data?.error || 'Admin request failed.'
      );
    }

    return data;
  }

  async function loadOverview(authToken = token) {
    if (!authToken) return;

    setLoading(true);
    setError('');

    try {
      const data = await apiFetch(
        '/api/admin/overview',
        {},
        authToken
      );

      setOverview(data);
    } catch (err) {
      setError(
        err.message ||
          'Dashboard data load nahi ho paya.'
      );

      if (
        /authentication|token|unauthorized|forbidden/i.test(
          err.message || ''
        )
      ) {
        localStorage.removeItem('smr_admin_token');
        setToken('');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) {
      loadOverview(token);
    }
  }, [token]);

  async function handleLogin(event) {
    event.preventDefault();

    setLoginLoading(true);
    setError('');

    try {
      const response = await fetch(
        `${API_BASE}/api/admin/login`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username,
            password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || 'Invalid admin credentials.'
        );
      }

      localStorage.setItem(
        'smr_admin_token',
        data.token
      );

      setToken(data.token);
      setPassword('');
    } catch (err) {
      setError(
        err.message || 'Admin login failed.'
      );
    } finally {
      setLoginLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem('smr_admin_token');
    setToken('');
    setOverview(null);
    setUsername('');
    setPassword('');
    setActivePage('dashboard');
  }

  if (!token) {
    return (
      <div style={styles.loginPage}>
        <div style={styles.loginCard}>
          <div style={styles.logo}>SMR</div>

          <h1 style={styles.loginTitle}>
            Admin Panel
          </h1>

          <p style={styles.loginSubtitle}>
            Private administrator login
          </p>

          <form onSubmit={handleLogin}>
            <label style={styles.label}>
              Username
            </label>

            <input
              type="text"
              value={username}
              onChange={(e) =>
                setUsername(e.target.value)
              }
              placeholder="Admin username"
              autoComplete="username"
              style={styles.input}
              required
            />

            <label style={styles.label}>
              Password
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              placeholder="Admin password"
              autoComplete="current-password"
              style={styles.input}
              required
            />

            {error && (
              <div style={styles.error}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loginLoading}
              style={styles.loginButton}
            >
              {loginLoading
                ? 'Logging in...'
                : 'Login as Admin'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const stats = overview?.stats || {
    totalUsers: 0,
    totalPayments: 0,
    verifiedPayments: 0,
    pendingPayments: 0,
    failedPayments: 0,
    activeAccess: 0,
    revenuePaise: 0,
  };

  const users = overview?.recentUsers || [];
  const payments = overview?.recentPayments || [];
  const access = overview?.access || [];

  const revenue =
    Number(stats.revenuePaise || 0) / 100;

  return (
    <div style={styles.app}>
      <aside style={styles.sidebar}>
        <div style={styles.sidebarBrand}>
          <div style={styles.logoSmall}>SMR</div>

          <div>
            <div style={styles.brandTitle}>
              SMR Form Tools
            </div>

            <div style={styles.brandSub}>
              Admin Control Center
            </div>
          </div>
        </div>

        <nav style={styles.nav}>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() =>
                setActivePage(item.id)
              }
              style={{
                ...styles.navButton,
                ...(activePage === item.id
                  ? styles.navButtonActive
                  : {}),
              }}
            >
              <span style={styles.navIcon}>
                {item.icon}
              </span>

              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div style={styles.sidebarBottom}>
          <div style={styles.privateBadge}>
            PRIVATE ADMIN
          </div>

          <button
            onClick={handleLogout}
            style={styles.sidebarLogout}
          >
            Logout
          </button>
        </div>
      </aside>

      <div style={styles.contentArea}>
        <header style={styles.topbar}>
          <div>
            <div style={styles.topTitle}>
              {pageTitle(activePage)}
            </div>

            <div style={styles.topSubtitle}>
              SMR Form Tools administration
            </div>
          </div>

          <div style={styles.topActions}>
            <button
              onClick={() => loadOverview()}
              disabled={loading}
              style={styles.refreshButton}
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </header>

        <main style={styles.main}>
          {error && (
            <div style={styles.error}>
              {error}
            </div>
          )}

          {activePage === 'dashboard' && (
            <Dashboard
              stats={stats}
              revenue={revenue}
              payments={payments}
              users={users}
              access={access}
              loading={loading}
            />
          )}

          {activePage === 'users' && (
            <UsersPage users={users} />
          )}

          {activePage === 'payments' && (
            <PaymentsPage payments={payments} />
          )}

          {activePage === 'access' && (
            <AccessPage access={access} />
          )}

          {activePage === 'tools' && (
            <ToolsPage />
          )}

          {activePage === 'settings' && (
            <SettingsPage />
          )}
        </main>
      </div>
    </div>
  );
}

function Dashboard({
  stats,
  revenue,
  payments,
  users,
  access,
  loading,
}) {
  return (
    <>
      <div style={styles.welcome}>
        <div>
          <h1 style={styles.pageHeading}>
            Dashboard
          </h1>

          <p style={styles.pageDescription}>
            Website business aur user activity ka
            complete overview.
          </p>
        </div>

        <div style={styles.liveBadge}>
          ? Admin Protected
        </div>
      </div>

      <div style={styles.statsGrid}>
        <StatCard
          title="Total Users"
          value={stats.totalUsers}
          icon="?"
        />

        <StatCard
          title="Total Payments"
          value={stats.totalPayments}
          icon="?"
        />

        <StatCard
          title="Verified Payments"
          value={stats.verifiedPayments}
          icon="?"
        />

        <StatCard
          title="Pending Payments"
          value={stats.pendingPayments}
          icon="?"
        />

        <StatCard
          title="Failed Payments"
          value={stats.failedPayments}
          icon="!"
        />

        <StatCard
          title="Active Access"
          value={stats.activeAccess}
          icon="?"
        />

        <StatCard
          title="Revenue"
          value={`?${revenue.toFixed(2)}`}
          icon="?"
          wide
        />
      </div>

      <div style={styles.twoColumn}>
        <section style={styles.card}>
          <CardHeader
            title="Recent Payments"
            subtitle="Latest payment activity"
          />

          <PaymentsTable
            payments={payments.slice(0, 8)}
          />
        </section>

        <section style={styles.card}>
          <CardHeader
            title="Recent Users"
            subtitle="Latest registered users"
          />

          <UsersTable
            users={users.slice(0, 8)}
          />
        </section>
      </div>

      <section style={styles.card}>
        <CardHeader
          title="Active Access"
          subtitle="Current tool access records"
        />

        <AccessTable
          access={access.slice(0, 8)}
        />
      </section>

      {loading && (
        <div style={styles.loadingBar}>
          Dashboard data refreshing...
        </div>
      )}
    </>
  );
}

function UsersPage({ users }) {
  return (
    <>
      <PageIntro
        title="Users"
        description="Registered users aur verification status."
      />

      <section style={styles.card}>
        <CardHeader
          title="Registered Users"
          subtitle={`${users.length} recent records`}
        />

        <UsersTable
          users={users}
          detailed
        />
      </section>
    </>
  );
}

function PaymentsPage({ payments }) {
  return (
    <>
      <PageIntro
        title="Payments"
        description="Razorpay payment records aur transaction status."
      />

      <section style={styles.card}>
        <CardHeader
          title="Payment Transactions"
          subtitle={`${payments.length} recent records`}
        />

        <PaymentsTable
          payments={payments}
          detailed
        />
      </section>
    </>
  );
}

function AccessPage({ access }) {
  return (
    <>
      <PageIntro
        title="Active Access"
        description="Users ko diye gaye tool aur plan access."
      />

      <section style={styles.card}>
        <CardHeader
          title="Access Records"
          subtitle={`${access.length} recent records`}
        />

        <AccessTable
          access={access}
          detailed
        />
      </section>
    </>
  );
}

function ToolsPage() {
  const tools = [
    {
      id: 'photo-compressor',
      name: 'Photo KB Compressor',
      description:
        'Photo ko required KB size mein compress karo.',
    },
    {
      id: 'image-resize',
      name: 'Image Resize',
      description:
        'Image ka exact width aur height set karke resize karo.',
    },
    {
      id: 'signature-resize',
      name: 'Signature Resize',
      description:
        'Signature ko required size mein resize karo.',
    },
    {
      id: 'jpg-to-pdf',
      name: 'JPG to PDF',
      description:
        'JPG images ko PDF mein convert karo.',
    },
    {
      id: 'pdf-compress',
      name: 'PDF Compress',
      description:
        'PDF file ka size reduce karo.',
    },
    {
      id: 'passport-photo',
      name: 'Passport Photo',
      description:
        'Passport/form ke liye photo ready karo.',
    },
  ];

  return (
    <>
      <PageIntro
        title="Tools"
        description="SMR Form Tools ke available tools."
      />

      <div style={styles.toolsGrid}>
        {tools.map((tool) => (
          <div
            key={tool.id}
            style={styles.toolCard}
          >
            <div style={styles.toolIcon}>
              ?
            </div>

            <div style={styles.toolName}>
              {tool.name}
            </div>

            <div style={styles.toolDescription}>
              {tool.description}
            </div>

            <div style={styles.toolId}>
              {tool.id}
            </div>

            <span style={styles.activePill}>
              Active
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

function SettingsPage() {
  return (
    <>
      <PageIntro
        title="Settings"
        description="Admin panel configuration information."
      />

      <div style={styles.settingsGrid}>
        <section style={styles.card}>
          <CardHeader
            title="Admin Security"
            subtitle="Private administrator access"
          />

          <div style={styles.settingsBody}>
            <SettingRow
              label="Admin Route"
              value="/admin"
            />

            <SettingRow
              label="Authentication"
              value="JWT Protected"
            />

            <SettingRow
              label="Public Admin Link"
              value="Hidden"
            />

            <SettingRow
              label="Payment Data"
              value="Admin Only"
            />
          </div>
        </section>

        <section style={styles.card}>
          <CardHeader
            title="System"
            subtitle="SMR Form Tools"
          />

          <div style={styles.settingsBody}>
            <SettingRow
              label="Environment"
              value="Admin Console"
            />

            <SettingRow
              label="Payment Provider"
              value="Razorpay"
            />

            <SettingRow
              label="Currency"
              value="INR"
            />

            <SettingRow
              label="Access Control"
              value="Enabled"
            />
          </div>
        </section>
      </div>
    </>
  );
}

function PageIntro({ title, description }) {
  return (
    <div style={styles.pageIntro}>
      <div>
        <h1 style={styles.pageHeading}>
          {title}
        </h1>

        <p style={styles.pageDescription}>
          {description}
        </p>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  wide,
}) {
  return (
    <div
      style={{
        ...styles.statCard,
        ...(wide ? styles.statCardWide : {}),
      }}
    >
      <div style={styles.statTop}>
        <span style={styles.statTitle}>
          {title}
        </span>

        <span style={styles.statIcon}>
          {icon}
        </span>
      </div>

      <div style={styles.statValue}>
        {value}
      </div>
    </div>
  );
}

function CardHeader({ title, subtitle }) {
  return (
    <div style={styles.cardHeader}>
      <div>
        <h2 style={styles.cardTitle}>
          {title}
        </h2>

        <div style={styles.cardSubtitle}>
          {subtitle}
        </div>
      </div>
    </div>
  );
}

function UsersTable({ users, detailed }) {
  if (!users.length) {
    return (
      <EmptyState text="Abhi koi user record nahi mila." />
    );
  }

  return (
    <div style={styles.tableWrapper}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Name</th>
            <th style={styles.th}>Email</th>
            <th style={styles.th}>Verified</th>
            {detailed && (
              <th style={styles.th}>Registered</th>
            )}
          </tr>
        </thead>

        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td style={styles.td}>
                {user.name || '—'}
              </td>

              <td style={styles.td}>
                {user.email || '—'}
              </td>

              <td style={styles.td}>
                <StatusBadge
                  value={
                    Number(user.email_verified)
                      ? 'Verified'
                      : 'Unverified'
                  }
                  type={
                    Number(user.email_verified)
                      ? 'success'
                      : 'pending'
                  }
                />
              </td>

              {detailed && (
                <td style={styles.td}>
                  {user.created_at || '—'}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PaymentsTable({
  payments,
  detailed,
}) {
  if (!payments.length) {
    return (
      <EmptyState text="Abhi koi payment record nahi mila." />
    );
  }

  return (
    <div style={styles.tableWrapper}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>User</th>
            <th style={styles.th}>Tool</th>
            <th style={styles.th}>Plan</th>
            <th style={styles.th}>Amount</th>
            <th style={styles.th}>Status</th>

            {detailed && (
              <>
                <th style={styles.th}>
                  Order ID
                </th>

                <th style={styles.th}>
                  Payment ID
                </th>
              </>
            )}

            <th style={styles.th}>Date</th>
          </tr>
        </thead>

        <tbody>
          {payments.map((payment) => (
            <tr key={payment.id}>
              <td style={styles.td}>
                <div style={styles.userName}>
                  {payment.user_name || 'Guest'}
                </div>

                <div style={styles.userEmail}>
                  {payment.user_email || '—'}
                </div>
              </td>

              <td style={styles.td}>
                {payment.tool_id || '—'}
              </td>

              <td style={styles.td}>
                {payment.plan_id || '—'}
              </td>

              <td style={styles.td}>
                ?
                {(
                  Number(
                    payment.amount_paise || 0
                  ) / 100
                ).toFixed(2)}
              </td>

              <td style={styles.td}>
                <StatusBadge
                  value={formatStatus(payment.status)}
                  type={paymentStatusType(
                    payment.status
                  )}
                />
              </td>

              {detailed && (
                <>
                  <td style={styles.td}>
                    {payment.razorpay_order_id ||
                      '—'}
                  </td>

                  <td style={styles.td}>
                    {payment.razorpay_payment_id ||
                      '—'}
                  </td>
                </>
              )}

              <td style={styles.td}>
                {payment.created_at || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AccessTable({ access, detailed }) {
  if (!access.length) {
    return (
      <EmptyState text="Abhi koi access record nahi mila." />
    );
  }

  return (
    <div style={styles.tableWrapper}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>User</th>
            <th style={styles.th}>Tool</th>
            <th style={styles.th}>Plan</th>
            <th style={styles.th}>Start</th>
            <th style={styles.th}>Expiry</th>
            <th style={styles.th}>Status</th>
            {detailed && (
              <th style={styles.th}>Payment</th>
            )}
          </tr>
        </thead>

        <tbody>
          {access.map((item) => {
            const active =
              Number(item.active) === 1 &&
              new Date(item.expires_at) > new Date();

            return (
              <tr key={item.id}>
                <td style={styles.td}>
                  <div style={styles.userName}>
                    {item.user_name || 'Guest'}
                  </div>

                  <div style={styles.userEmail}>
                    {item.user_email || '—'}
                  </div>
                </td>

                <td style={styles.td}>
                  {item.tool_id || '—'}
                </td>

                <td style={styles.td}>
                  {item.plan_name ||
                    item.plan_id ||
                    '—'}
                </td>

                <td style={styles.td}>
                  {item.starts_at || '—'}
                </td>

                <td style={styles.td}>
                  {item.expires_at || '—'}
                </td>

                <td style={styles.td}>
                  <StatusBadge
                    value={
                      active ? 'Active' : 'Expired'
                    }
                    type={
                      active ? 'success' : 'failed'
                    }
                  />
                </td>

                {detailed && (
                  <td style={styles.td}>
                    {item.payment_id || '—'}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SettingRow({ label, value }) {
  return (
    <div style={styles.settingRow}>
      <span style={styles.settingLabel}>
        {label}
      </span>

      <span style={styles.settingValue}>
        {value}
      </span>
    </div>
  );
}

function StatusBadge({ value, type }) {
  return (
    <span
      style={{
        ...styles.status,
        ...(type === 'success'
          ? styles.statusSuccess
          : type === 'failed'
          ? styles.statusFailed
          : styles.statusPending),
      }}
    >
      {value}
    </span>
  );
}

function EmptyState({ text }) {
  return (
    <div style={styles.empty}>
      {text}
    </div>
  );
}

function formatStatus(status) {
  const value = String(
    status || ''
  ).toLowerCase();

  if (
    value === 'verified' ||
    value === 'paid'
  ) {
    return 'Successful';
  }

  if (
    value === 'pending' ||
    value === 'created'
  ) {
    return 'Pending';
  }

  if (value === 'failed') {
    return 'Failed';
  }

  return status || 'Unknown';
}

function paymentStatusType(status) {
  const value = String(
    status || ''
  ).toLowerCase();

  if (
    value === 'verified' ||
    value === 'paid'
  ) {
    return 'success';
  }

  if (value === 'failed') {
    return 'failed';
  }

  return 'pending';
}

function pageTitle(page) {
  const item = NAV_ITEMS.find(
    (nav) => nav.id === page
  );

  return item?.label || 'Dashboard';
}

const styles = {
  loginPage: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f3f5f9',
    padding: '24px',
    boxSizing: 'border-box',
  },

  loginCard: {
    width: '100%',
    maxWidth: '430px',
    background: '#ffffff',
    borderRadius: '20px',
    padding: '36px',
    boxShadow:
      '0 20px 60px rgba(15,23,42,0.12)',
    boxSizing: 'border-box',
  },

  logo: {
    width: '58px',
    height: '58px',
    borderRadius: '15px',
    background: '#111827',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '900',
    fontSize: '18px',
    marginBottom: '20px',
  },

  loginTitle: {
    margin: 0,
    fontSize: '30px',
    color: '#111827',
  },

  loginSubtitle: {
    margin:
      '8px 0 28px',
    color: '#6b7280',
  },

  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '700',
    margin:
      '17px 0 7px',
    color: '#374151',
  },

  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '13px 14px',
    border:
      '1px solid #d1d5db',
    borderRadius: '10px',
    fontSize: '15px',
    outline: 'none',
  },

  loginButton: {
    width: '100%',
    marginTop: '22px',
    padding: '14px',
    border: 0,
    borderRadius: '10px',
    background: '#111827',
    color: '#ffffff',
    fontWeight: '800',
    cursor: 'pointer',
  },

  error: {
    margin:
      '16px 0',
    padding: '12px 14px',
    borderRadius: '10px',
    background: '#fee2e2',
    color: '#991b1b',
    fontSize: '14px',
  },

  app: {
    minHeight: '100vh',
    display: 'flex',
    background: '#f5f7fb',
    color: '#111827',
  },

  sidebar: {
    width: '250px',
    minHeight: '100vh',
    background: '#111827',
    color: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },

  sidebarBrand: {
    padding: '24px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    borderBottom:
      '1px solid rgba(255,255,255,0.08)',
  },

  logoSmall: {
    width: '43px',
    height: '43px',
    borderRadius: '11px',
    background: '#ffffff',
    color: '#111827',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '900',
    fontSize: '14px',
  },

  brandTitle: {
    fontWeight: '800',
    fontSize: '15px',
  },

  brandSub: {
    marginTop: '3px',
    color: '#9ca3af',
    fontSize: '11px',
  },

  nav: {
    padding: '18px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
  },

  navButton: {
    width: '100%',
    border: 0,
    background: 'transparent',
    color: '#9ca3af',
    padding: '12px 13px',
    borderRadius: '9px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    textAlign: 'left',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },

  navButtonActive: {
    background: '#ffffff',
    color: '#111827',
  },

  navIcon: {
    width: '21px',
    textAlign: 'center',
    fontWeight: '800',
  },

  sidebarBottom: {
    marginTop: 'auto',
    padding: '18px',
    borderTop:
      '1px solid rgba(255,255,255,0.08)',
  },

  privateBadge: {
    fontSize: '10px',
    letterSpacing: '0.08em',
    color: '#9ca3af',
    marginBottom: '12px',
  },

  sidebarLogout: {
    width: '100%',
    padding: '10px',
    border:
      '1px solid rgba(255,255,255,0.18)',
    borderRadius: '8px',
    background: 'transparent',
    color: '#ffffff',
    cursor: 'pointer',
  },

  contentArea: {
    flex: 1,
    minWidth: 0,
  },

  topbar: {
    minHeight: '74px',
    background: '#ffffff',
    borderBottom:
      '1px solid #e5e7eb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 30px',
    boxSizing: 'border-box',
  },

  topTitle: {
    fontWeight: '800',
    fontSize: '19px',
  },

  topSubtitle: {
    marginTop: '3px',
    color: '#6b7280',
    fontSize: '12px',
  },

  topActions: {
    display: 'flex',
    gap: '10px',
  },

  refreshButton: {
    padding: '9px 15px',
    border:
      '1px solid #d1d5db',
    borderRadius: '8px',
    background: '#ffffff',
    fontWeight: '700',
    cursor: 'pointer',
  },

  main: {
    maxWidth: '1500px',
    margin: '0 auto',
    padding: '30px',
  },

  welcome: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '20px',
    marginBottom: '24px',
  },

  pageIntro: {
    marginBottom: '24px',
  },

  pageHeading: {
    margin: 0,
    fontSize: '30px',
    letterSpacing: '-0.02em',
  },

  pageDescription: {
    margin:
      '7px 0 0',
    color: '#6b7280',
    fontSize: '14px',
  },

  liveBadge: {
    padding: '8px 12px',
    borderRadius: '999px',
    background: '#ecfdf5',
    color: '#047857',
    fontSize: '12px',
    fontWeight: '800',
  },

  statsGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit,minmax(180px,1fr))',
    gap: '15px',
    marginBottom: '22px',
  },

  statCard: {
    background: '#ffffff',
    border:
      '1px solid #e5e7eb',
    borderRadius: '13px',
    padding: '19px',
  },

  statCardWide: {
    gridColumn:
      'span 1',
  },

  statTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  statTitle: {
    color: '#6b7280',
    fontSize: '13px',
    fontWeight: '700',
  },

  statIcon: {
    width: '29px',
    height: '29px',
    borderRadius: '8px',
    background: '#f3f4f6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '800',
  },

  statValue: {
    marginTop: '10px',
    fontSize: '25px',
    fontWeight: '900',
  },

  twoColumn: {
    display: 'grid',
    gridTemplateColumns:
      'minmax(0,1.4fr) minmax(0,1fr)',
    gap: '18px',
    marginBottom: '18px',
  },

  card: {
    background: '#ffffff',
    border:
      '1px solid #e5e7eb',
    borderRadius: '14px',
    overflow: 'hidden',
    marginBottom: '18px',
  },

  cardHeader: {
    padding: '18px 20px',
    borderBottom:
      '1px solid #edf0f3',
  },

  cardTitle: {
    margin: 0,
    fontSize: '17px',
    fontWeight: '800',
  },

  cardSubtitle: {
    marginTop: '4px',
    color: '#6b7280',
    fontSize: '12px',
  },

  tableWrapper: {
    width: '100%',
    overflowX: 'auto',
  },

  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: '850px',
  },

  th: {
    textAlign: 'left',
    padding: '12px 15px',
    background: '#f9fafb',
    borderBottom:
      '1px solid #e5e7eb',
    color: '#6b7280',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    whiteSpace: 'nowrap',
  },

  td: {
    padding: '13px 15px',
    borderBottom:
      '1px solid #f0f2f4',
    fontSize: '13px',
    whiteSpace: 'nowrap',
  },

  userName: {
    fontWeight: '700',
  },

  userEmail: {
    marginTop: '2px',
    color: '#6b7280',
    fontSize: '11px',
  },

  status: {
    display: 'inline-flex',
    padding: '4px 8px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: '800',
  },

  statusSuccess: {
    background: '#dcfce7',
    color: '#166534',
  },

  statusPending: {
    background: '#fef3c7',
    color: '#92400e',
  },

  statusFailed: {
    background: '#fee2e2',
    color: '#991b1b',
  },

  empty: {
    padding: '32px 20px',
    textAlign: 'center',
    color: '#6b7280',
    fontSize: '13px',
  },

  loadingBar: {
    position: 'fixed',
    bottom: '18px',
    right: '18px',
    padding: '10px 14px',
    background: '#111827',
    color: '#ffffff',
    borderRadius: '9px',
    fontSize: '12px',
    boxShadow:
      '0 8px 25px rgba(0,0,0,0.18)',
  },

  toolsGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit,minmax(250px,1fr))',
    gap: '16px',
  },

  toolCard: {
    background: '#ffffff',
    border:
      '1px solid #e5e7eb',
    borderRadius: '14px',
    padding: '20px',
    position: 'relative',
  },

  toolIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    background: '#f3f4f6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '14px',
  },

  toolName: {
    fontSize: '16px',
    fontWeight: '800',
  },

  toolDescription: {
    marginTop: '7px',
    color: '#6b7280',
    fontSize: '13px',
    lineHeight: 1.5,
  },

  toolId: {
    marginTop: '14px',
    fontSize: '11px',
    color: '#9ca3af',
    fontFamily: 'monospace',
  },

  activePill: {
    position: 'absolute',
    top: '18px',
    right: '18px',
    padding: '4px 8px',
    borderRadius: '999px',
    background: '#dcfce7',
    color: '#166534',
    fontSize: '10px',
    fontWeight: '800',
  },

  settingsGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit,minmax(320px,1fr))',
    gap: '18px',
  },

  settingsBody: {
    padding: '5px 20px 15px',
  },

  settingRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '20px',
    padding: '15px 0',
    borderBottom:
      '1px solid #f0f2f4',
  },

  settingLabel: {
    color: '#6b7280',
    fontSize: '13px',
  },

  settingValue: {
    fontWeight: '700',
    fontSize: '13px',
  },
};
