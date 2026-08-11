import { ref } from 'vue';
import { supabase } from '../layanan/supabase';
import { denganBatasWaktu } from '../bantuan/batasWaktu';

// State global reaktif (singleton pattern) agar semua pemanggilan share data yang sama
const isAuthenticated = ref(false);
const currentUser = ref<any | null>(null);
const userProfile = ref<any | null>(null);
const sedangMemuatProfile = ref(false);

function harusAdaSupabase() {
  if (!supabase) {
    throw new Error('Supabase tidak dikonfigurasi. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di file .env');
  }
  return supabase;
}

// Hapus paksa seluruh token sesi Supabase yang tersimpan di localStorage.
// Dipakai sebagai fallback saat signOut() ke server macet/timeout, supaya
// pengguna tidak terjebak tidak bisa logout hanya karena request jaringan hang.
function bersihkanTokenSesiLokal() {
  if (typeof window === 'undefined') return;
  Object.keys(window.localStorage)
    .filter((k) => k.startsWith('sb-'))
    .forEach((k) => window.localStorage.removeItem(k));
}

// Fungsi pembantu untuk memuat profil dari database. RETRY beberapa kali
// (bukan langsung menyerah di percobaan pertama) -- sebelumnya satu kali
// timeout/gagal jaringan (mis. cold-start Supabase) langsung membuat
// userProfile null, lalu terapkanSesi() di bawah jatuh ke fallback nama
// generik dari user_metadata ('Pengguna') yang TIDAK PERNAH otomatis
// dicoba muat ulang -- pengguna terjebak melihat nama generik itu di
// navbar & halaman Edit Profil sampai reload/login ulang, padahal data
// nama asli di database sebenarnya baik-baik saja, cuma satu request-nya
// yang kebetulan lambat/gagal sesaat.
async function muatProfilPengguna(uid: string, percobaan = 3): Promise<void> {
  if (!supabase) return;
  sedangMemuatProfile.value = true;
  try {
    for (let i = 1; i <= percobaan; i++) {
      try {
        const { data, error: errQuery } = await denganBatasWaktu(
          supabase
            .from('pengguna')
            .select('*')
            .eq('id', uid)
            .single(),
          8000,
          'Waktu permintaan memuat profil habis'
        );

        if (!errQuery && data) {
          userProfile.value = {
            nama: data.nama_lengkap,
            email: data.email,
            nomor_telepon: data.nomor_telepon || '',
            peran: data.peran,
            foto_profil: data.foto_profil || null
          };
          return;
        }
      } catch {
        // Percobaan ini gagal (timeout/jaringan) -- coba lagi kalau masih
        // ada jatah, jeda singkat dulu supaya tidak langsung membanjiri
        // request kalau memang jaringannya sedang bermasalah.
      }
      if (i < percobaan) await new Promise((resolve) => setTimeout(resolve, 800));
    }
    // Seluruh percobaan gagal -- baru di sini userProfile dianggap kosong,
    // memicu fallback ke user_metadata di terapkanSesi().
    userProfile.value = null;
  } finally {
    sedangMemuatProfile.value = false;
  }
}

// Penanda panggilan terapkanSesi() TERBARU -- terapkanSesi() bisa terpanggil
// lebih dari sekali hampir bersamaan (mis. getSession() saat bootstrap DAN
// onAuthStateChange saat browser mendeteksi #access_token=... di URL setelah
// redirect dari halaman lain/Midtrans). Kalau panggilan yang LEBIH LAMA
// (mis. gara-gara muatProfilPengguna() sempat retry karena jaringan lambat)
// selesai BELAKANGAN dari panggilan yang lebih baru, hasilnya dulu bisa
// MENIMPA userProfile yang sudah benar dengan versi fallback generik
// ('Pengguna') -- itulah sebabnya nama di navbar kadang berubah jadi
// generik setelah pindah-balik antar halaman. Setiap panggilan mencatat ID
// uniknya sendiri; kalau saat panggilan ini selesai ternyata sudah ada
// panggilan yang LEBIH BARU berjalan, hasil panggilan basi ini dibuang
// (tidak menulis ke state) alih-alih menimpa.
let idPanggilanSesiTerakhir = 0;

