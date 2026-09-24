import React, { useEffect, useRef, useState } from 'react';
import { ADSENSE_CLIENT_ID, loadAdSense } from './adsense';

export default function AdSlot({
  slot,
  format = 'auto',
  responsive = true,
  label = 'Advertisement',
  minHeight = 90,
}) {
  const adRef = useRef(null);
  const [state, setState] = useState(
    ADSENSE_CLIENT_ID && slot ? 'loading' : 'not-configured'
  );

  useEffect(() => {
    let mounted = true;

    async function renderAd() {
      if (!ADSENSE_CLIENT_ID || !slot || !adRef.current) {
        return;
      }

      try {
        await loadAdSense();

        if (!mounted || !adRef.current || !window.adsbygoogle) return;

        // Prevent duplicate pushes during React development re-renders.
        if (adRef.current.dataset.loaded === 'true') return;

        (window.adsbygoogle = window.adsbygoogle || []).push({});
        adRef.current.dataset.loaded = 'true';

        if (mounted) setState('loaded');
      } catch (error) {
        console.warn('AdSense slot error:', error);
        if (mounted) setState('error');
      }
    }

    renderAd();

    return () => {
      mounted = false;
    };
  }, [slot]);

  if (state === 'not-configured') {
    return (
      <div className="ad-placeholder" style={{ minHeight }} aria-hidden="true">
        <span>Ad space</span>
      </div>
    );
  }

  return (
    <section className="ad-wrap" aria-label={label}>
      <div className="ad-label">{label}</div>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{
          display: 'block',
          minHeight,
          width: '100%',
        }}
        data-ad-client={ADSENSE_CLIENT_ID}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={responsive ? 'true' : 'false'}
      />
    </section>
  );
}
