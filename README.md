# PsartX Admin Telegram Bot 🤖

Premium admin bot for PsartX — real-time order notifications, status updates & dashboard via Telegram.

---

## 📁 File Structure

```
psartx-bot/
├── api/
│   ├── webhook.js    ← Telegram webhook handler
│   └── notify.js     ← Called by website on new order
├── package.json
├── vercel.json
└── README.md
```

---

## 🚀 Step 1 — Deploy to Vercel

1. Upload this folder to a **GitHub repo** (e.g. `psartx-bot`)
2. Go to [vercel.com](https://vercel.com) → **New Project** → Import that repo
3. Deploy

---

## 🔑 Step 2 — Set Environment Variables in Vercel

Go to your Vercel project → **Settings → Environment Variables** → Add these:

| Variable | Value |
|---|---|
| `BOT_TOKEN` | `8768811718:AAE6RpC1weOMA0NTQBHM6XjIYAUVzh-GCRs` |
| `FIREBASE_URL` | `https://digit-product-default-rtdb.firebaseio.com` |
| `FIREBASE_KEY` | `AIzaSyBnz1UbLyz0f6t83D2222XlmKNhKLdFzQM` |
| `ADMIN_PANEL_URL` | `https://psart.in/admin_new.html` |

After adding → **Redeploy** once.

---

## 🔗 Step 3 — Set Telegram Webhook

After deployment, your bot URL will be:
```
https://YOUR-PROJECT.vercel.app/api/webhook
```

Open this URL in browser to register the webhook:
```
https://api.telegram.org/bot8768811718:AAE6RpC1weOMA0NTQBHM6XjIYAUVzh-GCRs/setWebhook?url=https://YOUR-PROJECT.vercel.app/api/webhook
```

You should see: `{"ok":true,"result":true}`

---

## 🌐 Step 4 — Connect Website to Bot (order notifications)

### In order.html and purchase.html:

Add this function to your script (after placing order successfully):

```javascript
// Call this after push(ref(db,'orders'),orderData) succeeds
async function notifyBot(orderId) {
  try {
    await fetch('https://YOUR-PROJECT.vercel.app/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId })
    });
  } catch(e) {}
}
```

Then call it:
```javascript
const newRef = await push(ref(db, 'orders'), orderData);
const oid = newRef.key;
notifyBot(oid); // ← Add this line
```

---

## 📱 Step 5 — Use the Bot

1. Open Telegram → Search your bot (`@YourBotUsername`)
2. Send `/start`
3. Enter your admin **email** (same as Firebase admin account)
4. Enter your **password**
5. ✅ Verified! Dashboard stats will appear

---

## 🤖 Bot Commands

| Command | Description |
|---|---|
| `/start` | Login & verify admin |
| `/stats` | View live dashboard |
| `/orders` | See last 5 orders |
| `/help` | Show commands |

---

## ⚡ Features

- ✅ Admin auth via Firebase (email + password)
- ✅ Live dashboard stats after login
- ✅ Instant new order notifications to all verified admins
- ✅ Inline buttons to change order status (Confirm/Ship/Deliver/Cancel)
- ✅ UTR ID shown for online payments
- ✅ Coupon & discount details in notification
- ✅ Direct link to Admin Panel from every notification
- ✅ Multiple admin support (all verified admins get notifications)

---

## 🔒 Security Notes

- Only Firebase-verified admins can use the bot
- Sessions stored securely in Firebase
- Bot token should never be shared publicly

---

**Made for PsartX** 🌸