// Terapkan satu objek sesi Supabase ke state singleton (currentUser/isAuthenticated/userProfile).
async function terapkanSesi(session: { user: any } | null) {
  const idPanggilanIni = ++idPanggilanSesiTerakhir;

  if (session?.user) {
    currentUser.value = session.user;
    isAuthenticated.value = true;

    // Ambil data profil dari database
    await muatProfilPengguna(session.user.id);
    if (idPanggilanIni !== idPanggilanSesiTerakhir) return; // sudah ada panggilan lebih baru, buang hasil basi ini

    // Jika data profil kosong di DB, fallback ke user_metadata
    if (!userProfile.value) {
      userProfile.value = {
        nama: session.user.user_metadata?.nama_lengkap || 'Pengguna',
        email: session.user.email,
        nomor_telepon: session.user.user_metadata?.nomor_telepon || '',
        peran: session.user.user_metadata?.peran || 'tamu',
        foto_profil:
          session.user.user_metadata?.foto_profil ||
          session.user.user_metadata?.avatar_url ||
          session.user.user_metadata?.picture ||
          null
      };
    }

    // Backfill sekali ke pengguna.foto_profil kalau kosong tapi akun login
    // via Google (punya avatar_url/picture di user_metadata) -- ini
    // menangani akun yang dibuat SEBELUM trigger trg_pengguna_baru membaca
    // avatar Google (skema_database.sql), jadi baris pengguna-nya sudah
    // kadung tersimpan dengan foto_profil kosong dan tidak pernah otomatis
    // terisi lagi hanya dengan login ulang. Best-effort -- gagal diam-diam,
    // TIDAK memblokir alur login kalau UPDATE ini gagal.
    if (!userProfile.value.foto_profil) {
      const avatarOAuth = session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture;
      if (avatarOAuth) {
        userProfile.value.foto_profil = avatarOAuth;
        supabase?.from('pengguna').update({ foto_profil: avatarOAuth }).eq('id', session.user.id).then(() => {});
      }
    }
  } else {
    currentUser.value = null;
    isAuthenticated.value = false;
    userProfile.value = null;
  }
}

// PENTING (terbukti lewat debugging network tab): tembakan PERTAMA dari
// onAuthStateChange TIDAK selalu sudah mencerminkan sesi yang sebenarnya --
// GoTrueClient bisa menembakkan event awal dengan session:null dulu, sebelum
// proses baca+validasi token dari storage benar-benar selesai, baru menembak
// LAGI beberapa saat kemudian dengan sesi yang valid. Versi sebelumnya
// menjadikan tembakan pertama sebagai penentu status login (mock/resolve
// promiseSesiAwal), sehingga router guard sempat membaca "belum login" dan
// me-redirect ke /login walau token di localStorage sebenarnya valid -- baru
// setelah itu tembakan kedua yang benar datang, tapi sudah terlambat karena
// redirect sudah terjadi.
//
// Perbaikan: getSession() (yang MEMANG didesain untuk menunggu penuh proses
// itu) jadi satu-satunya sumber kebenaran untuk status AWAL. Event dari
// onAuthStateChange yang datang SEBELUM getSession() ini selesai diabaikan
// (supaya tidak menimpa dengan versi prematur); setelah itu, onAuthStateChange
// dipakai normal untuk menangani perubahan sesi berikutnya (login/logout/
// refresh token).
let tandaiSesiAwalSelesai: () => void = () => {};
const promiseSesiAwal: Promise<void> = new Promise((resolve) => {
  tandaiSesiAwalSelesai = resolve;
});

