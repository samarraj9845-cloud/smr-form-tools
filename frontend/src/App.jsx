import React, { useEffect, useMemo, useRef, useState } from 'react';
import Privacy from './Privacy';
import Terms from './Terms';
import Contact from './Contact';
import ImageResize from './ImageResize';
import SignatureResize from './SignatureResize';
import Admin from './Admin';
import axios from 'axios';
import AdSlot from './AdSlot';
import { hasRewardedAdConfig } from './rewardedAds';
import {
  checkToolAccess as fetchToolAccess,
  createToolOrder,
  verifyToolPayment,
} from './toolAccess';
import {
  authHeaders,
  getCurrentUser,
  getAuthToken,
 login,
loginWithGoogle,
register,
  logout
} from './auth';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';
const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID || '';
const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

const tools = [
  {
    name: 'Photo KB Compressor',
    description: 'Photo ko required KB size mein compress karo.',
    href: '/',
    available: true,
  },
  {
    name: 'Image Resize',
    description: 'Image ka exact width aur height set karke resize karo.',
    href: '/resize',
    available: true,
  },
  {
    name: 'Signature Resize',
    description: 'Signature ko required size mein resize karo.',
    href: '/signature-resize',
    available: true,
  },
  {
    name: 'JPG to PDF',
    description: 'JPG images ko PDF mein convert karo.',
    href: '/jpg-to-pdf',
    available: false,
  },
  {
    name: 'PDF Compress',
    description: 'PDF file ka size reduce karo.',
    href: '/pdf-compress',
    available: false,
  },
  {
    name: 'Passport Photo',
    description: 'Passport/form ke liye photo ready karo.',
    href: '/passport-photo',
    available: false,
  },
];

async function loadRazorpay() {
  if (window.Razorpay) return true;

  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = resolve;
    script.onerror = reject;
    document.body.appendChild(script);
  });

  return true;
}

async function processImage(file, targetKb, maxWidth, maxHeight) {
  const bitmap = await createImageBitmap(file);

  let width = bitmap.width;
  let height = bitmap.height;

  const ratio = Math.min(
    1,
    maxWidth / width,
    maxHeight / height
  );

  width = Math.round(width * ratio);
  height = Math.round(height * ratio);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d', { alpha: false });

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);

  const targetBytes = targetKb * 1024;

  let lo = 0.05;
  let hi = 0.95;
  let bestBlob = null;

  for (let i = 0; i < 9; i++) {
    const q = (lo + hi) / 2;

    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', q);
    });

    if (!blob) {
      throw new Error('Browser could not create an image.');
    }

    if (blob.size <= targetBytes) {
      bestBlob = blob;
      lo = q;
    } else {
      hi = q;
    }
  }

  if (!bestBlob) {
    bestBlob = await new Promise((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.45);
    });
  }

  const url = URL.createObjectURL(bestBlob);

  return {
    blob: bestBlob,
    url,
    width,
    height,
  };
}

