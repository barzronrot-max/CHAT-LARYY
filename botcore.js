// BOT LARY — inti logika (murni, tanpa dependensi Firebase agar bisa diuji).
// handle(ctx) -> Promise<Array<Reply>>.  Reply = {text, buttons?, banner?, imageUrl?}
const crypto = require('crypto');
const DATA = require('./data');

const VERSION = '1.0.0';
const GAME_TIMEOUT_MS = 60000;
const STARTED = Date.now();
const BTN_MAIN = [{ label: '🎮 GAME', cmd: '.menu_game' }, { label: '🛠️ TOOLS', cmd: '.menu_tools' }, { label: '🎲 SERU', cmd: '.menu_fun' }, { label: 'ℹ️ INFO', cmd: '.menu_info' }];
const BTN_BACK = [{ label: '⬅️ MENU UTAMA', cmd: '.menu' }];

const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const rint = (n) => crypto.randomInt(0, n);
const pick = arr => arr[rint(arr.length)];

const GAME_CMDS = {
  tebakgambar: 'Tebak Gambar', tebakanime: 'Tebak Anime', tebaknamatokoh: 'Tebak Nama Tokoh', tebakmeme: 'Tebak Meme',
  tebakbuah: 'Tebak Buah', tebakpresiden: 'Tebak Presiden', tebakpemainbola: 'Tebak Pemain Bola', tebakep: 'Tebak FF',
  tebaknegara: 'Tebak Negara', tebakhewan: 'Tebak Hewan', tebakmakanan: 'Tebak Makanan', tebakclubbola: 'Tebak Klub Bola',
  tekateki: 'Teka-Teki', asahotak: 'Asah Otak', susunkata: 'Susun Kata', tebakkalimat: 'Tebak Kalimat',
  tebaktebakan: 'Tebak-Tebakan', tebakjenaka: 'Tebak Jenaka', nyerah: 'Menyerah', leaderboard: 'Leaderboard'
};
const ALIAS = { tebhewan: 'tebakhewan', menu_fun: 'menu_fun', menu_seru: 'menu_fun' };
const TOOL_CMDS = { play: 'Play Lagu', brat: 'Brat Sticker', pin: 'Pencarian Pinterest', tiktok: 'Info/Unduh TikTok', ig: 'Info/Unduh Instagram' };
const FUN_CMDS = { dadu: 'Lempar dadu', koin: 'Lempar koin', pilih: 'Pilih acak (a|b|c)', tanya: 'Jawaban hiburan', siapa: 'Pilih nama acak' };
const INFO_CMDS = { menu: 'Menu utama', help: 'Bantuan', owner: 'Kontak pengelola', ping: 'Ukur respons backend', runtime: 'Status layanan' };
const countCmds = () => Object.keys(GAME_CMDS).length + Object.keys(TOOL_CMDS).length + Object.keys(FUN_CMDS).length + Object.keys(INFO_CMDS).length;

const list = (obj, hint) => Object.keys(obj).map(k => '.' + k + ' → ' + obj[k]).join('\n');

function menuMain() {
  return { banner: true, text: '🤖 BOT LARY v' + VERSION + '\nAsisten otomatis ChatLeryyy — game, tools, seru-seruan, dan info.\n\n' +
    '✅ ' + countCmds() + ' perintah tersedia.\nTekan tombol di bawah atau ketik perintah (contoh: .menu_game).', buttons: BTN_MAIN };
}
const menuGame = () => ({ text: '🎮 MENU GAME\n\n' + list(GAME_CMDS) + '\n\nJawab langsung dengan mengetik jawabanmu. Waktu ' + GAME_TIMEOUT_MS / 1000 + ' detik per soal.\n(.tebhewan juga diterima sebagai .tebakhewan)', buttons: BTN_BACK });
const menuTools = () => ({ text: '🛠️ MENU TOOLS\n\n' + list(TOOL_CMDS) + '\n\nContoh:\n.play nama lagu\n.brat teks kamu\n.pin kata kunci\n.tiktok <link>\n.ig <link>', buttons: BTN_BACK });
const menuFun = () => ({ text: '🎲 MENU SERU\n\n' + list(FUN_CMDS) + '\n\nContoh:\n.pilih nasi | mie | roti\n.siapa Ani, Budi, Citra\n.tanya apakah hari ini hoki?', buttons: BTN_BACK });
const menuInfo = (env) => ({ text: 'ℹ️ MENU INFO\n\nBOT LARY v' + VERSION + ' — bot resmi ChatLeryyy.\n\nPanduan mulai:\n1. Ketik .menu\n2. Pilih kategori\n3. Ketik perintah atau jawab soal game\n\nKategori: GAME, TOOLS, SERU, INFO\nCara main game: mulai dengan perintah game (mis. .tebakbuah), lalu ketik jawabanmu. .nyerah untuk menyerah, .leaderboard untuk peringkat.\n\n' + list(INFO_CMDS) + '\n\nPerintah tidak dikenal? Ketik .help.', buttons: BTN_BACK });

