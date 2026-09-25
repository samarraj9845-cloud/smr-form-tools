import React, { useState } from 'react';

export default function ImageResize() {
  const [file, setFile] = useState(null);
  const [width, setWidth] = useState(800);
  const [height, setHeight] = useState(800);
  const [outputUrl, setOutputUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  function handleFileChange(e) {
    const selected = e.target.files?.[0];

    setFile(selected || null);
    setOutputUrl('');
    setMessage('');
  }

  async function resizeImage(e) {
    e.preventDefault();

    if (!file) {
      setMessage('Pehle image select karo.');
      return;
    }

    if (!width || !height || width < 1 || height < 1) {
      setMessage('Width aur height valid number honi chahiye.');
      return;
    }

    setBusy(true);
    setMessage('Image resize ho rahi hai...');
    setOutputUrl('');

    try {
      const bitmap = await createImageBitmap(file);

      const canvas = document.createElement('canvas');
      canvas.width = Number(width);
      canvas.height = Number(height);

      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Browser canvas support nahi karta.');
      }

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise((resolve) => {
        canvas.toBlob(resolve, 'image/jpeg', 0.92);
      });

      if (!blob) {
        throw new Error('Image generate nahi ho paayi.');
      }

      const url = URL.createObjectURL(blob);

      setOutputUrl(url);
      setMessage(
        `Ready: ${width} × ${height}px • ${(blob.size / 1024).toFixed(1)} KB`
      );
    } catch (error) {
      setMessage(error.message || 'Image resize failed.');
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
        href="/"
        style={{
          display: 'inline-block',
          marginBottom: '24px',
          color: '#2563eb',
          textDecoration: 'none',
        }}
      >
        ← Back to SMR Form Tools
      </a>

      <h1>Image Resize Tool</h1>

      <p>
        Apni image ka exact width aur height set karke resize karo.
        Processing browser mein hoti hai.
      </p>

      <form onSubmit={resizeImage}>
        <div style={{ marginBottom: '16px' }}>
          <label>
            <strong>Image select karo</strong>
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
          {busy ? 'Resizing...' : 'Resize Image'}
        </button>
      </form>

      {message && (
        <p style={{ marginTop: '20px' }}>
          {message}
        </p>
      )}

      {outputUrl && (
        <div style={{ marginTop: '24px' }}>
          <a
            href={outputUrl}
            download="smr-form-tools-resized.jpg"
            style={{
              display: 'inline-block',
              padding: '12px 20px',
              background: '#2563eb',
              color: '#ffffff',
              textDecoration: 'none',
              borderRadius: '8px',
            }}
          >
            Download Resized JPG
          </a>
        </div>
      )}
    </main>
  );
}
