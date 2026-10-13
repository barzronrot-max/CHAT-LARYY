# Deploy BOT LARY 24/7 (server-side)

Status: kode sudah siap & lolos simulasi lokal, tetapi BELUM ter-deploy. Bot baru boleh disebut 24/7 setelah langkah 1–6 berhasil.

1. Syarat: project `chat-leryyy` di paket **Blaze** (Cloud Functions v2 wajib Blaze), Node 20, `npm i -g firebase-tools`.
2. `firebase login` lalu di folder proyek: `firebase init functions` (JavaScript, project chat-leryyy).
3. Salin isi folder `functions/` dari paket ini ke `functions/` proyek.
   - Jika `functions/index.js` sudah berisi fungsi lain (mis. ownerDeleteUser), JANGAN ditimpa; tambahkan dua baris `exports.botLary` dan `exports.autoReply` saja.
   - Gabungkan `dependencies` di package.json (perlu `@napi-rs/canvas` untuk .brat).
4. (Opsional, untuk balasan AI) buat `functions/.env`:
   ```
   BOT_EMAIL=aansubandi289@gmail.com
   AI_API_KEY=isi-kunci-anthropic
   ```
   Jangan commit file ini. Kunci TIDAK ada di HTML/frontend. Tanpa AI_API_KEY bot tetap membalas semua perintah, hanya obrolan bebas yang dijawab default.
5. Gabungkan `database.rules.snippet.json` ke Realtime Database Rules (Console > Realtime Database > Rules > Publish). Storage Rules: izinkan baca `bot-brat/**` untuk user login (penulisan lewat Admin SDK).
6. `cd functions && npm install && cd .. && firebase deploy --only functions`
   Region/instance (`asia-southeast1`, `chat-leryyy-default-rtdb`) sudah sesuai databaseURL di HTML.
7. Pakai `ChatLeryyy-v4-3-BOTLARY-FULL.html` dari paket ini (mesin bot di klien dimatikan; hanya 1 baris diubah). Akun BOT LARY tidak perlu login lagi di browser/APK.

## Tes nyata setelah deploy
- A: kirim `.menu` dari akun lain saat web terbuka -> dibalas.
- B: tutup semua tab/APK (termasuk akun bot), kirim `.menu` dari akun lain -> tetap dibalas.
- C: buka chat -> balasan sudah ada.
- D: kirim 3 pesan cepat -> 3 balasan, tidak ganda. Cek `botProcessed/{msgId}.state = replied`.
- E: hapus AI_API_KEY / salah isi lalu kirim obrolan bebas -> jawaban default, log `ai_error`.
- Log: `firebase functions:log --only botLary` (event: received, processing, replied, failed, skip_duplicate).

Simulasi lokal: `node test-local.js` (database tiruan; bukan pengganti tes nyata).
