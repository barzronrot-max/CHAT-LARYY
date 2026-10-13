// BOT LARY — adapter server (Cloud Functions v2 + Realtime Database).
// Berjalan tanpa browser/APK. Trigger: setiap pesan baru di /chats/{chatId}/messages/{msgId}.
const { onValueCreated } = require('firebase-functions/v2/database');
const admin = require('firebase-admin');
const crypto = require('crypto');
if (!admin.apps.length) admin.initializeApp();
const db = admin.database();
const core = require('./botcore');

const BOT_EMAIL = (process.env.BOT_EMAIL || 'aansubandi289@gmail.com').toLowerCase();
const BOT_NAME = 'BOT LARY';
const MAX_AGE_MS = 10 * 60 * 1000;   // pesan lebih tua dari ini tidak dibalas (anti-banjir saat server lama mati)
const MIN_GAP_MS = 800;              // jeda minimum antar balasan per pengguna (menunggu, bukan membuang pesan)
const STALE_CLAIM_MS = 2 * 60 * 1000; // klaim "processing" yang macet lebih dari ini boleh diambil ulang
const AI_RETRIES = 2;
let botCache = null;

const log = (ev, msgId, extra) => console.log(JSON.stringify(Object.assign({ svc: 'botLary', ev, msgId, t: new Date().toISOString() }, extra || {})));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function getBot() {
  if (botCache) return botCache;
  const u = await admin.auth().getUserByEmail(BOT_EMAIL);        // akun BOT LARY yang sudah ada
  const ref = db.ref('users/' + u.uid);
  const prof = (await ref.once('value')).val() || {};
  const patch = {};
  if (prof.isBot !== true) patch.isBot = true;
  if (prof.username !== BOT_NAME) { patch.username = BOT_NAME; patch.usernameLower = 'botlary'; }
  if (Object.keys(patch).length) await ref.update(patch);
  botCache = { uid: u.uid, profile: Object.assign({}, prof, patch) };
  return botCache;
}

const store = {
  async getSession(uid) { return (await db.ref('botGames/' + uid).once('value')).val() || null; },
  async setSession(uid, s) { await db.ref('botGames/' + uid).set(s); },
  async clearSession(uid) { await db.ref('botGames/' + uid).remove(); },
  async addScore(uid, name, pts) {
    const r = await db.ref('botLeaderboard/' + uid).transaction(c => { c = c || { score: 0, wins: 0 }; return { name: name || c.name || 'Pengguna', score: (c.score || 0) + pts, wins: (c.wins || 0) + 1, updatedAt: Date.now() }; });
    return r.snapshot.val().score;
  },
  async topScores(n) {
    const s = await db.ref('botLeaderboard').orderByChild('score').limitToLast(n).once('value');
    const out = []; s.forEach(c => { out.push(c.val()); });
    return out.sort((a, b) => b.score - a.score);
  },
  async ping() { await db.ref('botPing').set(Date.now()); }
};

async function makeBrat(text) {
  const { createCanvas } = require('@napi-rs/canvas');
  const S = 512, c = createCanvas(S, S), g = c.getContext('2d');
  g.fillStyle = '#8ACE00'; g.fillRect(0, 0, S, S);
  const words = text.toLowerCase().split(/\s+/);
  let size = 96, lines;
  for (; size >= 28; size -= 4) {
    g.font = size + 'px sans-serif'; lines = []; let cur = '';
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > S - 56 && cur) { lines.push(cur); cur = w; } else cur = t; }
    lines.push(cur);
    if (lines.length * size * 1.1 <= S - 56) break;
  }
  g.fillStyle = '#000'; g.textBaseline = 'top';
  lines.forEach((l, i) => g.fillText(l, 28, 28 + i * size * 1.1));
  const buf = c.toBuffer('image/png');
  const bucket = admin.storage().bucket();
  const path = 'bot-brat/' + Date.now() + '_' + crypto.randomBytes(4).toString('hex') + '.png';
  const token = crypto.randomUUID();
  await bucket.file(path).save(buf, { contentType: 'image/png', metadata: { metadata: { firebaseStorageDownloadTokens: token } } });
  return 'https://firebasestorage.googleapis.com/v0/b/' + bucket.name + '/o/' + encodeURIComponent(path) + '?alt=media&token=' + token;
}

