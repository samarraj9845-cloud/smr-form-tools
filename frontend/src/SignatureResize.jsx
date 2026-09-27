import React, { useEffect, useState } from 'react';
import { checkToolAccess } from './toolAccess';

export default function SignatureResize() {
  const [file, setFile] = useState(null);
  const [width, setWidth] = useState(300);
  const [height, setHeight] = useState(100);
  const [outputUrl, setOutputUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [accessLoading, setAccessLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadAccess() {
      try {
        const access = await checkToolAccess('signature-resize');

        if (mounted) {
          setUnlocked(Boolean(access.hasAccess));
        }
      } catch (error) {
        console.error('SIGNATURE RESIZE ACCESS ERROR:', error);

        if (mounted) {
          setUnlocked(false);
        }
      } finally {
        if (mounted) {
          setAccessLoading(false);
        }
      }
    }

    loadAccess();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (outputUrl) {
        URL.revokeObjectURL(outputUrl);
      }
    };
  }, [outputUrl]);

  function watchAdToUnlock() {
    setMessage('Rewarded ad start ho raha hai...');

    if (typeof window.smrShowRewardedAd === 'function') {
      window.smrShowRewardedAd(() => {
        setUnlocked(true);
        setMessage('Ad complete. Download unlocked.');
      });
      return;
    }

    setMessage('Rewarded Ad abhi configured nahi hai.');
  }

  function handleFileChange(e) {
    const selected = e.target.files?.[0] || null;

    if (outputUrl) {
      URL.revokeObjectURL(outputUrl);
    }

    setFile(selected);
    setOutputUrl('');
    setMessage('');
  }

  async function resizeSignature(e) {
    e.preventDefault();

    if (!file) {
      setMessage('Pehle signature image select karo.');
      return;
    }

    if (!width || !height || width < 1 || height < 1) {
      setMessage('Width aur height valid honi chahiye.');
      return;
    }

    setBusy(true);
    setMessage('Signature resize ho raha hai...');

    try {
      const bitmap = await createImageBitmap(file);

      const canvas = document.createElement('canvas');
      canvas.width = Number(width);
      canvas.height = Number(height);

      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Browser canvas support nahi karta.');
      }

      // White background for form-friendly signature output.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.drawImage(
        bitmap,
        0,
        0,
        canvas.width,
        canvas.height
      );

      const blob = await new Promise((resolve) => {
        canvas.toBlob(resolve, 'image/jpeg', 0.92);
      });

      if (!blob) {
        throw new Error('Signature image generate nahi ho paayi.');
      }

      const url = URL.createObjectURL(blob);

      if (outputUrl) {
        URL.revokeObjectURL(outputUrl);
      }

      setOutputUrl(url);

      setMessage(
        `Ready: ${width} x ${height}px | ${(blob.size / 1024).toFixed(1)} KB`
      );
    } catch (error) {
      setMessage(error.message || 'Signature resize failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      style={{
        maxWidth: '900px',
        margin: '0 auto',
        padding: '48px 24px',
        fontFamily: 'Arial, sans-serif',
        color: '#111827',
        lineHeight: 1.6,
      }}
    >
      <a
        href="/?tool=signature-resize&pricing=1"
        style={{
          display: 'inline-block',
          marginBottom: '24px',
          color: '#2563eb',
          textDecoration: 'none',
        }}
      >        ← Back to Photo Compressor
      </a>

      <h1>Signature Resize Tool</h1>

      <p>
        Apni signature image ko required width aur height mein resize karo.
        Processing browser mein hoti hai.
      </p>

      <form onSubmit={resizeSignature}>
        <div style={{ marginBottom: '16px' }}>
          <label>
            <strong>Signature image select karo</strong>
            <br />
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
            />
          </label>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label>
            Width (px)
            <br />
            <input
              type="number"
              min="1"
              value={width}
              onChange={(e) => setWidth(e.target.value)}
              style={{
                padding: '10px',
                width: '180px',
                marginTop: '6px',
              }}
            />
          </label>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label>
            Height (px)
            <br />
            <input
              type="number"
              min="1"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              style={{
                padding: '10px',
                width: '180px',
                marginTop: '6px',
              }}
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={busy}
          style={{
            padding: '12px 20px',
            border: 'none',
            borderRadius: '8px',
            background: '#111827',
            color: '#ffffff',
            cursor: busy ? 'not-allowed' : 'pointer',
          }}
        >
          {busy ? 'Resizing...' : 'Resize Signature'}
        </button>
      </form>

      {message && (
        <p style={{ marginTop: '20px' }}>
          {message}
        </p>
      )}

      {outputUrl && (
        <div style={{ marginTop: '24px' }}>
          {accessLoading ? (
            <p>Access check ho raha hai...</p>
          ) : unlocked ? (
            <a
              href={outputUrl}
              download="smr-form-tools-signature.jpg"
              style={{
                display: 'inline-block',
                padding: '12px 20px',
                background: '#2563eb',
                color: '#ffffff',
                textDecoration: 'none',
                borderRadius: '8px',
              }}
            >
              Download Resized Signature
            </a>
          ) : (
            <div>
              <p>
                Download unlock karne ke liye ek option choose karo:
              </p>

              <div
                style={{
                  display: 'flex',
                  gap: '12px',
                  flexWrap: 'wrap',
                  marginTop: '12px',
                }}
              >
                <button
                  type="button"
                  onClick={watchAdToUnlock}
                  style={{
                    padding: '12px 20px',
                    background: '#16a34a',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                >
                  Watch Ad & Get Free Download
                </button>

                <a
                  href="/?tool=signature-resize&pricing=1"
                  style={{
                    display: 'inline-block',
                    padding: '12px 20px',
                    background: '#2563eb',
                    color: '#ffffff',
                    textDecoration: 'none',
                    borderRadius: '8px',
                  }}
                >
                  Unlock & Pay
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}