// Supabase mendeteksi access_token/refresh_token di URL hash (mis.
// "#access_token=...") saat magic link/OAuth/redirect Midtrans mengarahkan
// balik ke app, lalu memproses sesi darinya -- TAPI hash itu TIDAK PERNAH
// dibersihkan dari address bar setelahnya. Vue Router (createWebHistory)
// hanya mengganti pathname saat navigasi SPA, hash lama tetap "nempel" di
// URL selamanya. Akibatnya: setiap kali Supabase mengecek ulang sesi (mis.
// tiap kali tab difokuskan lagi, atau pemeriksaan berkala), hash BASI itu
// terus-menerus ikut terbaca ulang -- muncul sebagai warning "Session as
// retrieved from URL was issued over Ns ago, URL could be stale" di
// console, dan pemrosesan token basi ini yang bikin halaman terasa lambat/
// timeout berulang kali. Dibersihkan SEKALI di sini, segera setelah
// pemeriksaan sesi awal selesai (berhasil ataupun gagal) -- token yang
// relevan sudah terlanjur dibaca Supabase saat itu juga, jadi aman dihapus
// dari URL tanpa kehilangan apa pun.
function bersihkanHashTokenDariUrl() {
  if (typeof window === 'undefined') return;
  const hash = window.location.hash;
  if (hash && (hash.includes('access_token') || hash.includes('refresh_token') || hash.includes('error_description'))) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}

if (supabase) {
  let sesiAwalSelesai = false;

  denganBatasWaktu(supabase.auth.getSession(), 8000, 'Waktu pemeriksaan sesi awal habis')
    .then(({ data: { session } }) => terapkanSesi(session))
    .catch(() => terapkanSesi(null))
    .finally(() => {
      sesiAwalSelesai = true;
      tandaiSesiAwalSelesai();
      bersihkanHashTokenDariUrl();
    });

  supabase.auth.onAuthStateChange(async (_event, session) => {
    if (!sesiAwalSelesai) return;
    await terapkanSesi(session);
    bersihkanHashTokenDariUrl();
  });
} else {
  tandaiSesiAwalSelesai();
}