function App() {
  const [file, setFile] = useState(null);
  const [targetKb, setTargetKb] = useState(50);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('day-pass');
  const [selectedToolId, setSelectedToolId] = useState(() => {
  const params = new URLSearchParams(window.location.search);
  const tool = params.get('tool');
  
  if (tool === 'image-resize') return 'image-resize';
  if (tool === 'signature-resize') return 'signature-resize';

  return 'photo-compressor';
});

  const googleButtonRef = useRef(null);

  const [adAvailable, setAdAvailable] = useState(
    hasRewardedAdConfig()
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const openPricing = params.get('pricing') === '1';

    if (!openPricing) {
      return;
    }

    const timer = window.setTimeout(() => {
      const pricingSection = document.getElementById('pricing');

      if (pricingSection) {
        pricingSection.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }
    }, 100);

    return () => window.clearTimeout(timer);
  }, []);
  const [authMode, setAuthMode] = useState('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authName, setAuthName] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

useEffect(() => {
  if (!GOOGLE_CLIENT_ID) {
    return;
  }

  const renderGoogleButton = () => {
    if (!window.google?.accounts?.id || !googleButtonRef.current) {
      return;
    }

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCredential,
    });

    googleButtonRef.current.innerHTML = '';

    window.google.accounts.id.renderButton(
      googleButtonRef.current,
      {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        width: 360,
      }
    );
  };

  const loadGoogleScript = () => {
    if (window.google?.accounts?.id) {
      renderGoogleButton();
      return;
    }

    const existingScript = document.querySelector(
      'script[src="https://accounts.google.com/gsi/client"]'
    );

    if (existingScript) {
      existingScript.addEventListener('load', renderGoogleButton, {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');

    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = renderGoogleButton;

    document.head.appendChild(script);
  };

  const timer = window.setTimeout(loadGoogleScript, 0);

  return () => {
    window.clearTimeout(timer);
  };
}, [GOOGLE_CLIENT_ID, authMode]);
useEffect(() => {
  let mounted = true;
    async function loadUser() {
      try {
        if (!getAuthToken()) {
          return;
        }

        const user = await getCurrentUser();

        if (mounted) {
          setCurrentUser(user);
        }
      } finally {
        if (mounted) {
          setAuthLoading(false);
        }
      }
    }

    loadUser();

    return () => {
      mounted = false;
    };
  }, []);

  async function handleGoogleCredential(response) {
  if (!response?.credential) {
    setMessage('Google login credential nahi mila.');
    return;
  }

  setBusy(true);
  setMessage('');

  try {
    const data = await loginWithGoogle(
      response.credential
    );

    setCurrentUser(data.user || null);
    setMessage('Google login successful.');
  } catch (err) {
    setMessage(
      err.response?.data?.error ||
      err.message ||
      'Google login failed.'
    );
  } finally {
    setBusy(false);
  }
}

  async function handleAuthSubmit(e) {
    e.preventDefault();

    const email = authEmail.trim();
    const password = authPassword;

    if (!email) {
      setMessage('Email enter karo.');
      return;
    }

    if (!password) {
      setMessage('Password enter karo.');
      return;
    }

    if (authMode === 'register' && !authName.trim()) {
      setMessage('Name enter karo.');
      return;
    }

    if (password.length < 8) {
      setMessage(
        'Password kam se kam 8 characters ka hona chahiye.'
      );
      return;
    }

    setAuthBusy(true);
    setMessage('');

    try {
      const data =
        authMode === 'login'
          ? await login(email, password)
          : await register(
              email,
              password,
              authName.trim()
            );

      setCurrentUser(data.user || null);
      setAuthPassword('');

      if (authMode === 'login') {
        const access = await checkToolAccess();

        if (access.hasAccess) {
          setMessage(
            `${access.planName || 'Active plan'} active hai.`
          );
        } else {
          setMessage('Login successful.');
        }
      } else {
        setMessage('Account create ho gaya.');
      }
    } catch (err) {
      setMessage(
        err.response?.data?.error ||
        err.message ||
        'Authentication failed.'
      );
    } finally {
      setAuthBusy(false);
    }
  }

  function handleLogout() {
    logout();
    setCurrentUser(null);
    setMessage('Logout successful.');
  }

  const targetLabel = useMemo(
    () => `${targetKb} KB`,
    [targetKb]
  );

  const filteredTools = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    if (!query) return tools;

    return tools.filter((tool) =>
      `${tool.name} ${tool.description}`
        .toLowerCase()
        .includes(query)
    );
  }, [searchTerm]);

  async function checkToolAccess(toolId = 'photo-compressor') {
    if (!getAuthToken()) {
      return {
        hasAccess: false,
        accessType: null,
        planId: null,
        planName: null,
        expiresAt: null,
        remainingMinutes: 0,
      };
    }

    try {
      const data = await fetchToolAccess(toolId);
      return data;
    } catch (error) {
      console.error('TOOL ACCESS CHECK ERROR:', error);
      return {
        hasAccess: false,
        accessType: null,
        planId: null,
        planName: null,
        expiresAt: null,
        remainingMinutes: 0,
      };
    }
  }

  async function handleProcess(e) {
    e.preventDefault();

    if (!file) {
      setMessage('Pehle photo select karo.');
      return;
    }

    setBusy(true);
    setMessage('Photo process ho rahi hai...');
    setUnlocked(false);
    setResult(null);

    try {
      const output = await processImage(
        file,
        targetKb,
        1600,
        1600
      );

      setResult(output);

      const access = await checkToolAccess();

      if (access.hasAccess) {
        setUnlocked(true);

        setMessage(
          `${access.planName || 'Active plan'} active hai. Download unlocked.`
        );
      } else {
        setUnlocked(false);

        setMessage(
          `Ready: ${(output.blob.size / 1024).toFixed(1)} KB`
        );
      }

      setAdAvailable(hasRewardedAdConfig());
    } catch (err) {
      setMessage(
        err.message || 'Processing failed.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function payToUnlock(planId = 'day-pass', toolId = selectedToolId) {
    setMessage('Payment checkout open kar rahe hain...');

    try {
      if (!getAuthToken()) {
        setMessage(
          'Payment ke liye pehle login karna zaroori hai.'
        );
        return;
      }

      if (!RAZORPAY_KEY_ID) {
        throw new Error(
          'Razorpay key set nahi hai.'
        );
      }

      await loadRazorpay();

      const order = await createToolOrder(
        toolId,
        planId,
        'plan_purchase'
      );

      const options = {
        key: RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: 'SMR Form Tools',
        description:
          `${order.planName || order.toolName || 'Photo KB Compressor'}`,
        order_id: order.id,

        handler: async (response) => {
          try {
            const verified =
              await verifyToolPayment(response);

            if (verified.ok) {
              setUnlocked(true);
              setMessage(
                'Payment verified. Download unlocked.'
              );

              const pricingMode =
                new URLSearchParams(window.location.search).get('pricing') === '1';

              if (pricingMode && window.history.length > 1) {
                window.setTimeout(() => {
                  window.history.back();
                }, 300);
              }
            } else {
              setMessage(
                'Payment verify nahi hua.'
              );
            }
          } catch (err) {
            setMessage(
              err.response?.data?.error ||
              'Payment verification failed.'
            );
          }
        },

        theme: {
          color: '#111827',
        },
      };

      const rzp =
        new window.Razorpay(options);

      rzp.on(
        'payment.failed',
        function (response) {
          console.error(
            'RAZORPAY PAYMENT FAILED:',
            response.error
          );

          setMessage(
            `Payment failed: ${
              response.error?.code ||
              'unknown'
            } - ${
              response.error?.description ||
              'Unknown Razorpay error'
            }`
          );
        }
      );

      rzp.on(
        'modal.closed',
        function () {
          console.log(
            'Razorpay modal closed'
          );
        }
      );

      rzp.open();
    } catch (err) {
      setMessage(
        err.response?.data?.error ||
        err.message ||
        'Payment error.'
      );
    }
  }

  async function watchAdToUnlock() {
    setMessage('Rewarded ad start ho raha hai...');

    if (
      typeof window.smrShowRewardedAd ===
      'function'
    ) {
      window.smrShowRewardedAd(() => {
        setUnlocked(true);
        setMessage(
          'Ad complete. Download unlocked.'
        );
      });

      return;
    }

    setMessage(
      'Rewarded Ad abhi configured nahi hai.'
    );
  }

  function download() {
    if (!result || !unlocked) return;

    const a = document.createElement('a');
    a.href = result.url;
    a.download =
      `smr-form-tools-${targetKb}kb.jpg`;

    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  if (window.location.pathname === '/admin') {
    return <Admin />;
  }

  if (window.location.pathname === '/privacy') {
    return <Privacy />;
  }

  if (window.location.pathname === '/terms') {
    return <Terms />;
  }

  if (window.location.pathname === '/contact') {
    return <Contact />;
  }
  const currentPath = window.location.pathname;
  const currentParams = new URLSearchParams(window.location.search);
  const currentTool = currentParams.get('tool');
  const openPricing = currentParams.get('pricing') === '1';

  if (
    !openPricing &&
    (
      currentPath === '/resize' ||
      currentTool === 'image-resize'
    )
  ) {
    return <ImageResize />;
  }

  if (
    !openPricing &&
    (
      currentPath === '/signature-resize' ||
      currentTool === 'signature-resize'
    )
  ) {
    return <SignatureResize />;
  }

  return (
    <div className="page">
      <header className="header">
        <div className="brand">
          <div className="logo">SMR</div>

          <div>
            <strong>Form Tools</strong>
            <span>
              Simple tools for online forms
            </span>
          </div>
        </div>

        <div className="header-actions">
          <a
            className="navlink"
            href="#pricing"
          >
            Pricing
          </a>

          {!authLoading && currentUser ? (
            <>
              <span className="user-badge">
                {currentUser.name || currentUser.email}
              </span>

              <button
                type="button"
                className="navlink button-link"
                onClick={handleLogout}
              >
                Logout
              </button>
            </>
          ) : !authLoading ? (
            <>
              <button
                type="button"
                className="navlink button-link"
                onClick={() => {
                  setAuthMode('login');
                  setMessage('');
                  window.location.hash = 'auth';
                }}
              >
                Login
              </button>

              <button
                type="button"
                className="navlink button-link"
                onClick={() => {
                  setAuthMode('register');
                  setMessage('');
                  window.location.hash = 'auth';
                }}
              >
                Create Account
              </button>
            </>
          ) : null}
        </div>
      </header>

      <main>
        {!authLoading && !currentUser && (
          <section
            id="auth"
            className="card auth-card"
          >
            <div className="auth-header">
              <p className="eyebrow">
                SMR ACCOUNT
              </p>

              <h2>
                {authMode === 'login'
                  ? 'Login karo'
                  : 'Account create karo'}
              </h2>

              <p>
                {authMode === 'login'
                  ? 'Apne account se login karke paid plans aur downloads use karo.'
                  : 'Free account banao aur apne tool access ko manage karo.'}
              </p>
            </div>

            <form onSubmit={handleAuthSubmit}>
              {authMode === 'register' && (
                <label className="field">
                  <span>Name</span>

                  <input
                    type="text"
                    value={authName}
                    onChange={(e) =>
                      setAuthName(e.target.value)
                    }
                    placeholder="Apna naam"
                    autoComplete="name"
                  />
                </label>
              )}

              <label className="field">
                <span>Email</span>

                <input
                  type="email"
                  value={authEmail}
                  onChange={(e) =>
                    setAuthEmail(e.target.value)
                  }
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </label>

              <label className="field">
                <span>Password</span>

                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) =>
                    setAuthPassword(e.target.value)
                  }
                  placeholder="Minimum 8 characters"
                  autoComplete={
                    authMode === 'login'
                      ? 'current-password'
                      : 'new-password'
                  }
                  required
                />
              </label>

{GOOGLE_CLIENT_ID && (
  <>
    <div className="google-login-divider">
      <span>OR</span>
    </div>

    <div
      ref={googleButtonRef}
      className="google-login-button"
    />
  </>
)}

              <button
                type="submit"
                className="primary-button"
                disabled={authBusy}
              >
                {authBusy
                  ? 'Please wait...'
                  : authMode === 'login'
                    ? 'Login'
                    : 'Create Account'}
              </button>
            </form>

            <div className="auth-switch">
              <span>
                {authMode === 'login'
                  ? 'Account nahi hai?'
                  : 'Already account hai?'}
              </span>

              <button
                type="button"
                className="button-link"
                onClick={() => {
                  setAuthMode(
                    authMode === 'login'
                      ? 'register'
                      : 'login'
                  );
                  setMessage('');
                }}
              >
                {authMode === 'login'
                  ? 'Create Account'
                  : 'Login'}
              </button>
            </div>

            {message && (
              <p className="auth-message">
                {message}
              </p>
            )}
          </section>
        )}

        <AdSlot
          slot="7218418497"
          format="auto"
          responsive={true}
        />

        <section className="hero">
          <div>
            <p className="eyebrow">
              INDIA FORM TOOLKIT
            </p>

            <h1>
              Photo ko required KB mein ready
              karo.
            </h1>

            <p className="lead">
              Upload &rarr; automatic
              resize/compress &rarr; download.
              Payment ke bina bhi option
              rahega: supported rewarded ad
              complete karke unlock.
            </p>
          </div>

          <div className="card tool-card">
            <form onSubmit={handleProcess}>
              <label className="field">
                <span>Target size</span>

                <select
                  value={targetKb}
                  onChange={(e) =>
                    setTargetKb(
                      Number(e.target.value)
                    )
                  }
                >
                  {[20, 30, 50, 75, 100, 150, 200]
                    .map((v) => (
                      <option
                        key={v}
                        value={v}
                      >
                        {v} KB
                      </option>
                    ))}
                </select>
              </label>

              <label className="dropzone">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    setFile(
                      e.target.files?.[0] ||
                      null
                    )
                  }
                />

                <div className="drop-title">
                  {file
                    ? file.name
                    : 'Photo select karo'}
                </div>

                <div className="drop-sub">
                  JPG / PNG &bull; browser mein
                  process hoga
                </div>
              </label>

              <button
                className="primary"
                disabled={busy}
              >
                {busy
                  ? 'Processing&hellip;'
                  : `Make ${targetLabel}`}
              </button>
            </form>

            {result && (
              <div className="unlock-box">
                <div className="ready">
                  <span>&#10003;</span> {message}
                </div>

                {!unlocked && (
                  <>
                    <p>
                      Download ke liye ek
                      option choose karo:
                    </p>

                    <div className="unlock-actions">
                      <button
                        className="secondary"
                        onClick={
                          watchAdToUnlock
                        }
                      >
                        Watch Ad & Get Free
                        Download
                      </button>

                      <button
                        className="secondary"
                        onClick={
                          payToUnlock
                        }
                      >
                        Pay & Download
                      </button>
                    </div>
                  </>
                )}

                <button
                  className="download"
                  disabled={!unlocked}
                  onClick={download}
                >
                  {unlocked
                    ? 'Download JPG'
                    : 'Download locked'}
                </button>
              </div>
            )}

            {message && !result && (
              <p className="message">
                {message}
              </p>
            )}
          </div>
        </section>

        <section className="tools-search">
          <input
            type="search"
            value={searchTerm}
            onChange={(e) =>
              setSearchTerm(e.target.value)
            }
            placeholder="Search tools..."
            aria-label="Search tools"
          />
        </section>

        <section className="tools-section">
          <div className="tools-heading">
            <p className="eyebrow">
              ALL TOOLS
            </p>

            <h2>
              Online Form Tools
            </h2>

            <p>
              Photo, image aur document ke
              useful tools ek hi jagah.
            </p>
          </div>

          <div className="tools-grid">
            {filteredTools.length > 0 ? (
              filteredTools.map((tool) => (
                <div
                  className="tool-item"
                  key={tool.name}
                >
                  <h3>{tool.name}</h3>

                  <p>
                    {tool.description}
                  </p>

                  {tool.available ? (
                    <a
                      className="tool-link"
                      href={tool.href}
                    >
                      Open Tool &rarr;
                    </a>
                  ) : (
                    <span className="tool-coming-soon">
                      Coming Soon
                    </span>
                  )}
                </div>
              ))
            ) : (
              <div className="no-tools">
                <h3>
                  No tool found
                </h3>

                <p>
                  Dusra keyword search
                  karke dekho.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="features">
          <div>
            <b>Client-side first</b>
            <span>
              Image processing browser
              mein, V1 mein AI API ki
              zarurat nahi.
            </span>
          </div>

          <div>
            <b>Pay or Reward</b>
            <span>
              User paid unlock ya
              eligible rewarded ad route
              choose kar sakta hai.
            </span>
          </div>

          <div>
            <b>Razorpay ready</b>
            <span>
              Backend order creation +
              signature verification
              included.
            </span>
          </div>
        </section>

        <section
          id="pricing"
          className="pricing"
        >
          <h2>
            Choose Your Plan
          </h2>

          <p>
            Free mein rewarded ad se 1 file unlock karo,
            ya unlimited files ke liye plan choose karo.
          </p>

          <div className="plans">

            <div className="plan">
              <h3>
                Free
              </h3>

              <p>
                1 file unlock
                <br />
                Rewarded Ad complete karo.
              </p>

              <span>&#8377;0</span>

              <button
                type="button"
                disabled={!adAvailable}
                onClick={watchAdToUnlock}
              >
                {adAvailable
                  ? 'Watch Ad & Unlock'
                  : 'Ad Not Available'}
              </button>
            </div>

            <div
              className={`plan ${
                selectedPlan === 'day-pass'
                  ? 'featured'
                  : ''
              }`}
            >
              <h3>
                1-Day Pass
              </h3>

              <p>
                24 hours
                <br />
                Unlimited files
                <br />
                1 selected tool
              </p>

              <span>&#8377;2</span>

              <button
                type="button"
                className="primary"
                onClick={() => {
                  setSelectedPlan('day-pass');
                  payToUnlock('day-pass');
                }}
              >
                Buy for &#8377;2
              </button>
            </div>

            <div
              className={`plan ${
                selectedPlan === 'weekly-pass'
                  ? 'featured'
                  : ''
              }`}
            >
              <h3>
                7-Day Pass
              </h3>

              <p>
                7 days
                <br />
                Unlimited files
                <br />
                1 selected tool
              </p>

              <span>&#8377;9</span>

              <button
                type="button"
                className="primary"
                onClick={() => {
                  setSelectedPlan('weekly-pass');
                  payToUnlock('weekly-pass');
                }}
              >
                Buy for &#8377;9
              </button>
            </div>

            <div
              className={`plan ${
                selectedPlan === 'monthly-tool'
                  ? 'featured'
                  : ''
              }`}
            >
              <h3>
                30-Day Tool Pass
              </h3>

              <p>
                30 days
                <br />
                Unlimited files
                <br />
                1 selected tool
              </p>

              <span>&#8377;29</span>

              <button
                type="button"
                className="primary"
                onClick={() => {
                  setSelectedPlan('monthly-tool');
                  payToUnlock('monthly-tool');
                }}
              >
                Buy for &#8377;29
              </button>
            </div>

            <div
              className={`plan ${
                selectedPlan === 'all-tools-5h'
                  ? 'featured'
                  : ''
              }`}
            >
              <h3>
                5-Hour All Tools Pass
              </h3>

              <p>
                5 hours
                <br />
                Unlimited files
                <br />
                All available tools
              </p>

              <span>&#8377;5</span>

              <button
                type="button"
                className="primary"
                onClick={() => {
                  setSelectedPlan('all-tools-5h');
                  payToUnlock('all-tools-5h');
                }}
              >
                Buy for &#8377;5
              </button>
            </div>

            <div
              className={`plan ${
                selectedPlan === 'all-tools-monthly'
                  ? 'featured'
                  : ''
              }`}
            >
              <h3>
                All Tools Pass
              </h3>

              <p>
                30 days
                <br />
                Unlimited files
                <br />
                All available tools
              </p>

              <span>&#8377;49</span>

              <button
                type="button"
                className="primary"
                onClick={() => {
                  setSelectedPlan('all-tools-monthly');
                  payToUnlock('all-tools-monthly');
                }}
              >
                Buy for &#8377;49
              </button>
            </div>

          </div>
        </section>

      </main>

      <footer>
        &#169; 2026 SMR Form Tools &bull;{' '}
        <a href="/privacy">
          Privacy
        </a>{' '}
        &bull;{' '}
        <a href="/terms">
          Terms
        </a>{' '}
        &bull;{' '}
        <a href="/contact">
          Contact
        </a>
      </footer>
    </div>
  );
}

export default App;

















