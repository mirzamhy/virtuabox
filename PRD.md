# PRD — Virtua Box

Photobooth online di browser yang terasa seperti masuk ke booth beneran: pilih mesin, atur sesi, foto di depan kamera, pilih foto, hias strip, lalu strip "keluar" dari slot cetak.

Status: **DRAFT v0.2, terverifikasi** (lihat bagian 11–13; posisi layar edit masih usulan)
Tanggal: 4 Nov 2026
Referensi: lensbooth.app, sketsa alur (6 layar), foto booth Sajin (silver), Photoculto (merah), Fotopot (kayu), dinding desain Kula Studio, mock Figma Frame 1/Frame 2, video cetak shoplivylu & fordmillinery.

---

## 1. Latar dan tujuan

Lensbooth membuktikan photobooth online bisa jalan sepenuhnya di browser. Kekurangannya: terasa seperti aplikasi kamera biasa. Virtua Box membedakan diri lewat **rasa fisik**: interior booth digambar dengan perspektif, lampu softbox menyala, hitung mundur di layar mesin, dan hasil foto dicetak keluar dari slot.

Tujuan:
- Pengguna bisa menyelesaikan satu sesi (buka web sampai unduh strip) dalam kurang dari 3 menit.
- Pengalaman terasa seperti memakai booth sungguhan, bukan sekadar webcam + filter.
- Tanpa login, tanpa upload ke server. Foto diproses di perangkat pengguna.

Bukan tujuan (v1):
- Akun pengguna, galeri cloud, pembayaran.
- Aplikasi native mobile.
- Mode multi-perangkat (dua orang di lokasi berbeda).

## 2. Target pengguna

- Pasangan/teman yang ingin foto strip bareng dari laptop atau HP.
- Pengguna yang suka estetika photobooth Korea/Jepang (Life4Cuts, Sajin, Kula) tapi tidak dekat lokasi booth.
- Kreator konten yang butuh strip untuk Instagram Story/TikTok.

## 3. Alur pengguna

```
[1] Landing ──pilih mesin──> [2] Pilihan sesi ──> [3] Booth (foto)
                                                       │
[6] Cetak (animasi slot) <── [5] Edit strip <── [4] Pilih foto
        │
        └──> Unduh PNG / Foto lagi
```

## 4. Kebutuhan per layar

### 4.1 Landing page
- Palet **silver**: latar abu muda metalik, aksen krom, teks grafit. Gradasi halus seperti panel aluminium sikat.
- Judul **"Virtua Box"**, subjudul "a project by Mirza Muhyidin", satu kalimat deskripsi.
- Dua kartu mesin dalam ilustrasi 3D/isometrik (seperti sketsa kubus):
  - **Silver**: booth putih/silver, lampu LED kapsul, gaya Sajin.
  - **Red**: booth merah marun dengan trim stainless, gaya Photoculto.
- Hover/tap: mesin sedikit terangkat, lampunya menyala. Klik: kamera "berjalan masuk" ke booth (transisi zoom).
- Pilihan mesin menentukan tema visual di semua layar berikutnya.

### 4.2 Pilihan sesi
Satu layar, empat grup pilihan. Pengguna memilih satu opsi per grup (default sudah terpilih supaya bisa langsung lanjut):

| Grup | Opsi |
|---|---|
| Strip / layout | 1×4 vertikal, 1×3 vertikal, 2×2 grid, 2×3 (dua strip kembar, seperti cetak booth Korea) |
| Timer | 3 dtk, 5 dtk, 10 dtk |
| Style | Warna asli, Hitam putih, Sepia/vintage, Film grain, Soft/beauty |
| Jumlah take | 4, 6, 8 (harus ≥ jumlah slot di layout) |

Tampil sebagai tombol fisik di panel mesin (bukan dropdown web).

