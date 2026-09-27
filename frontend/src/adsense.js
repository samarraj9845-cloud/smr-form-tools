const ADSENSE_CLIENT_ID =
  import.meta.env.VITE_ADSENSE_CLIENT_ID || '';

let adsensePromise = null;

export function loadAdSense() {
  if (!ADSENSE_CLIENT_ID) return Promise.resolve(false);
  if (window.adsbygoogle) return Promise.resolve(true);
  if (adsensePromise) return adsensePromise;

  adsensePromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(
      `script[data-smr-adsense="true"]`
    );

    if (existing) {
      existing.addEventListener('load', () => resolve(true), { once: true });
      existing.addEventListener('error', () => reject(new Error('AdSense load failed.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.src =
      `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(ADSENSE_CLIENT_ID)}`;
    script.crossOrigin = 'anonymous';
    script.dataset.smrAdsense = 'true';

    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error('AdSense load failed.'));
    document.head.appendChild(script);
  });

  return adsensePromise;
}

export function hasAdSenseConfig() {
  return Boolean(ADSENSE_CLIENT_ID);
}

export { ADSENSE_CLIENT_ID };
