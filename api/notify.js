// PsartX Bot — New Order Notification Endpoint
// Called from order.html / purchase.html after successful order placement

const BOT_TOKEN = process.env.BOT_TOKEN;
const FIREBASE_URL = process.env.FIREBASE_URL;
const FIREBASE_KEY = process.env.FIREBASE_KEY;
const ADMIN_PANEL_URL = process.env.ADMIN_PANEL_URL || 'https://psart.in/admin_new.html';

const TG = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function fbGet(path) {
  const res = await fetch(`${FIREBASE_URL}/${path}.json?auth=${FIREBASE_KEY}`);
  return res.json();
}

async function sendMsg(chat_id, text, extra = {}) {
  await fetch(`${TG}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id, text, parse_mode: 'HTML', ...extra })
  });
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
        { text: '❌ Cancel Order', callback_data: `status_${orderId}_cancelled` }
      ],
      [
        { text: '🌐 Open Admin Panel', url: ADMIN_PANEL_URL }
      ]
    ]
  };
}

function formatOrder(orderId, order) {
  const d = order.delivery || {};
  const items = order.items || [{ ...order.product, qty: order.qty || 1 }];
  const itemsText = items.map(i =>
    `  • ${i.name || 'Product'} × ${i.qty || 1} = ₹${((i.price || 0) * (i.qty || 1)).toLocaleString('en-IN')}`
  ).join('\n');
  const isOnline = order.paymentMethod === 'upi' || order.paymentMethod === 'online';

  return `
🛒 <b>NEW ORDER!</b> ${statusEmoji(order.status)}

🆔 <b>#PS-${orderId.slice(-8).toUpperCase()}</b>

👤 <b>${d.firstName || ''} ${d.lastName || ''}`.trim() + `</b>
📧 ${order.userEmail || '—'}
📞 ${d.phone || '—'}

📍 ${d.address1 || '—'}${d.address2 ? ', ' + d.address2 : ''}
    ${d.city || ''}, ${d.state || ''} — ${d.pincode || ''}

🧾 <b>Items:</b>
${itemsText}

💳 <b>Payment:</b> ${isOnline ? '✅ Online / UPI' : '💵 Cash on Delivery'}
${isOnline && order.utrId ? `🔑 <b>UTR:</b> <code>${order.utrId}</code>` : ''}
${order.coupon ? `🏷️ <b>Coupon:</b> ${order.coupon.code}` : ''}
${order.discount > 0 ? `💸 <b>Discount:</b> -₹${order.discount.toLocaleString('en-IN')}` : ''}
🚚 <b>Shipping:</b> ${order.shipping === 0 ? 'FREE' : '₹' + (order.shipping || 80)}
💰 <b>Total: ₹${(order.total || 0).toLocaleString('en-IN')}</b>

⏰ ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`;
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { orderId } = req.body;
  if (!orderId) { res.status(400).json({ error: 'orderId required' }); return; }

  res.status(200).json({ ok: true });

  try {
    // Get order data
    const order = await fbGet(`orders/${orderId}`);
    if (!order) return;

    // Get all subscribed admin chat IDs
    const subscribers = await fbGet('bot_subscribers');
    if (!subscribers) return;

    const message = formatOrder(orderId, order);
    const keyboard = statusKeyboard(orderId);

    // Send to all verified admins
    const sends = Object.values(subscribers).map(sub =>
      sendMsg(sub.chatId, message, { reply_markup: keyboard })
    );
    await Promise.all(sends);

  } catch (err) {
    console.error('Notify error:', err);
  }
}
