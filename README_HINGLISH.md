# SMR Form Tools — Clean V1

Ye bilkul naya, clean project hai. Existing SMR Nexus AI project ko touch nahi karta.

## V1 ka idea

User photo ko required KB mein convert karega.

Download ke 2 routes:
1. **Rewarded Ad route:** user voluntarily eligible rewarded ad dekhe aur ad completion ke baad download unlock ho.
2. **Paid route:** Razorpay se ₹2 one-time unlock.

> IMPORTANT: Normal AdSense display ads ko dekhne/click karne ke badle reward dena allowed nahi hai. Website rewarded ads ke liye Google Ad Manager ka rewarded-web/Offerwall route use karo. Normal ads ke clicks ko kabhi incentivize mat karo.

## Folder structure

```text
smr-form-tools/
  frontend/
    src/App.jsx
    src/main.jsx
    src/styles.css
    index.html
    package.json
    .env.example
  backend/
    server.js
    package.json
    .env.example
  README_HINGLISH.md
```

## Run locally

### Terminal 1 — backend

```powershell
cd backend
copy .env.example .env
npm install
npm run dev
```

### Terminal 2 — frontend

```powershell
cd frontend
copy .env.example .env
npm install
npm run dev
```

Open Vite URL, normally:

```text
http://localhost:5173
```

## Razorpay

Backend `.env` mein KEY_ID + KEY_SECRET lagao.
Frontend `.env` mein sirf `VITE_RAZORPAY_KEY_ID` lagao.

Test mode keys se pehle integration test karo. Live keys GitHub mein upload mat karo.

## Rewarded ads

Frontend mein ye bridge intentionally rakha gaya hai:

```js
window.smrShowRewardedAd = (onReward) => {
  // Google Ad Manager rewarded-web implementation
  // On `rewardedSlotGranted`, call onReward()
};
```

Actual ad inventory/publisher config ke bina free-ad button unlock nahi karega.

Google Ad Manager rewarded web docs ke mutabik user ko voluntarily opt-in karna hota hai aur reward completion ke baad dena hota hai. Normal AdSense policies incentivized ad views/clicks prohibit karti hain, isliye regular AdSense unit ko "watch ad to unlock" button se connect mat karo.

## Production next steps

1. HTTPS + production frontend/backend
2. Razorpay webhook + server-side payment record
3. Database for users/payments/downloads
4. Google Ad Manager rewarded-web setup / Offerwall
5. Privacy Policy + Terms + abuse/rate limiting
6. More tools: signature resize, JPG→PDF, PDF compress
7. Analytics: tool usage → ad unlocks → paid unlocks


## Ads V1.2

See `ADS_SETUP_HINGLISH.md`.

Normal display/Auto Ads use Google AdSense. Rewarded download ads use Google Ad Manager rewarded web inventory.
