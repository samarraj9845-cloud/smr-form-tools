import React, { useMemo, useState } from 'react';
import Privacy from './Privacy';
import Terms from './Terms';
import Contact from './Contact';
import axios from 'axios';
import AdSlot from './AdSlot';
import { hasAdSenseConfig } from './adsense';
import { hasRewardedAdConfig, showRewardedAd } from './rewardedAds';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';
const RAZORPAY_KEY_ID = 'rzp_test_TfYdiodAw1z6IV';

function clamp(n, min, max) { return Math.min(Math.max(n, min), max); }

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
  const ratio = Math.min(1, maxWidth / width, maxHeight / height);
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

  // Binary-search JPEG quality. A maximum of 9 iterations keeps the browser responsive.
  for (let i = 0; i < 9; i++) {
    const q = (lo + hi) / 2;
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', q));
    if (!blob) throw new Error('Browser could not create an image.');
    if (blob.size <= targetBytes) {
      bestBlob = blob;
      lo = q;
    } else {
      hi = q;
    }
  }
  if (!bestBlob) {
    bestBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.45));
  }
  const url = URL.createObjectURL(bestBlob);
  return { blob: bestBlob, url, width, height };
}

function App() {
  const [file, setFile] = useState(null);
  const [targetKb, setTargetKb] = useState(50);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [adAvailable, setAdAvailable] = useState(hasRewardedAdConfig());

  const targetLabel = useMemo(() => `${targetKb} KB`, [targetKb]);

  async function handleProcess(e) {
    e.preventDefault();
    if (!file) return setMessage('Pehle photo select karo.');
    setBusy(true); setMessage('Photo process ho rahi hai...'); setUnlocked(false); setResult(null);
    try {
      const output = await processImage(file, targetKb, 1600, 1600);
      setResult(output);
      setMessage(`Ready: ${(output.blob.size / 1024).toFixed(1)} KB`);
      setAdAvailable(hasRewardedAdConfig());
    } catch (err) {
      setMessage(err.message || 'Processing failed.');
    } finally { setBusy(false); }
  }

  async function payToUnlock() {
    setMessage('Payment checkout open kar rahe hain...');
    try {
      if (!RAZORPAY_KEY_ID) throw new Error('Razorpay key set nahi hai. .env mein VITE_RAZORPAY_KEY_ID add karo.');
      await loadRazorpay();
      const { data: order } = await axios.post(`${API_BASE}/create-order`, { amount: 2, purpose: 'download_unlock' });
      const options = {
        key: RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: 'SMR Form Tools',
        description: 'Download unlock',
        order_id: order.id,
        handler: async (response) => {
          try {
            const { data: verified } = await axios.post(`${API_BASE}/verify-payment`, response);
            if (verified.ok) { setUnlocked(true); setMessage('Payment verified. Download unlocked.'); }
            else setMessage('Payment verify nahi hua.');
          } catch (err) { setMessage(err.response?.data?.error || 'Payment verification failed.'); }
        },
        theme: { color: '#111827' }
      };
      const rzp = new window.Razorpay(options);

rzp.on('payment.failed', function (response) {
  console.error('RAZORPAY PAYMENT FAILED:', response.error);

  setMessage(
    `Payment failed: ${response.error?.code || 'unknown'} - ${
      response.error?.description || 'Unknown Razorpay error'
    }`
  );
});

rzp.on('modal.closed', function () {
  console.log('Razorpay modal closed');
});

rzp.open();
    } catch (err) { setMessage(err.response?.data?.error || err.message || 'Payment error.'); }
  }

  async function watchAdToUnlock() {
    setMessage('Rewarded ad start ho raha hai...');
    // This event-based bridge is intentionally separate from normal display ads.
    // A Google Ad Manager rewarded web integration can call window.smrGrantReward().
    if (typeof window.smrShowRewardedAd === 'function') {
      window.smrShowRewardedAd(() => {
        setUnlocked(true);
        setMessage('Ad complete. Download unlocked.');
      });
      return;
    }
    setMessage('Rewarded Ad abhi configured nahi hai. Pehle Google Ad Manager rewarded web slot connect karo.');
  }

  function download() {
    if (!result || !unlocked) return;
    const a = document.createElement('a');
    a.href = result.url;
    a.download = `smr-form-tools-${targetKb}kb.jpg`;
    document.body.appendChild(a); a.click(); a.remove();
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

  return <div className="page">
    <header className="header">
      <div className="brand"><div className="logo">SMR</div><div><strong>Form Tools</strong><span>Simple tools for online forms</span></div></div>
      <a className="navlink" href="#pricing">Pricing</a>
    </header>

    <main>
      <section className="hero">
        <div>
          <p className="eyebrow">INDIA FORM TOOLKIT</p>
          <h1>Photo ko required KB mein ready karo.</h1>
          <p className="lead">Upload â†’ automatic resize/compress â†’ download. Payment ke bina bhi option rahega: supported rewarded ad complete karke unlock.</p>
        </div>
        <div className="card tool-card">
          <form onSubmit={handleProcess}>
            <label className="field"><span>Target size</span>
              <select value={targetKb} onChange={e => setTargetKb(Number(e.target.value))}>
                {[20,30,50,75,100,150,200].map(v => <option key={v} value={v}>{v} KB</option>)}
              </select>
            </label>
            <label className="dropzone">
              <input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)} />
              <div className="drop-title">{file ? file.name : 'Photo select karo'}</div>
              <div className="drop-sub">JPG / PNG â€¢ browser mein process hoga</div>
            </label>
            <button className="primary" disabled={busy}>{busy ? 'Processingâ€¦' : `Make ${targetLabel}`}</button>
          </form>

          {result && <div className="unlock-box">
            <div className="ready"><span>âœ“</span> {message}</div>
            <p>Download ke liye ek option choose karo:</p>
            <div className="unlock-actions">
              <button className="secondary" onClick={watchAdToUnlock}>ðŸŽ Watch Ad & Get Free Download</button>
              <button className="secondary" onClick={payToUnlock}>â‚¹2 Pay & Download</button>
            </div>
            <button className="download" disabled={!unlocked} onClick={download}>{unlocked ? 'Download JPG' : 'Download locked'}</button>
          </div>}
          {message && !result && <p className="message">{message}</p>}
        </div>
      </section>

      <section className="features">
        <div><b>Client-side first</b><span>Image processing browser mein, V1 mein AI API ki zarurat nahi.</span></div>
        <div><b>Pay or Reward</b><span>User paid unlock ya eligible rewarded ad route choose kar sakta hai.</span></div>
        <div><b>Razorpay ready</b><span>Backend order creation + signature verification included.</span></div>
      </section>

      <section id="pricing" className="pricing">
        <h2>Simple monetization</h2>
        <div className="plans">
          <div className="plan"><h3>Free Route</h3><p>Supported rewarded ad complete karo â†’ one download unlock.</p><span>â‚¹0</span></div>
          <div className="plan featured"><h3>Quick Unlock</h3><p>One-time download unlock for a tiny fee.</p><span>â‚¹2</span></div>
          <div className="plan"><h3>Later</h3><p>30-day / 90-day packs aur subscriptions tab add karo jab usage validate ho jaye.</p><span>â‚¹49+</span></div>
        </div>
      </section>
    </main>

    <footer>Â© 2026 SMR Form Tools â€¢ Privacy â€¢ Terms â€¢ Contact</footer>
  </div>;
}

export default App;






