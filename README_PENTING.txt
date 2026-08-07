E-NGAT REPORT + PERFORMANCE HOTFIX V54
======================================

Masalah yang dibetulkan
-----------------------
1. Report memaparkan "Missing or insufficient permissions".
2. Pemeriksaan Jadual Waktu berjalan setiap 800 ms selama tab dibuka.
3. URL pratonton gambar tidak dilepaskan daripada memori selepas modal ditutup.

LANGKAH 1 — GANTI FAIL DI GITHUB / VERCEL
------------------------------------------
Gantikan dua fail di root projek dengan fail dalam folder ini:
- report.js
- index.html

index.html sudah menukar nombor versi report.js supaya pelayar tidak terus
menggunakan fail lama daripada cache.

LANGKAH 2 — TERBITKAN FIRESTORE RULES (WAJIB)
---------------------------------------------
Memuat naik firestore.rules ke GitHub atau Vercel TIDAK mengemas kini Firebase.

1. Buka Firebase Console projek e-NGAT.
2. Pilih Firestore Database.
3. Buka tab Rules.
4. Salin SEMUA kandungan fail firestore.rules dalam folder ini.
5. Gantikan rules di Firebase Console.
6. Klik Publish.

Tanpa langkah ini, butang Report tetap akan ditolak oleh Firebase walaupun
report.js sudah diganti.

LANGKAH 3 — UJI
----------------
1. Tunggu deployment Vercel selesai.
2. Buka aplikasi dalam Incognito atau lakukan hard refresh.
3. Log masuk sebagai pengguna.
4. Hantar report dengan dan tanpa gambar.
5. Semak Firebase Console > Firestore > koleksi reports.

Nota keselamatan
----------------
- Pengguna hanya boleh mencipta report dengan UID akaun sendiri.
- Pengguna hanya boleh membaca report sendiri.
- Pentadbir boleh membaca, mengemas kini dan memadam report.
- Ruang email tidak lagi dibandingkan terus dengan token email kerana semakan
  itu menjadi punca penolakan bagi sesetengah sesi, tetapi UID masih diwajibkan.
