# Miaw Tracker

Aplikasi satu halaman tanpa dependensi untuk melacak kebiasaan harian, mingguan, mingguan khusus, dan bulanan. Data tersimpan di browser lewat localStorage dan langsung memperbarui grid bulanan, panel analitik, serta dasbor tahunan.

## Fitur

- Ringkasan dasbor untuk 12 lembar bulanan
- Grid kebiasaan harian dengan tingkat penyelesaian per hari
- Grid kebiasaan mingguan dan mingguan khusus dengan jumlah minggu sesuai bulan
- Milestone bulanan sekali centang
- Rumus progres per kebiasaan dan rata-rata global bulanan
- Papan 5 besar "Miaw-keren!" dan 5 terbawah "Miaw-no!"
- Navigasi bulan responsif untuk desktop dan handphone
- Tema terang dan gelap
- Tambah, ganti nama, jeda, hapus, dan reset kebiasaan

## Menjalankan

```bash
npm start
```

Buka http://localhost:3000.

Untuk memakai port lain:

```cmd
set PORT=4000 && npm start
```

## Struktur

```text
.
|-- package.json
|-- server.js
`-- public/
    |-- index.html
    |-- styles.css
    |-- cat-logo.svg
    `-- app.js
```
