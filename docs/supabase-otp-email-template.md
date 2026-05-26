# Template Email OTP Supabase

Gunakan template ini di Supabase Dashboard:

- Menu: Authentication > Email Templates
- Template utama untuk app sekarang: Magic Link
- Template tambahan yang sebaiknya disamakan: Confirm signup
- Subject: `[Miaw-Tracker] Penting: Kode Verifikasi OTP Anda 🐾`

```html
<p>Halo {{ .Data.username }},</p>

<p>Terima kasih telah setia menggunakan Miaw-Tracker untuk membangun kebiasaan hidup yang lebih konsisten dan Miaw-velous! Kami mendeteksi adanya permintaan tindakan penting pada akun Anda (seperti masuk log, perubahan kata sandi, atau pembaruan keamanan). Untuk memastikan bahwa tindakan ini benar-benar dilakukan oleh Anda dan bukan oleh pihak lain, sistem kami telah membuatkan Kode Keamanan Sekali Pakai (OTP).</p>

<p>Berikut adalah kode verifikasi Anda:</p>

<p style="font-size: 28px; font-weight: 800; letter-spacing: 6px; margin: 18px 0;">{{ .Token }}</p>

<p><strong>Catatan Penting Demi Keamanan Akun Anda:</strong></p>

<p>Kode OTP ini hanya berlaku selama 5 menit sejak email ini dikirimkan. Jika waktu habis, Anda harus meminta kode yang baru.</p>

<p>Tim Miaw-Tracker tidak pernah meminta kode OTP Anda melalui WhatsApp, media sosial, atau saluran komunikasi apa pun. Jangan pernah memberikan kode ini kepada siapa pun, termasuk pihak yang mengaku sebagai staf kami.</p>

<p>Jika Anda tidak merasa melakukan tindakan ini atau tidak sedang mencoba masuk ke aplikasi Miaw-Tracker, abaikan saja email ini. Berarti ada seseorang yang salah memasukkan alamat email mereka, dan akun Anda tetap aman di dalam pengawasan kami.</p>

<p>Tetap semangat melacak kebiasaan harianmu dan Keep Miaw-ving forward! 🚀</p>

<p>Salam hangat,<br>
Tim Keamanan Miaw-Tracker<br>
Purr-fect Security, Better Habits.</p>
```

Catatan:

- `{{ .Token }}` wajib ada supaya kode OTP terlihat di email.
- `{{ .Data.username }}` diisi dari field nama pengguna pada form daftar.
- App sekarang mengirim OTP lewat endpoint Supabase `/auth/v1/otp`, sehingga template yang paling penting adalah `Magic Link`.
- Kalau template masih berisi `{{ .ConfirmationURL }}` saja, email akan menampilkan link dan bukan angka OTP.
- Jika email tetap tidak masuk, cek Authentication > Rate Limits dan SMTP provider di Supabase.
