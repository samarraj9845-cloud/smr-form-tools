# SMR Form Tools V1.2 — Ads Setup (Hinglish)

Is version mein 2 alag ad systems rakhe gaye hain:

1. Normal page ads: Google AdSense
2. Rewarded download ads: Google Ad Manager / Google Publisher Tag

## Normal ads (AdSense)

AdSense account approve hone ke baad apna public Publisher ID lo:

`ca-pub-XXXXXXXXXXXXXXXX`

Aur ad unit IDs lo.

`frontend/.env` mein:

```env
VITE_ADSENSE_CLIENT_ID=ca-pub-XXXXXXXXXXXXXXXX
VITE_ADSENSE_SLOT_TOP=YOUR_TOP_AD_SLOT_ID
VITE_ADSENSE_SLOT_MIDDLE=YOUR_MIDDLE_AD_SLOT_ID
```

Site par in-page ad slots render honge.

Google AdSense Auto ads ko account side se enable karke anchor/vignette formats bhi control kiye ja sakte hain. Ye ad formats Google khud place karta hai; app fake popup/ad nahi banata.

## Important policy point

Normal AdSense ads ke saath user ko:

- ad par click karne ko mat bolo
- ad dekhne/click karne ke badle reward mat do
- apne ads par khud click mat karo
- artificial traffic/click services use mat karo

Rewarded download ke liye normal AdSense ad use nahi kiya gaya hai.

## Rewarded ads

Google Ad Manager mein rewarded web ad unit/slot create karo.

Phir:

```env
VITE_AD_MANAGER_REWARDED_SLOT=/YOUR_NETWORK_CODE/YOUR_REWARDED_SLOT
```

Rewarded flow:

User button dabata hai
→ rewarded ad request
→ ad ready
→ user-initiated rewarded ad display
→ `rewardedSlotGranted`
→ download unlock

Sirf ad close hone par download unlock nahi hota.

## Localhost

Real ad revenue/production ads ke liye public HTTPS site, approved ad accounts, correct ad units aur policy-compliant traffic chahiye. Localhost par normal production ad delivery ko expect mat karo.

Development mein test ads/test inventory use karo. Live ad unit ko repeated development testing ke liye use mat karo.

## Auto ads / "popup" ads

Agar tumhe page ke top/bottom par small ads aur page transitions par full-screen-looking ads chahiye, AdSense Auto ads ke:

- Anchor ads
- Vignette ads

formats account side se enable/configure kiye ja sakte hain.

Vignette ads skippable hote hain. App khud koi deceptive popup nahi banata.

## Revenue

Ad revenue tab aayega jab eligible traffic aur valid ad impressions/clicks generate hon. Is project ke localhost test se revenue generate nahi hoga.