// Balasan AI untuk percakapan biasa. Retry terbatas; bila tetap gagal -> null (core memberi jawaban default, bukan error palsu).
async function aiAnswer(chatId, botUid, latest, msgId) {
  const key = process.env.AI_API_KEY; if (!key) return null;
  const snap = await db.ref('chats/' + chatId + '/messages').orderByChild('timestamp').limitToLast(10).once('value');
  const msgs = [];
  snap.forEach(c => { const m = c.val(); if (m && m.type === 'text' && m.text && !m.deleted) { const role = m.senderId === botUid ? 'assistant' : 'user'; if (msgs.length && msgs[msgs.length - 1].role === role) msgs[msgs.length - 1].content += '\n' + m.text; else msgs.push({ role, content: String(m.text).slice(0, 800) }); } });
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  if (!msgs.length) msgs.push({ role: 'user', content: latest });
  for (let attempt = 1; attempt <= AI_RETRIES; attempt++) {
    const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 15000);
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', signal: ac.signal,
        headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: process.env.AI_MODEL || 'claude-haiku-5-5', max_tokens: 400, system: 'Kamu BOT LARY, bot ramah di aplikasi chat ChatLeryyy. Jawab singkat dalam bahasa Indonesia, tanpa markdown berat.', messages: msgs }) });
      if (!r.ok) throw new Error('AI HTTP ' + r.status);
      const j = await r.json();
      const out = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
      if (out) return out;
      throw new Error('AI kosong');
    } catch (e) {
      log('ai_error', msgId, { attempt, error: String(e.message || e) });
      if (attempt < AI_RETRIES) await sleep(600 * attempt);
    } finally { clearTimeout(t); }
  }
  return null;
}

async function send(chatId, bot, toUid, r, replyTo) {
  const ts = admin.database.ServerValue.TIMESTAMP;
  const base = { senderId: bot.uid, senderName: BOT_NAME, senderPhoto: bot.profile.photoURL || '', receiverId: toUid, seen: false, delivered: false, isAutoReply: true, autoReplySource: 'botlary', isBot: true, botReplyTo: replyTo, timestamp: ts };
  const m = r.imageUrl ? Object.assign({}, base, { type: 'image', imageUrl: r.imageUrl, text: r.text || '' }) : Object.assign({}, base, { type: 'text', text: String(r.text || '').slice(0, 3500) });
  if (r.buttons) m.buttons = r.buttons.slice(0, 6).map(b => ({ label: String(b.label).slice(0, 30), cmd: String(b.cmd).slice(0, 60) }));
  if (r.banner) m.banner = { title: BOT_NAME, sub: 'ChatLeryyy Assistant', url: process.env.BOT_BANNER_URL || null };
  const ref = db.ref('chats/' + chatId + '/messages').push();
  m.id = ref.key;
  await ref.set(m);
  await db.ref().update({
    ['chats/' + chatId + '/lastMessage']: { id: ref.key, senderId: bot.uid, senderName: BOT_NAME, type: m.type, text: String(m.text || '').slice(0, 120), fileName: null, timestamp: ts, deleted: false },
    ['chats/' + chatId + '/updatedAt']: ts,
    ['chats/' + chatId + '/participants/' + bot.uid]: true, ['chats/' + chatId + '/participants/' + toUid]: true,
    ['userChats/' + bot.uid + '/' + chatId]: true, ['userChats/' + toUid + '/' + chatId]: true
  });
  return ref.key;
}