// ---------- Game ----------
function scramble(w) {
  let a = w.split('');
  for (let tries = 0; tries < 10; tries++) {
    for (let i = a.length - 1; i > 0; i--) { const j = rint(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    if (a.join('') !== w) break;
  }
  return a.join('');
}
function newQuestion(cmd) {
  const key = cmd === 'tebakkalimat' ? 'kalimat' : cmd;
  if (cmd === 'asahotak') {
    const a = 2 + rint(20), b = 2 + rint(20), op = pick(['+', '-', '×']);
    const ans = op === '+' ? a + b : op === '-' ? a - b : a * b;
    return { q: 'Hitung: ' + a + ' ' + op + ' ' + b + ' = ?', answers: [String(ans)], hint: 'Jawaban berupa angka' };
  }
  if (cmd === 'susunkata') {
    const w = pick(DATA.susunkata.words);
    return { q: 'Susun huruf berikut menjadi kata:\n' + scramble(w).toUpperCase(), answers: [w], hint: 'Diawali huruf "' + w[0].toUpperCase() + '", ' + w.length + ' huruf' };
  }
  const set = DATA[key];
  if (!set || !set.items) return null;
  const it = pick(set.items);
  return { q: it[0], answers: it[1], hint: it[2] };
}
async function startGame(ctx, cmd) {
  const q = newQuestion(cmd);
  if (!q) return [{ text: 'Game belum tersedia.', buttons: BTN_BACK }];
  const now = ctx.now();
  await ctx.store.setSession(ctx.uid, { cmd, q: q.q, answers: q.answers.map(norm), shown: q.answers[0], hint: q.hint, startedAt: now, expiresAt: now + GAME_TIMEOUT_MS });
  return [{ text: '🎮 ' + (GAME_CMDS[cmd] || cmd).toUpperCase() + '\n\n' + q.q + '\n\n⏱️ ' + GAME_TIMEOUT_MS / 1000 + ' detik • Petunjuk: ' + q.hint + '\nKetik jawabanmu, atau .nyerah' }];
}
async function checkAnswer(ctx, s, text) {
  const now = ctx.now();
  if (now > s.expiresAt) {
    await ctx.store.clearSession(ctx.uid);
    return [{ text: '⌛ Waktu habis! Jawabannya: ' + s.shown + '\nKetik .' + s.cmd + ' untuk main lagi.' }];
  }
  const g = norm(text);
  const answers = Array.isArray(s.answers) ? s.answers : Object.values(s.answers || {});
  if (g && answers.includes(g)) {
    const secs = (now - s.startedAt) / 1000;
    const pts = 10 + (secs < 15 ? 5 : secs < 30 ? 2 : 0);
    await ctx.store.clearSession(ctx.uid);
    const total = await ctx.store.addScore(ctx.uid, ctx.name, pts);
    return [{ text: '✅ Benar! +' + pts + ' poin (total ' + total + ').\nKetik .' + s.cmd + ' untuk soal berikutnya.', buttons: [{ label: '🔁 Main lagi', cmd: '.' + s.cmd }, { label: '🏆 Leaderboard', cmd: '.leaderboard' }] }];
  }
  return [{ text: '❌ Salah, coba lagi. (Petunjuk: ' + s.hint + ')\nKetik .nyerah untuk menyerah.' }];
}
async function giveUp(ctx) {
  const s = await ctx.store.getSession(ctx.uid);
  if (!s) return [{ text: 'Kamu tidak sedang bermain. Ketik .menu_game untuk mulai.', buttons: BTN_BACK }];
  await ctx.store.clearSession(ctx.uid);
  return [{ text: '🏳️ Kamu menyerah. Jawabannya: ' + s.shown + '\nKetik .' + s.cmd + ' untuk coba soal lain.' }];
}
async function leaderboard(ctx) {
  const top = await ctx.store.topScores(10);
  if (!top.length) return [{ text: '🏆 Leaderboard masih kosong. Menangkan game pertama!', buttons: BTN_BACK }];
  const medal = ['🥇', '🥈', '🥉'];
  return [{ text: '🏆 LEADERBOARD\n\n' + top.map((r, i) => (medal[i] || (i + 1) + '.') + ' ' + r.name + ' — ' + r.score + ' poin (' + r.wins + ' menang)').join('\n'), buttons: BTN_BACK }];
}

// ---------- Seru ----------
const TANYA = ['Ya, tentu!', 'Tidak.', 'Mungkin saja.', 'Tanyakan lagi nanti.', 'Sangat mungkin!', 'Jangan terlalu berharap.', 'Pertanda bagus.', 'Hmm, sulit dikatakan.', 'Pasti!', 'Sepertinya tidak.'];
function fun(cmd, arg) {
  if (cmd === 'dadu') return { text: '🎲 Dadu: ' + (1 + rint(6)) };
  if (cmd === 'koin') return { text: '🪙 Koin: ' + (rint(2) ? 'ANGKA' : 'GAMBAR') };
  if (cmd === 'pilih') {
    const o = arg.split(/[|,\n]/).map(s => s.trim()).filter(Boolean);
    if (o.length < 2) return { text: 'Beri minimal 2 opsi.\nContoh: .pilih nasi | mie | roti', buttons: BTN_BACK };
    return { text: '🎯 Aku pilih: ' + pick(o) };
  }
  if (cmd === 'tanya') {
    if (!arg.trim()) return { text: 'Tulis pertanyaanmu.\nContoh: .tanya apakah besok hujan?', buttons: BTN_BACK };
    return { text: '🔮 ' + pick(TANYA) };
  }
  if (cmd === 'siapa') {
    const n = arg.split(/[,|\n]/).map(s => s.trim()).filter(Boolean);
    if (n.length < 2) return { text: 'Kirim minimal 2 nama.\nContoh: .siapa Ani, Budi, Citra', buttons: BTN_BACK };
    return { text: '👉 Yang terpilih: ' + pick(n) };
  }
}

// ---------- Tools ----------
const URL_RE = /https?:\/\/[^\s]+/i;
const isHost = (u, re) => { try { return re.test(new URL(u).hostname); } catch (_) { return false; } };
async function getJson(ctx, url, opt) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 10000);
  try { const r = await ctx.fetch(url, Object.assign({ signal: ac.signal }, opt)); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); }
  finally { clearTimeout(t); }
}
async function tool(ctx, cmd, arg) {
  const E = m => [{ text: '⚠️ ' + m, buttons: BTN_BACK }];
  try {
    if (cmd === 'play') {
      if (!arg) return E('Tulis judul lagu/artis.\nContoh: .play Lathi Weird Genius');
      const j = await getJson(ctx, 'https://itunes.apple.com/search?media=music&entity=song&limit=5&term=' + encodeURIComponent(arg));
      if (!j.results || !j.results.length) return E('Lagu tidak ditemukan untuk "' + arg + '".');
      return [{ text: '🎵 Hasil untuk "' + arg + '":\n\n' + j.results.map((r, i) => (i + 1) + '. ' + r.trackName + ' — ' + r.artistName + '\n   ▶ Preview 30 dtk: ' + r.previewUrl + '\n   🔗 ' + r.trackViewUrl).join('\n\n') + '\n\nCatatan: sumber iTunes Search resmi; hanya cuplikan 30 detik, bukan lagu penuh.' , imageUrl: (j.results[0].artworkUrl100 || '').replace('100x100', '600x600') || undefined }];
    }
    if (cmd === 'brat') {
      if (!arg) return E('Tulis teksnya.\nContoh: .brat halo dunia');
      if (arg.length > 120) return E('Teks maksimal 120 karakter.');
      if (!ctx.deps || !ctx.deps.makeBrat) return E('Generator Brat belum aktif di server.');
      const url = await ctx.deps.makeBrat(arg);
      return [{ text: '🟩 Brat: ' + arg, imageUrl: url }];
    }
    if (cmd === 'pin') {
      if (!arg) return E('Tulis kata kunci.\nContoh: .pin kucing lucu');
      if (!ctx.env.PINTEREST_ACCESS_TOKEN) return E('Pencarian Pinterest belum dikonfigurasi (butuh PINTEREST_ACCESS_TOKEN dari API resmi Pinterest).');
      const j = await getJson(ctx, 'https://api.pinterest.com/v5/search/pins?query=' + encodeURIComponent(arg) + '&page_size=4', { headers: { Authorization: 'Bearer ' + ctx.env.PINTEREST_ACCESS_TOKEN } });
      const items = (j.items || []).slice(0, 4);
      if (!items.length) return E('Tidak ada hasil Pinterest untuk "' + arg + '".');
      return items.map(p => ({ text: '📌 ' + (p.title || arg) + (p.link ? '\n🔗 ' + p.link : ''), imageUrl: p.media && p.media.images && ((p.media.images['600x'] || p.media.images.original || {}).url) })).filter(r => r.imageUrl);
    }
    if (cmd === 'tiktok' || cmd === 'ig') {
      const u = (arg.match(URL_RE) || [])[0];
      if (!u) return E('Kirim tautan.\nContoh: .' + cmd + ' https://...');
      const ok = cmd === 'tiktok' ? isHost(u, /(^|\.)tiktok\.com$/i) : isHost(u, /(^|\.)instagram\.com$/i);
      if (!ok) return E('Tautan bukan dari ' + (cmd === 'tiktok' ? 'TikTok' : 'Instagram') + '.');
      let out = [];
      if (cmd === 'tiktok') {
        try { const o = await getJson(ctx, 'https://www.tiktok.com/oembed?url=' + encodeURIComponent(u)); out.push({ text: '🎬 TikTok\nJudul: ' + (o.title || '-') + '\nAkun: ' + (o.author_name || '-') + '\n🔗 ' + u, imageUrl: o.thumbnail_url }); } catch (_) {}
      }
      if (ctx.env.MEDIA_API_URL) {
        const j = await getJson(ctx, ctx.env.MEDIA_API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ url: u }) });
        if (j && j.url && /^https:\/\//.test(j.url)) out.push({ text: '⬇️ Media siap (hanya untuk konten yang kamu berhak simpan):\n' + j.url });
        else return out.length ? out : E('Layanan media tidak mengembalikan file.');
      } else if (!out.length) return E('Layanan pemrosesan ' + cmd.toUpperCase() + ' belum dikonfigurasi (MEDIA_API_URL).');
      return out;
    }
  } catch (e) { return E('Layanan gagal/timeout (' + String(e.message || e).slice(0, 80) + '). Coba lagi nanti.'); }
}

