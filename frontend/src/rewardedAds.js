export function hasRewardedAdConfig() {
  return Boolean(
    import.meta.env.VITE_ADSENSE_CLIENT &&
    import.meta.env.VITE_REWARDED_AD_SLOT
  );
}

export function setupRewardedAd() {
  if (typeof window === 'undefined') {
    return;
  }

  window.smrShowRewardedAd = function () {
    console.warn(
      'Rewarded Ad is not configured yet.'
    );
  };
}