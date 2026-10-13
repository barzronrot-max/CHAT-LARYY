const core = require('./botcore');
const mem = { sess: {}, lb: {} };
const store = {
  getSession: async u => mem.sess[u] || null, setSession: async (u, s) => { mem.sess[u] = s; }, clearSession: async u => { delete mem.sess[u]; },
  addScore: async (u, n, p) => { const c = mem.lb[u] || { name: n, score: 0, wins: 0 }; c.score += p; c.wins++; mem.lb[u] = c; return c.score; },
  topScores: async n => Object.values(mem.lb).sort((a, b) => b.score - a.score).slice(0, n), ping: async () => {}
};
let T = 1000;
const mk = (uid, text, extra) => Object.assign({ uid, name: uid, text, now: () => T, store, env: {}, fetch: async () => { throw new Error('offline'); }, deps: {} }, extra);
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log('FAIL', m)); };
(async () => {
  let r = await core.handle(mk('a', 'halo')); ok(/Halo/.test(r[0].text), 'halo');
  r = await core.handle(mk('a', '.menu')); ok(r[0].buttons.length === 4 && r[0].banner && /\d+ perintah/.test(r[0].text), 'menu 4 tombol');
  for (const c of ['.menu_game', '.menu_tools', '.menu_fun', '.menu_info']) { r = await core.handle(mk('a', c)); ok(r[0].text.length > 40, c); }
  // setiap perintah di menu punya implementasi (tidak 'tidak dikenal')
  const all = [].concat(Object.keys(core.GAME_CMDS), Object.keys(core.TOOL_CMDS), Object.keys(core.FUN_CMDS), ['menu', 'help', 'owner', 'ping', 'runtime']);
  for (const c of all) { r = await core.handle(mk('z' + c, '.' + c)); ok(r && r.length && !/tidak dikenal/.test(r[0].text), 'cmd ' + c); }
  ok(!/tidak dikenal/.test((await core.handle(mk('q', '.tebhewan')))[0].text), 'alias tebhewan');
  // game: jawab benar
  mem.sess = {}; mem.lb = {};
  await core.handle(mk('u1', '.tebakbuah')); const s = mem.sess.u1; ok(!!s, 'sesi dibuat');
  r = await core.handle(mk('u1', 'jawaban salah banget')); ok(/Salah/.test(r[0].text) && mem.sess.u1, 'salah');
  r = await core.handle(mk('u1', s.answers[0])); ok(/Benar/.test(r[0].text) && !mem.sess.u1 && mem.lb.u1.score >= 10, 'benar+skor');
  // sesi terpisah antar user + nyerah milik sendiri
  await core.handle(mk('u1', '.tebakhewan')); await core.handle(mk('u2', '.asahotak'));
  ok(mem.sess.u1.cmd === 'tebakhewan' && mem.sess.u2.cmd === 'asahotak', 'sesi terpisah');
  r = await core.handle(mk('u3', '.nyerah')); ok(/tidak sedang bermain/.test(r[0].text), 'nyerah tanpa game');
  r = await core.handle(mk('u1', '.nyerah')); ok(/menyerah/.test(r[0].text) && !mem.sess.u1 && mem.sess.u2, 'nyerah hanya miliknya');
  // timeout
  await core.handle(mk('u2', '.asahotak')); T += 61000; r = await core.handle(mk('u2', '123')); ok(/Waktu habis/.test(r[0].text) && !mem.sess.u2, 'timeout');
  // asah otak benar
  await core.handle(mk('u4', '.asahotak')); const ans = mem.sess.u4.answers[0]; r = await core.handle(mk('u4', ans)); ok(/Benar/.test(r[0].text), 'asahotak');
  // susun kata
  await core.handle(mk('u5', '.susunkata')); r = await core.handle(mk('u5', mem.sess.u5.answers[0])); ok(/Benar/.test(r[0].text), 'susunkata');
  r = await core.handle(mk('x', '.leaderboard')); ok(/LEADERBOARD/.test(r[0].text), 'leaderboard');
  // seru
  ok(/Dadu: [1-6]/.test((await core.handle(mk('x', '.dadu')))[0].text), 'dadu');
  ok(/ANGKA|GAMBAR/.test((await core.handle(mk('x', '.koin')))[0].text), 'koin');
  ok(/Beri minimal/.test((await core.handle(mk('x', '.pilih')))[0].text), 'pilih kosong');
  ok(/Aku pilih: (a|b|c)$/.test((await core.handle(mk('x', '.pilih a | b | c')))[0].text), 'pilih');
  ok(/Tulis pertanyaan/.test((await core.handle(mk('x', '.tanya')))[0].text), 'tanya kosong');
  ok(/Kirim minimal/.test((await core.handle(mk('x', '.siapa Ani')))[0].text), 'siapa 1 nama');
  const seen = new Set(); for (let i = 0; i < 40; i++) seen.add((await core.handle(mk('x', '.dadu')))[0].text); ok(seen.size > 3, 'dadu acak');
  // tools: input kosong & layanan mati
  ok(/Tulis judul/.test((await core.handle(mk('x', '.play')))[0].text), 'play kosong');
  ok(/Layanan gagal/.test((await core.handle(mk('x', '.play lathi')))[0].text), 'play offline -> error jelas');
  ok(/belum aktif/.test((await core.handle(mk('x', '.brat hai')))[0].text), 'brat tanpa generator');
  ok(/belum dikonfigurasi/.test((await core.handle(mk('x', '.pin kucing')))[0].text), 'pin tanpa token');
  ok(/bukan dari TikTok/.test((await core.handle(mk('x', '.tiktok https://evil.com/x')))[0].text), 'tiktok host salah');
  ok(/bukan dari Instagram/.test((await core.handle(mk('x', '.ig https://tiktok.com/x')))[0].text), 'ig host salah');
  ok(/belum dikonfigurasi/.test((await core.handle(mk('x', '.ig https://www.instagram.com/p/abc/')))[0].text), 'ig tanpa provider');
  ok(/tidak dikenal/.test((await core.handle(mk('x', '.asdf')))[0].text), 'unknown');
  ok(/belum paham/.test((await core.handle(mk('x', 'bla bla bla')))[0].text), 'fallback tanpa AI');
  console.log('lulus', pass, 'gagal', fail);
  process.exit(fail ? 1 : 0);
})();