// ---------- Info ----------
const fmtDur = ms => { const s = Math.floor(ms / 1000); return Math.floor(s / 3600) + 'j ' + Math.floor(s % 3600 / 60) + 'm ' + (s % 60) + 'd'; };

async function handle(ctx) {
  const raw = String(ctx.text || '').trim();
  if (!raw) return [];
  const sess = await ctx.store.getSession(ctx.uid);
  const isCmd = raw.startsWith('.');
  if (!isCmd && sess && !/^(menu|help)$/i.test(raw)) return checkAnswer(ctx, sess, raw);

  let cmd, arg = '';
  if (isCmd) { const m = raw.slice(1).match(/^(\S+)\s*([\s\S]*)$/); cmd = (m ? m[1] : '').toLowerCase(); arg = m ? m[2].trim() : ''; }
  else cmd = norm(raw);
  if (ALIAS[cmd]) cmd = ALIAS[cmd];

  if (isCmd || cmd === 'menu' || cmd === 'help') {
    if (cmd === 'menu' || cmd === 'start') return [menuMain()];
    if (cmd === 'menu_game') return [menuGame()];
    if (cmd === 'menu_tools') return [menuTools()];
    if (cmd === 'menu_fun') return [menuFun()];
    if (cmd === 'menu_info') return [menuInfo(ctx.env)];
    if (cmd === 'help') return [{ text: '📖 BANTUAN\n\n• .menu — menu utama\n• .menu_game / .menu_tools / .menu_fun / .menu_info\n• Jawab game dengan mengetik jawabanmu\n• .nyerah — menyerah, .leaderboard — peringkat\n\nBisa juga ngobrol biasa denganku.', buttons: BTN_MAIN }];
    if (cmd === 'nyerah') return giveUp(ctx);
    if (cmd === 'leaderboard') return leaderboard(ctx);
    if (GAME_CMDS[cmd]) return startGame(ctx, cmd);
    if (TOOL_CMDS[cmd]) return tool(ctx, cmd, arg);
    if (FUN_CMDS[cmd]) return [fun(cmd, arg)];
    if (cmd === 'owner') return [{ text: ctx.env.BOT_OWNER_INFO ? '👤 Pengelola: ' + ctx.env.BOT_OWNER_INFO : 'Info pengelola belum diatur.', buttons: BTN_BACK }];
    if (cmd === 'ping') { const t0 = Date.now(); await ctx.store.ping(); const rt = Date.now() - t0; const lag = ctx.msgTs ? Math.max(0, t0 - ctx.msgTs) : null; return [{ text: '🏓 Pong!\nDatabase: ' + rt + ' ms' + (lag != null ? '\nPesan→bot: ' + lag + ' ms' : '') }]; }
    if (cmd === 'runtime') return [{ text: '⏱️ Instance aktif: ' + fmtDur(Date.now() - STARTED) + '\nVersi: ' + VERSION + '\nPerintah: ' + countCmds() + '\n(Instance serverless bisa restart kapan saja.)' }];
    const all = [].concat(Object.keys(GAME_CMDS), Object.keys(TOOL_CMDS), Object.keys(FUN_CMDS), Object.keys(INFO_CMDS), ['menu_game', 'menu_tools', 'menu_fun', 'menu_info']);
    const close = all.filter(c => c.startsWith(cmd.slice(0, 3))).slice(0, 3).map(c => '.' + c).join(', ');
    return [{ text: '🤔 Perintah ".' + cmd + '" tidak dikenal.' + (close ? '\nMungkin maksudmu: ' + close : '') + '\nKetik .menu atau .help.', buttons: BTN_MAIN }];
  }

  // percakapan biasa
  if (/^(halo|hai|hi|hello|hallo|p|permisi|assalamualaikum|selamat (pagi|siang|sore|malam))\b/.test(cmd)) return [{ text: 'Halo ' + (ctx.name || '') + '! 👋 Aku BOT LARY. Ketik .menu untuk melihat semua fitur.', buttons: BTN_MAIN }];
  if (/apa kabar|gimana kabar/.test(cmd)) return [{ text: 'Kabarku baik, siap membantu! Kamu sendiri gimana? 😊' }];
  if (/(kamu|bot).*(bisa apa|fitur)|bisa apa/.test(cmd)) return [{ text: 'Aku bisa:\n🎮 ' + Object.keys(GAME_CMDS).length + ' perintah game\n🛠️ ' + Object.keys(TOOL_CMDS).length + ' tools\n🎲 ' + Object.keys(FUN_CMDS).length + ' seru\nℹ️ ' + Object.keys(INFO_CMDS).length + ' info\n\n' + countCmds() + ' perintah total. Tekan tombol untuk melihat daftarnya.', buttons: BTN_MAIN }];
  if (ctx.deps && ctx.deps.ai) { const a = await ctx.deps.ai(raw).catch(() => null); if (a) return [{ text: a }]; }
  return [{ text: 'Aku belum paham maksudmu. Ketik .menu untuk melihat yang bisa kulakukan.', buttons: BTN_MAIN }];
}

module.exports = { handle, countCmds, norm, GAME_CMDS, TOOL_CMDS, FUN_CMDS, INFO_CMDS, BTN_MAIN, GAME_TIMEOUT_MS };
