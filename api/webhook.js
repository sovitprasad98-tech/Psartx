// PsartX Admin Telegram Bot — Webhook Handler
// Deploy on Vercel | Firebase Realtime DB

const BOT_TOKEN = process.env.BOT_TOKEN;
const FIREBASE_URL = process.env.FIREBASE_URL; // https://digit-product-default-rtdb.firebaseio.com
const FIREBASE_KEY = process.env.FIREBASE_KEY;  // AIzaSyBnz1UbLyz0f6t83D2222XlmKNhKLdFzQM
const ADMIN_PANEL_URL = process.env.ADMIN_PANEL_URL || 'https://psart.in/admin_new.html';

const TG = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ── Telegram API helpers ──
async function tg(method, body) {
  const res = await fetch(`${TG}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

const sendMsg = (chat_id, text, extra = {}) =>
  tg('sendMessage', { chat_id, text, parse_mode: 'HTML', ...extra });

const editMsg = (chat_id, message_id, text, extra = {}) =>
  tg('editMessageText', { chat_id, message_id, text, parse_mode: 'HTML', ...extra });

const answerCb = (callback_query_id, text = '') =>
  tg('answerCallbackQuery', { callback_query_id, text });

// ── Firebase REST helpers ──
async function fbGet(path) {
  const res = await fetch(`${FIREBASE_URL}/${path}.json?auth=${FIREBASE_KEY}`);
  return res.json();
}

async function fbSet(path, data) {
  await fetch(`${FIREBASE_URL}/${path}.json?auth=${FIREBASE_KEY}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
}

async function fbUpdate(path, data) {
  await fetch(`${FIREBASE_URL}/${path}.json?auth=${FIREBASE_KEY}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
}

// Firebase Auth REST
async function firebaseLogin(email, password) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true })
    }
  );
  return res.json();
}

// ── Session storage (Firebase) ──
async function getSession(chatId) {
  const data = await fbGet(`bot_sessions/${chatId}`);
  return data || {};
}

async function saveSession(chatId, data) {
  await fbSet(`bot_sessions/${chatId}`, data);
}

// ── Stats builder ──
async function buildStats() {
  const [users, orders, products, coupons] = await Promise.all([
    fbGet('users'),
    fbGet('orders'),
    fbGet('products'),
    fbGet('coupons')
  ]);

  const orderList = orders ? Object.values(orders) : [];
  const userCount = users ? Object.keys(users).length : 0;
  const productCount = products ? Object.keys(products).length : 0;
  const couponCount = coupons ? Object.values(coupons).filter(c => c.active !== false).length : 0;
  const totalOrders = orderList.length;
  const pending = orderList.filter(o => o.status === 'pending').length;
  const delivered = orderList.filter(o => o.status === 'delivered').length;
  const cancelled = orderList.filter(o => o.status === 'cancelled').length;
  const revenue = orderList
    .filter(o => o.status !== 'cancelled')
    .reduce((s, o) => s + (o.total || 0), 0);

  return `
╔══════════════════════════╗
║  📊 <b>PsartX Dashboard</b>     ║
╚══════════════════════════╝

👥 <b>Users</b>: ${userCount}
📦 <b>Products</b>: ${productCount}
🏷️ <b>Active Coupons</b>: ${couponCount}

📋 <b>Orders Overview</b>
├ Total: <b>${totalOrders}</b>
├ 🟡 Pending: <b>${pending}</b>
├ ✅ Delivered: <b>${delivered}</b>
└ ❌ Cancelled: <b>${cancelled}</b>

💰 <b>Total Revenue</b>: ₹${revenue.toLocaleString('en-IN')}

🕐 Updated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`;
}

// ── Order formatter ──
function formatOrderNotif(orderId, order) {
  const d = order.delivery || {};
  const items = order.items || [{ ...order.product, qty: order.qty || 1 }];
  const itemsText = items.map(i => `  • ${i.name} × ${i.qty || 1} = ₹${((i.price || 0) * (i.qty || 1)).toLocaleString('en-IN')}`).join('\n');
  const isOnline = order.paymentMethod === 'upi' || order.paymentMethod === 'online';

  return `
🛍️ <b>NEW ORDER PLACED!</b>

🆔 <b>Order ID</b>: #PS-${orderId.slice(-8).toUpperCase()}

👤 <b>Customer</b>
├ Name: <b>${d.firstName || ''} ${d.lastName || ''}</b>
├ Email: ${order.userEmail || '—'}
└ Phone: ${d.phone || '—'}

📦 <b>Items</b>
${itemsText}

📍 <b>Delivery Address</b>
${d.address1 || '—'}${d.address2 ? ', ' + d.address2 : ''}
${d.city || '—'}, ${d.state || '—'} — ${d.pincode || '—'}

💳 <b>Payment</b>: ${isOnline ? '✅ Online (UPI)' : '💵 Cash on Delivery'}
${isOnline && order.utrId ? `🔑 UTR: <code>${order.utrId}</code>` : ''}
${order.coupon ? `🏷️ Coupon: <b>${order.coupon.code}</b>` : ''}
${order.discount > 0 ? `💸 Discount: -₹${order.discount.toLocaleString('en-IN')}` : ''}
💰 <b>Total: ₹${(order.total || 0).toLocaleString('en-IN')}</b>

📌 <b>Status</b>: ${statusEmoji(order.status)} ${(order.status || 'pending').toUpperCase()}`;
}

function statusEmoji(s) {
  const m = { pending: '🟡', confirmed: '🔵', processing: '🟣', shipped: '📦', out_for_delivery: '🚴', delivered: '✅', cancelled: '❌' };
  return m[s] || '🟡';
}

function statusKeyboard(orderId) {
  return {
    inline_keyboard: [
      [
        { text: '🔵 Confirm', callback_data: `status_${orderId}_confirmed` },
        { text: '🟣 Processing', callback_data: `status_${orderId}_processing` }
      ],
      [
        { text: '📦 Shipped', callback_data: `status_${orderId}_shipped` },
        { text: '🚴 Out for Delivery', callback_data: `status_${orderId}_out_for_delivery` }
      ],
      [
        { text: '✅ Delivered', callback_data: `status_${orderId}_delivered` },
        { text: '❌ Cancel', callback_data: `status_${orderId}_cancelled` }
      ],
      [
        { text: '🌐 Open Admin Panel', url: ADMIN_PANEL_URL }
      ]
    ]
  };
}

// ── Main webhook handler ──
export default async function handler(req, res) {
  res.status(200).json({ ok: true }); // Respond to Telegram immediately

  if (req.method !== 'POST') return;

  const update = req.body;
  if (!update) return;

  try {
    // Handle callback queries (button presses)
    if (update.callback_query) {
      const cb = update.callback_query;
      const chatId = cb.message.chat.id;
      const data = cb.data;

      const session = await getSession(chatId);
      if (!session.verified) {
        await answerCb(cb.id, '❌ Not authorized. Please /start first.');
        return;
      }

      // Status update: status_{orderId}_{newStatus}
      if (data.startsWith('status_')) {
        const parts = data.split('_');
        const orderId = parts[1];
        const newStatus = parts.slice(2).join('_');
        await fbUpdate(`orders/${orderId}`, { status: newStatus, updatedAt: new Date().toISOString() });
        await answerCb(cb.id, `${statusEmoji(newStatus)} Status updated to ${newStatus.replace('_', ' ')}`);

        // Update the message keyboard
        const order = await fbGet(`orders/${orderId}`);
        if (order) {
          const newText = formatOrderNotif(orderId, { ...order, status: newStatus });
          await editMsg(chatId, cb.message.message_id, newText, {
            reply_markup: statusKeyboard(orderId)
          });
        }
        return;
      }

      // Dashboard refresh
      if (data === 'refresh_stats') {
        const stats = await buildStats();
        await editMsg(chatId, cb.message.message_id, stats, {
          reply_markup: { inline_keyboard: [[{ text: '🔄 Refresh', callback_data: 'refresh_stats' }, { text: '🌐 Admin Panel', url: ADMIN_PANEL_URL }]] }
        });
        await answerCb(cb.id, '✅ Stats refreshed!');
        return;
      }

      await answerCb(cb.id);
      return;
    }

    // Handle messages
    if (!update.message) return;
    const msg = update.message;
    const chatId = msg.chat.id;
    const text = (msg.text || '').trim();
    const session = await getSession(chatId);

    // /start command
    if (text === '/start' || text.startsWith('/start')) {
      await saveSession(chatId, { step: 'awaiting_email' });
      await sendMsg(chatId, `
🔐 <b>PsartX Admin Bot</b>

Welcome! Please verify your admin credentials.

📧 <b>Step 1:</b> Enter your admin email address:`, {
        reply_markup: { force_reply: true, selective: true }
      });
      return;
    }

    // /stats command (if verified)
    if (text === '/stats') {
      if (!session.verified) {
        await sendMsg(chatId, '❌ Please /start and verify first.');
        return;
      }
      const stats = await buildStats();
      await sendMsg(chatId, stats, {
        reply_markup: {
          inline_keyboard: [[
            { text: '🔄 Refresh', callback_data: 'refresh_stats' },
            { text: '🌐 Admin Panel', url: ADMIN_PANEL_URL }
          ]]
        }
      });
      return;
    }

    // /orders command (if verified)
    if (text === '/orders') {
      if (!session.verified) {
        await sendMsg(chatId, '❌ Please /start and verify first.');
        return;
      }
      const orders = await fbGet('orders');
      const list = orders ? Object.entries(orders)
        .sort(([, a], [, b]) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5) : [];
      if (!list.length) { await sendMsg(chatId, '📭 No orders yet.'); return; }
      for (const [id, o] of list) {
        await sendMsg(chatId, formatOrderNotif(id, o), {
          reply_markup: statusKeyboard(id)
        });
      }
      return;
    }

    // /help command
    if (text === '/help') {
      await sendMsg(chatId, `
📋 <b>PsartX Bot Commands</b>

/start — Login & verify admin
/stats — View dashboard stats
/orders — View last 5 orders
/help — Show this message

💡 You'll receive automatic notifications for every new order!`);
      return;
    }

    // Auth flow: collect email
    if (session.step === 'awaiting_email') {
      if (!text.includes('@')) {
        await sendMsg(chatId, '❌ Invalid email. Please enter a valid email address:');
        return;
      }
      await saveSession(chatId, { step: 'awaiting_password', email: text });
      await sendMsg(chatId, `✅ Email: <code>${text}</code>\n\n🔑 <b>Step 2:</b> Enter your admin password:`, {
        reply_markup: { force_reply: true, selective: true }
      });
      return;
    }

    // Auth flow: verify password
    if (session.step === 'awaiting_password') {
      const email = session.email;
      const password = text;

      await sendMsg(chatId, '⏳ Verifying credentials...');

      const authRes = await firebaseLogin(email, password);

      if (authRes.error) {
        const errMsg = authRes.error.message;
        let friendly = '❌ Invalid email or password.';
        if (errMsg.includes('INVALID_LOGIN_CREDENTIALS')) friendly = '❌ Wrong email or password. Try /start again.';
        if (errMsg.includes('TOO_MANY_ATTEMPTS')) friendly = '❌ Too many attempts. Try again later.';
        await saveSession(chatId, {});
        await sendMsg(chatId, friendly);
        return;
      }

      // Save verified session with chat_id to Firebase for notifications
      const uid = authRes.localId;
      await saveSession(chatId, {
        verified: true,
        email,
        uid,
        chatId,
        verifiedAt: new Date().toISOString()
      });

      // Register this chat for notifications
      await fbSet(`bot_subscribers/${chatId}`, {
        chatId,
        email,
        uid,
        registeredAt: new Date().toISOString()
      });

      const stats = await buildStats();

      await sendMsg(chatId, `
╔══════════════════════════╗
║  ✅ <b>Verified Successfully!</b> ║
╚══════════════════════════╝

Welcome, <b>${authRes.displayName || email.split('@')[0]}</b>! 👋
You are now connected as <b>PsartX Admin</b>.

You'll receive instant notifications for every new order.

${stats}`, {
        reply_markup: {
          inline_keyboard: [[
            { text: '🔄 Refresh Stats', callback_data: 'refresh_stats' },
            { text: '🌐 Open Admin Panel', url: ADMIN_PANEL_URL }
          ], [
            { text: '📦 Recent Orders', callback_data: 'refresh_stats' }
          ]]
        }
      });
      return;
    }

    // Default response
    if (session.verified) {
      await sendMsg(chatId, `Use these commands:\n/stats — Dashboard\n/orders — Recent orders\n/help — Help`);
    } else {
      await sendMsg(chatId, '👋 Use /start to login.');
    }

  } catch (err) {
    console.error('Bot error:', err);
  }
}