export function useAuth() {
  const sedangMemuat = ref(false);
  const error = ref<string | null>(null);

  async function daftar(
    email: string,
    kataSandi: string,
    namaLengkap: string,
    peran: 'orangtua' | 'supir' | 'admin',
    nomorTelepon: string = '',
    fotoProfil: string = ''
  ) {
    sedangMemuat.value = true;
    error.value = null;
    try {
      const client = harusAdaSupabase();
      const { data, error: errSignUp } = await denganBatasWaktu(
        client.auth.signUp({
          email,
          password: kataSandi,
          options: {
            data: {
              nama_lengkap: namaLengkap,
              peran: peran,
              nomor_telepon: nomorTelepon,
              // Foto profil (OPSIONAL, dipilih di form pendaftaran) --
              // dikirim sebagai data URL base64 hasil kompresiGambar() lewat
              // raw_user_meta_data karena BELUM ada sesi/auth.uid() aktif
              // di titik ini (konfirmasi email/OTP masih tertunda) untuk
              // mengunggah ke Storage bucket 'profile-images' terlebih
              // dahulu -- trigger trg_pengguna_baru (skema_database.sql)
              // sudah membaca key foto_profil ini sama seperti avatar_url/
              // picture dari login Google.
              ...(fotoProfil ? { foto_profil: fotoProfil } : {})
            },
            emailRedirectTo: `${window.location.origin}/login`
          }
        }),
        8000,
        'Waktu permintaan pendaftaran habis, silakan coba lagi'
      );
      if (errSignUp) throw errSignUp;

      // Profil pada public.pengguna dan tabel spesifik peran dibuat otomatis
      // oleh trigger trg_pengguna_baru di database (lihat skema_database.sql)
      // saat baris baru masuk ke auth.users, jadi tidak perlu insert manual di sini.

      return data;
    } catch (err: any) {
      error.value = err.message || 'Terjadi kesalahan saat mendaftar';
      throw err;
    } finally {
      sedangMemuat.value = false;
    }
  }

  async function masuk(email: string, kataSandi: string) {
    sedangMemuat.value = true;
    error.value = null;
    try {
      const client = harusAdaSupabase();
      // Dibatasi waktu: token sesi lama yang basi/rusak di localStorage bisa membuat
      // panggilan Auth ini menggantung tanpa resolve/reject, sehingga overlay
      // "Menghubungkan Sesi..." di halaman login berputar tak berujung.
      const { data, error: errSignIn } = await denganBatasWaktu(
        client.auth.signInWithPassword({
          email,
          password: kataSandi,
        }),
        8000,
        'Waktu permintaan masuk habis, silakan coba lagi'
      );
      if (errSignIn) throw errSignIn;
      return data;
    } catch (err: any) {
      error.value = err.message || 'Surel atau kata sandi Anda salah';
      throw err;
    } finally {
      sedangMemuat.value = false;
    }
  }

  // Verifikasi kode OTP 6-digit yang dikirim ke email saat registrasi
  // (type 'signup'). Supabase yang menangani validitas/kedaluwarsa/sekali
  // pakai kode ini di sisi server -- berhasil verifikasi berarti akun baru
  // resmi terkonfirmasi dan langsung mendapat sesi aktif.
  async function verifikasiOtpDaftar(email: string, token: string) {
    sedangMemuat.value = true;
    error.value = null;
    try {
      const client = harusAdaSupabase();
      const { data, error: errVerify } = await denganBatasWaktu(
        client.auth.verifyOtp({ email, token, type: 'signup' }),
        8000,
        'Waktu verifikasi OTP habis, silakan coba lagi'
      );
      if (errVerify) throw errVerify;
      return data;
    } catch (err: any) {
      error.value = err.message || 'Kode OTP salah atau sudah kedaluwarsa';
      throw err;
    } finally {
      sedangMemuat.value = false;
    }
  }

  // Kirim ulang kode OTP registrasi. Supabase otomatis menerbitkan kode baru
  // dan membuat kode sebelumnya tidak berlaku lagi.
  async function kirimUlangOtpDaftar(email: string) {
    sedangMemuat.value = true;
    error.value = null;
    try {
      const client = harusAdaSupabase();
      const { data, error: errResend } = await denganBatasWaktu(
        client.auth.resend({ type: 'signup', email }),
        8000,
        'Waktu permintaan kirim ulang OTP habis'
      );
      if (errResend) throw errResend;
      return data;
    } catch (err: any) {
      error.value = err.message || 'Gagal mengirim ulang kode OTP';
      throw err;
    } finally {
      sedangMemuat.value = false;
    }
  }

  async function keluar() {
    sedangMemuat.value = true;
    error.value = null;
    try {
      const client = harusAdaSupabase();
      try {
        const { error: errSignOut } = await denganBatasWaktu(
          client.auth.signOut(),
          8000,
          'Waktu permintaan keluar habis'
        );
        if (errSignOut) throw errSignOut;
      } catch (err) {
        // Jangan blokir logout hanya karena signOut() ke server macet/timeout
        // (mis. sesi/token lokal sudah korup) — tetap paksa keluar secara lokal
        // supaya pengguna tidak terjebak tidak bisa logout.
        console.warn('signOut() ke server gagal/timeout, memaksa keluar secara lokal:', err);
      }
    } finally {
      currentUser.value = null;
      isAuthenticated.value = false;
      userProfile.value = null;
      bersihkanTokenSesiLokal();
      sedangMemuat.value = false;
    }
  }

  async function aturUlangKataSandi(email: string) {
    sedangMemuat.value = true;
    error.value = null;
    try {
      const client = harusAdaSupabase();
      const { data, error: errReset } = await denganBatasWaktu(
        client.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/konfirmasi-reset`
        }),
        8000,
        'Waktu permintaan reset kata sandi habis'
      );
      if (errReset) throw errReset;
      return data;
    } catch (err: any) {
      error.value = err.message || 'Gagal mengirim email reset kata sandi';
      throw err;
    } finally {
      sedangMemuat.value = false;
    }
  }

  async function perbaruiKataSandi(kataSandiBaru: string) {
    sedangMemuat.value = true;
    error.value = null;
    try {
      const client = harusAdaSupabase();
      // Terukur langsung lewat instrumentasi diagnosis: updateUser() untuk
      // reset kata sandi bisa genuinely butuh ~26 detik di server (bukan
      // menggantung, bukan bug di kode kita) -- kemungkinan besar karena
      // Supabase Auth mengirim email notifikasi "kata sandi diubah" secara
      // sinkron sebelum membalas. 40 detik dipakai di sini supaya request
      // selambat itu tetap kebagian waktu selesai dengan wajar, dan SENGAJA
      // dibuat lebih PANJANG dari batas hard-abort fetch kustom di
      // src/layanan/supabase.ts (35 detik) -- supaya hasil ASLI dari fetch
      // (sukses ATAU pesan abort ramah dari wrapper-nya) yang sampai duluan
      // ke sini, bukan lagi pesan "timeout" buatan sendiri di sini.
      const mulaiDiagnosa = performance.now();
      const promiseUpdateAsli = client.auth.updateUser({ password: kataSandiBaru });
      promiseUpdateAsli.then(
        (hasil) => console.log(`[DIAGNOSA] updateUser() SELESAI (sukses) setelah ${Math.round(performance.now() - mulaiDiagnosa)}ms`, hasil),
        (errAsli) => console.log(`[DIAGNOSA] updateUser() SELESAI (gagal) setelah ${Math.round(performance.now() - mulaiDiagnosa)}ms`, errAsli)
      );

      const { data, error: errUpdate } = await denganBatasWaktu(
        promiseUpdateAsli,
        40000,
        'Waktu permintaan pembaruan kata sandi habis'
      );
      if (errUpdate) throw errUpdate;
      return data;
    } catch (err: any) {
      error.value = err.message || 'Gagal memperbarui kata sandi';
      throw err;
    } finally {
      sedangMemuat.value = false;
    }
  }

  async function ambilPengguna() {
    if (!supabase) return null;
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  }

  // Menunggu alur inisialisasi sesi singleton (dipicu sekali di module scope)
  // selesai, supaya pemanggil tidak perlu memicu pemanggilan sesi Supabase
  // terpisah yang bisa balapan dengan alur ini.
  function tungguSesiAwal(): Promise<void> {
    return promiseSesiAwal;
  }

  async function ambilPeran(uid: string): Promise<string> {
    if (!supabase) return 'tamu';
    try {
      const client = harusAdaSupabase();
      const { data, error: errPeran } = await client
        .from('pengguna')
        .select('peran')
        .eq('id', uid)
        .single();
      
      if (!errPeran && data) return data.peran;

      // Skenario Pemulihan: profil belum ada di public.pengguna (kemungkinan trigger
      // trg_pengguna_baru gagal). RLS tidak mengizinkan insert manual dari client,
      // jadi kembalikan peran dari metadata Supabase Auth sebagai fallback tampilan saja.
      const { data: { user } } = await client.auth.getUser();
      if (user && user.id === uid) {
        const metadata = user.user_metadata || {};
        return (metadata.peran as string) || 'orangtua';
      }

      return 'tamu';
    } catch {
      return 'tamu';
    }
  }

  return {
    isAuthenticated,
    currentUser,
    userProfile,
    sedangMemuat,
    error,
    daftar,
    masuk,
    verifikasiOtpDaftar,
    kirimUlangOtpDaftar,
    keluar,
    aturUlangKataSandi,
    perbaruiKataSandi,
    ambilPengguna,
    ambilPeran,
    muatProfilPengguna,
    tungguSesiAwal
  };
}
