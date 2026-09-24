const GPT_SCRIPT_SRC =
  'https://securepubads.g.doubleclick.net/tag/js/gpt.js';

const AD_MANAGER_REWARDED_SLOT =
  import.meta.env.VITE_AD_MANAGER_REWARDED_SLOT || '';

let gptLoadPromise = null;
let targetSlot = null;
let readyListenerRegistered = false;
let grantedListenerRegistered = false;
let closedListenerRegistered = false;

function loadGPT() {
  if (window.googletag?.apiReady) return Promise.resolve(true);
  if (gptLoadPromise) return gptLoadPromise;

  gptLoadPromise = new Promise((resolve, reject) => {
    window.googletag = window.googletag || { cmd: [] };

    const existing = document.querySelector(
      `script[src="${GPT_SCRIPT_SRC}"]`
    );

    if (existing) {
      existing.addEventListener('load', () => resolve(true), { once: true });
      existing.addEventListener('error', () => reject(new Error('Google Publisher Tag load failed.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.src = GPT_SCRIPT_SRC;

    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error('Google Publisher Tag load failed.'));
    document.head.appendChild(script);
  });

  return gptLoadPromise;
}

export function hasRewardedAdConfig() {
  return Boolean(AD_MANAGER_REWARDED_SLOT);
}

export async function showRewardedAd(onReward) {
  if (!AD_MANAGER_REWARDED_SLOT) {
    throw new Error(
      'Rewarded Ad slot configured nahi hai. VITE_AD_MANAGER_REWARDED_SLOT set karo.'
    );
  }

  await loadGPT();

  return new Promise((resolve, reject) => {
    window.googletag.cmd = window.googletag.cmd || [];

    window.googletag.cmd.push(() => {
      try {
        // Clean up an older slot from a previous request.
        if (targetSlot) {
          try {
            window.googletag.destroySlots([targetSlot]);
          } catch (_) {
            // Ignore cleanup failure.
          }
          targetSlot = null;
        }

        targetSlot = window.googletag.defineOutOfPageSlot(
          AD_MANAGER_REWARDED_SLOT,
          window.googletag.enums.OutOfPageFormat.REWARDED
        );

        if (!targetSlot) {
          reject(
            new Error(
              'Is browser/device par rewarded ads supported nahi hai.'
            )
          );
          return;
        }

        targetSlot.addService(window.googletag.pubads());

        if (!readyListenerRegistered) {
          window.googletag.pubads().addEventListener(
            'rewardedSlotReady',
            (event) => {
              if (event.slot !== targetSlot) return;

              // The publisher must obtain affirmative user opt-in before
              // displaying the rewarded ad.
              const shown = event.makeRewardedVisible();
              if (!shown) {
                reject(
                  new Error('Rewarded Ad display nahi ho paya.')
                );
              }
            }
          );
          readyListenerRegistered = true;
        }

        if (!grantedListenerRegistered) {
          window.googletag.pubads().addEventListener(
            'rewardedSlotGranted',
            (event) => {
              if (event.slot !== targetSlot) return;

              if (typeof onReward === 'function') {
                onReward({
                  type: event.payload?.type,
                  amount: event.payload?.amount,
                });
              }

              resolve(true);
            }
          );
          grantedListenerRegistered = true;
        }

        if (!closedListenerRegistered) {
          window.googletag.pubads().addEventListener(
            'rewardedSlotClosed',
            (event) => {
              if (event.slot !== targetSlot) return;

              // Closing alone does not grant the reward.
              console.log('Rewarded ad closed.');
            }
          );
          closedListenerRegistered = true;
        }

        window.googletag.enableServices();
        window.googletag.display(targetSlot);
      } catch (error) {
        reject(error);
      }
    });
  });
}