### 4.3 Booth (UI photobooth)
Mengikuti mock Figma Frame 1/2: tampilan interior booth dengan perspektif satu titik.
- Dinding samping trapesium, plafon dengan **softbox/LED kapsul**, lensa kamera bulat di atas layar.
- **Layar tengah** = preview webcam (mirror), dibingkai bezel hitam seperti monitor booth.
- Di bawah layar: tombol shutter besar (ikon kamera), indikator "take 2/8".
- Saat sesi: hitung mundur angka besar di layar + suara beep, lampu flash putih memenuhi layar saat jepret, thumbnail hasil muncul di sisi layar (seperti layar Sajin).
- Opsi mode otomatis (semua take beruntun) dan manual (tekan shutter tiap take).
- Izin kamera: layar penjelasan sebelum `getUserMedia`, pesan jelas kalau ditolak.

### 4.4 Pilih foto
- Grid semua take (4–8 thumbnail).
- Pengguna memilih N foto sesuai slot layout; urutan klik = urutan di strip.
- Bisa ulang satu take tertentu (opsional v1.1).
- Batas waktu bergaya booth ("sisa 60 dtk") hanya hiasan, bisa dimatikan.

### 4.5 Edit strip
- Preview strip di tengah, panel kontrol di samping/bawah.
- Warna/pola bingkai (merujuk dinding Kula: biru, hitam, putih, hijau, pink, kotak-kotak).
- Bentuk bingkai foto: kotak, rounded, hati, oval.
- Teks bawah: nama, tanggal otomatis, logo "Virtua Box".
- Stiker sederhana (opsional v1.1).
- Filter style bisa diganti lagi di sini.

### 4.6 Cetak (mekanisme pengeluaran hasil foto)
Mengikuti dua video referensi:
- Tampilan panel depan mesin (tema sesuai pilihan: brushed silver atau marun), slot cetak horizontal dengan rol hitam, label "PHOTOS DELIVERED HERE", baki di bawah.
- Status "Mencetak…" dengan bunyi printer.
- Strip **keluar pelan dari slot** dengan gerakan tersendat (step-feed), sedikit bayangan dan getaran, lalu jatuh/berhenti di baki.
- Foto awalnya agak pudar lalu warna "matang" (efek developing), opsional.
- Setelah keluar: klik strip untuk ambil (zoom ke depan), lalu tombol **Unduh PNG** dan **Foto lagi**.

## 5. Kebutuhan non-fungsional
- **Privasi**: semua pemrosesan di browser (canvas). Tidak ada foto yang dikirim ke server. Tulis jelas di landing.
- **Perangkat**: Chrome, Safari, Edge terbaru; desktop dan HP (portrait). Kamera depan di HP.
- **Performa**: interaksi pertama < 2,5 dtk di 4G; animasi 60 fps di laptop menengah.
- **Resolusi hasil**: strip minimal 1200 px sisi panjang × 2 (siap cetak 2×6 inci di 300 dpi = 600×1800 px).
- **Aksesibilitas**: kontras teks cukup di tema silver, semua tombol bisa diakses keyboard, opsi matikan suara dan kurangi animasi (`prefers-reduced-motion`).
- **Bahasa**: Indonesia utama, Inggris opsional.

## 6. Arahan visual
- **Tema Silver**: #E9EBEE, #C9CDD2, #9AA0A6, #2B2E33; tekstur aluminium sikat; LED putih dingin.
- **Tema Red**: marun #7A1F24, #5C1519, trim stainless #C9CDD2, lantai kotak merah-putih untuk aksen.
- Tipografi: display tegas untuk judul (gaya label mesin), sans netral untuk UI.
- Detail fisik: sekrup, label tempel, stiker petunjuk "Look here, smile", tombol yang terasa ditekan.

## 7. Usulan teknis
- Vite + React + TypeScript.
- Kamera: `getUserMedia`; jepret ke `<canvas>`; filter lewat canvas/WebGL.
- Komposisi strip: canvas offscreen, ekspor `toBlob` PNG.
- Animasi: CSS 3D transform + Framer Motion (booth, transisi masuk, kertas keluar). Three.js hanya jika ilustrasi mesin di landing perlu benar-benar 3D.
- Suara: file audio kecil (beep, shutter, printer).
- Hosting statis (Vercel/Netlify). Tanpa backend di v1.

## 8. Ruang lingkup rilis
**MVP (v1)**: landing silver + 2 mesin, pilihan sesi, booth dengan countdown & flash, pilih foto, edit bingkai/warna/teks, animasi cetak, unduh PNG.