// Klaim atomik per pesan: hanya satu instance yang menang. Status disimpan persisten di botProcessed/{msgId}.
async function claim(msgId, now) {
  const res = await db.ref('botProcessed/' + msgId).transaction(c => {
    if (!c) return { state: 'processing', at: now };
    if (typeof c === 'number') return undefined;                          // format lama (klien) = sudah diproses
    if (c.state === 'processing' && now - (c.at || 0) > STALE_CLAIM_MS) return { state: 'processing', at: now, retried: (c.retried || 0) + 1 };
    return undefined;                                                      // replied / failed / skipped / sedang diproses
  });
  return res.committed;
}
const setStatus = (msgId, patch) => db.ref('botProcessed/' + msgId).update(Object.assign({ updatedAt: Date.now() }, patch)).catch(e => console.error('[botLary] gagal simpan status', msgId, e.message));

exports.botLary = onValueCreated({ ref: '/chats/{chatId}/messages/{msgId}', region: 'asia-southeast1', instance: 'chat-leryyy-default-rtdb', timeoutSeconds: 60, memory: '512MiB', maxInstances: 10 }, async (event) => {
  const { chatId, msgId } = event.params;
  const m = event.data.val();
  if (!m || typeof m !== 'object' || chatId.startsWith('group_')) return;
  if (m.isAutoReply === true || m.isBot === true || m.type === 'system' || m.type === 'auto_reply' || m.deleted) return;   // anti-loop
  if (m.type && m.type !== 'text') return;
  let bot;
  try { bot = await getBot(); } catch (e) { console.error('[botLary] akun bot tidak ditemukan / auth error:', e.message); return; }
  if (m.receiverId !== bot.uid || !m.senderId || m.senderId === bot.uid) return;   // bukan untuk BOT LARY
  log('received', msgId, { chatId, from: m.senderId });

  const part = (await db.ref('chats/' + chatId + '/participants').once('value')).val() || {};
  if (!part[m.senderId] || !part[bot.uid]) { log('skip_not_participant', msgId); return; }
  const now = Date.now();
  if (m.timestamp && now - m.timestamp > MAX_AGE_MS) { log('skip_too_old', msgId); await db.ref('botProcessed/' + msgId).set({ state: 'skipped', reason: 'too_old', at: now }).catch(() => {}); return; }
  if (!(await claim(msgId, now))) { log('skip_duplicate', msgId); return; }
  log('processing', msgId);

  try {
    // Jeda per pengguna: menunggu giliran, tidak membuang pesan.
    const rl = await db.ref('botRate/' + m.senderId).transaction(c => Math.max(Date.now(), (typeof c === 'number' ? c : 0) + MIN_GAP_MS));
    const wait = rl.snapshot.val() - Date.now(); if (wait > 0 && wait < 5000) await sleep(wait);

    const sender = (await db.ref('users/' + m.senderId).once('value')).val() || {};
    if (sender.isBot === true) { await setStatus(msgId, { state: 'skipped', reason: 'sender_is_bot' }); return; }
    const ctx = { uid: m.senderId, name: sender.username || m.senderName || 'Pengguna', text: m.text, msgTs: m.timestamp, now: Date.now, store, fetch, env: process.env,
      deps: { makeBrat, ai: (t) => aiAnswer(chatId, bot.uid, t, msgId) } };
    const replies = await core.handle(ctx);
    const ids = [];
    for (const r of replies) ids.push(await send(chatId, bot, m.senderId, r, msgId));
    await setStatus(msgId, { state: 'replied', replyIds: ids, repliedAt: Date.now() });
    log('replied', msgId, { count: ids.length });
  } catch (e) {
    console.error('[botLary] gagal memproses', msgId, e);
    await setStatus(msgId, { state: 'failed', error: String(e.message || e).slice(0, 200) });
    log('failed', msgId, { error: String(e.message || e) });
    // Beri tahu pengguna secara jujur (satu kali). Klaim tidak dihapus -> tidak ada balasan ganda.
    try { await send(chatId, bot, m.senderId, { text: '⚠️ Maaf, terjadi gangguan saat memproses pesanmu. Coba kirim lagi sebentar lagi.' }, msgId); await setStatus(msgId, { userNotified: true }); }
    catch (e2) { console.error('[botLary] gagal kirim notifikasi error', msgId, e2.message); await setStatus(msgId, { userNotified: false }); }
  }
});
