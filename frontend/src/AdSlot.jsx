import React, { useEffect } from 'react';

function AdSlot({
  slot,
  format = 'auto',
  responsive = true,
}) {
  useEffect(() => {
    try {
      if (
        window.adsbygoogle &&
        window.adsbygoogle.push
      ) {
        window.adsbygoogle.push({});
      }
    } catch (error) {
      console.warn('AdSense:', error);
    }
  }, []);

  return (
    <div
      className="ad-slot"
      style={{
        width: '100%',
        minHeight: '90px',
        margin: '16px 0',
        overflow: 'hidden',
        textAlign: 'center',
      }}
    >
      <ins
        className="adsbygoogle"
        style={{
          display: 'block',
          width: '100%',
          minHeight: '90px',
        }}
        data-ad-client={
          import.meta.env.VITE_ADSENSE_CLIENT || ''
        }
        data-ad-slot={slot || ''}
        data-ad-format={format}
        data-full-width-responsive={
          responsive ? 'true' : 'false'
        }
      />
    </div>
  );
}

export default AdSlot;