**v1.1**: stiker, ulang satu take, GIF/boomerang dari semua take, lebih banyak tema mesin (mis. kayu/Fotopot).

## 9. Metrik keberhasilan
- ≥ 60% pengunjung yang mengizinkan kamera sampai ke layar cetak.
- ≥ 40% sesi berakhir dengan unduhan.
- Rata-rata waktu sesi 1,5–3 menit.

## 10. Risiko
- Izin kamera ditolak atau tidak tersedia (in-app browser Instagram/TikTok sering memblokir). Mitigasi: deteksi dan sarankan buka di browser.
- Safari iOS punya batasan autoplay audio dan kamera. Mitigasi: mulai audio setelah tap pertama.
- Animasi berat di HP murah. Mitigasi: mode ringan otomatis.

## 11. Keputusan (sudah diverifikasi, 4 Nov 2026)
1. **Tema Red** = marun ala Photoculto (trim stainless, aksen lantai kotak merah-putih).
2. **Pilihan sesi**: user mengatur keempat grup, satu opsi per grup, default sudah terpilih.
3. **Slot cetak ikut tema mesin**:
   - Silver: slot kapsul silver dengan label "PHOTOS DELIVERED HERE" (video 2).
   - Red: panel gelap/kuningan dengan rol hitam, strip jatuh ke baki (video 1).

## 12. Usulan untuk poin yang belum ada gambaran
**Posisi layar Pilih foto & Edit strip** — usulan: "zoom ke layar sentuh".
- Dari layar Booth, kamera zoom masuk ke monitor mesin sampai monitor memenuhi layar. Bezel tipis mesin tetap terlihat di tepi, jadi tetap terasa di dalam booth.
- Di dalam monitor itu, Pilih foto dan Edit strip pakai layout lega (cocok di HP).
- Setelah klik "Cetak", kamera zoom keluar dan turun ke panel depan mesin, lalu strip keluar dari slot.

## 13. Keputusan tambahan (4 Nov 2026)
- Nama produk: **Virtua Box** (sebelumnya "Foto Kita").
- Kredit landing: **"a project by Mirza Muhyidin"**.
- Hasil akhir: **tombol Unduh PNG saja**. Tidak ada QR, tidak ada server. Tombol Bagikan (Web Share API) juga dicoret dari v1.

## 14. Progres build

**4 Nov 2026 — MVP v0.1 jalan** (`C:\Mirza Personal\virtuabox`, `npm run dev`, port 5197)
- Usulan "zoom ke layar sentuh" dipakai untuk Pilih foto dan Edit strip.
- Selesai: landing silver + 2 mesin 3D (CSS), panel pilihan sesi, booth (softbox, LED, lensa, countdown, flash, thumbnail, mode beruntun/manual), pilih foto berurutan, edit strip (8 warna, 3 pola, 4 bentuk, 5 style, teks + tanggal), cetak (silver: slot kapsul + label; red: rol + baki kuningan, step-feed + efek developing), unduh PNG resolusi cetak.
- Kamera demo: buka dengan `?demo`, atau tombol "Kamera demo" kalau tidak ada webcam.
- Diuji: alur penuh Silver (2×2) dan Red (1×4) dengan kamera demo di browser. Belum diuji: webcam asli, Safari/iOS, HP fisik.

File penting:
- `src/App.tsx` — urutan layar
- `src/components/` — Landing, Options, Booth, Pick, Edit, Print, Monitor
- `src/render.ts` + `src/layouts.ts` — gambar strip ukuran cetak (600×1800 / 1200×1800)
- `src/filters.ts` — 5 style (diproses per piksel supaya sama di semua browser)
- `src/sound.ts` — beep, shutter, printer (Web Audio, tanpa file suara)

**4 Nov 2026 — v0.2** (masukan setelah tes webcam asli)
- Hias strip: tiap foto bisa diatur posisinya. Klik foto di pratinjau lalu geser (mouse/jari), scroll untuk zoom, atau pakai slider zoom 1–3×, tombol panah, dan Reset. Foto terpilih ditandai garis biru (tidak ikut tercetak).
- Cetak: kertas sekarang keluar dari dalam lubang slot (mulai dari tengah lubang, menutupi bibir bawah, ada bayangan di mulut slot). Mesin Red: kertas keluar di antara dua rol.
- Webcam asli sudah dicoba user, hasil strip benar (mirror, crop 4:3).

**4 Nov 2026 — v0.3: booth 3D di landing**
- Kartu mesin di landing sekarang booth 3D penuh (Three.js, `src/three/booth3d.ts`), mengikuti referensi waterbean/Fotopot: kabin terbuka (dinding, lantai kotak-kotak, lampu plafon, kusen depan, rel krom), kiosk di dalam (kap miring + lampu kapsul, LED samping, kamera, layar "VIRTUA BOX / MULAI", meja, slot cetak dengan strip foto, slot kartu, kunci).
- Silver: dinding baja, kiosk putih, lantai hitam-putih. Red: dinding marun, kiosk marun + stainless, lantai merah-putih.
- Interaksi: booth bergoyang pelan, drag kiri/kanan untuk memutar, hover menyalakan lampu lebih terang, klik = kamera masuk ke kabin lalu pindah ke layar Pilihan.
- Kalau WebGL tidak tersedia, otomatis pakai booth CSS lama.

**4 Nov 2026 — v0.4: foto lebar tidak terpotong**
Masalah: kamera memotret 4:3 (melebar), sedangkan kotak foto di template tegak lebih sempit, jadi kiri-kanan terpotong (2×2 tegak hanya ~54% lebar foto yang terlihat).
- Layar booth menampilkan bingkai "Area foto" sesuai template; bagian yang akan terpotong digelapkan. Tidak tampil kalau template sudah 4:3.
- 3 template baru (kotak foto persis 4:3, foto utuh): **2×2 lebar** (kartu 6×4, 1800×1200, teks samping diputar), **1×2 lebar** (dua foto besar berdampingan), **Polaroid** (1 foto, 1200×1200).
- Panel Pilihan dibagi "Tegak" dan "Melebar & kotak", dengan catatan template mana yang memotong.
- Hias strip: tombol **Muat utuh** + slider zoom bisa di bawah 1× sampai seluruh foto masuk; sisa ruang diisi warna bingkai. Foto kecil tetap bisa digeser.
- Hias strip dan cetak menyesuaikan kartu melebar (pratinjau di atas penuh lebar, slot cetak ikut melebar).

**4 Nov 2026 — v0.5: SFX asli + template baru + kotak cetak**
- SFX: `public/sfx/shutter.mp3` (jepret) dan `public/sfx/print.mp3` (14 dtk). Animasi cetak dikunci ke jam audio: kertas keluar terus dari 0,3–10,2 dtk (getar motor halus), lepas di 10,25 dtk (bunyi klak), bisa diambil di 13,3 dtk. Kalau suara dimatikan, timeline sama memakai jam biasa. Tetap jalan walau tab di belakang.
- Template **4 Corners** (6×4): empat foto di sudut, pita tengah dengan nama di kiri dan tanggal di kanan.
- Template **Film** (6×4): dua strip roll film hitam kembar (garis potong di tengah), lubang sprocket, tulisan kuning di tepi, nama di ujung. Warna/pola bingkai disembunyikan untuk template ini.
- Akhir cetak mesin Silver: kotak logam cekung di bawah slot; setelah lepas, strip jatuh dan mendarat miring di dalamnya (strip tegak miring 22°, kartu lebar 7°). Mesin Red: strip mendarat sedikit miring di baki kuningan.

**4 Nov 2026 — v0.6: unduh foto asli**
- Foto diambil di resolusi penuh kamera (4:3, maks 1920 px lebar), tidak lagi 960×720.
- Tombol **Unduh foto asli** di layar Pilih foto dan **Foto asli (N) .zip** di layar akhir: semua take mentah (tanpa filter, tanpa bingkai, tanpa crop template) dalam satu ZIP, plus `strip.png` kalau dari layar akhir. Nama: `virtua-box-YYYYMMDD-HHMM-foto-asli.zip`.
- ZIP dibuat di browser (`src/zip.ts`, tanpa library, tanpa server).
