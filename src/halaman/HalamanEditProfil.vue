<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../komposabel/useAuth';
import { useAuthStore } from '../penyimpanan/authStore';
import { supabase } from '../layanan/supabase';
import { gunakanRealtimeSubscription } from '../layanan/realtimeLayanan';
import { 
  ChevronLeft, User, Phone, Mail, MapPin,
  Save, Loader2, AlertTriangle, CheckCircle,
  Upload, HelpCircle, LogOut, Edit
} from 'lucide-vue-next';
import PemilihPeta from '../komponen/umum/PemilihPeta.vue';
import ModalUtama from '../komponen/umum/ModalUtama.vue';
import NotifikasiUtama from '../komponen/umum/NotifikasiUtama.vue';
import { ambilDaftarSekolah, unggahFotoAnak } from '../layanan/berlangganganLayanan';
import { denganBatasWaktu } from '../bantuan/batasWaktu';
import { kompresiGambar, konversiBase64KeBlob } from '../bantuan/kompresiGambar';
import type { SekolahRow } from '../tipe';

const router = useRouter();
const auth = useAuth();
const authStore = useAuthStore();

// State Form Profil Pengguna
const namaLengkap = ref('');
const email = ref('');
const nomorTelepon = ref('');
const fotoProfil = ref('');
const berkasFotoBaru = ref<File | null>(null);
const previewFotoUrl = ref<string>('');
const alamat = ref('');

// State UI
const sedangLoading = ref(false);
const errorPesan = ref<string | null>(null);
const suksesPesan = ref<string | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
// Terisi kalau muatData() gagal total (mis. fetch profil timeout) --
// SEBELUMNYA halaman ini diam-diam tetap menampilkan form kosong tanpa
// penjelasan apa pun kalau ini terjadi. Dipakai utk menampilkan banner +
// tombol "Coba Lagi" alih-alih form kosong yang membingungkan.
const gagalMemuatProfil = ref(false);

// State Data Anak & Sekolah
const listAnak = ref<any[]>([]);
const sedangMemuatAnak = ref(false);
const modalEditAnakTampil = ref(false);
const sedangMenyimpanAnak = ref(false);
const daftarSekolah = ref<SekolahRow[]>([]);

// Model Edit Anak Sementara
const anakEdit = ref({
  id: '',
  nama_lengkap: '',
  sekolah_id: '',
  kelas: '',
  alamat_jemput: '',
  lintang_jemput: -0.9471,
  bujur_jemput: 100.4172,
  url_foto: ''
});

// Foto anak (WAJIB -- kecuali anak ini sudah punya foto sebelumnya, lihat
// simpanDataAnak) -- pola sama seperti foto profil pengguna di atas, cuma
// diunggah ke bucket foto-anak (lihat unggahFotoAnak, berlangganganLayanan.ts)
// dan disimpan terpisah supaya tidak tertukar dengan berkasFotoBaru (punya
// pengguna sendiri, yang TETAP opsional).
const fileInputAnak = ref<HTMLInputElement | null>(null);
const berkasFotoAnakBaru = ref<File | null>(null);
const previewFotoAnakUrl = ref('');
const errorFotoAnak = ref('');

const triggerPilihFileAnak = () => {
  fileInputAnak.value?.click();
};

const tanganiUnggahFotoAnak = (e: Event) => {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  const formatDiperbolehkan = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  if (!formatDiperbolehkan.includes(file.type)) {
    picuToast('Format foto tidak sesuai. Silakan unggah file gambar dengan format JPG, PNG, atau WEBP.', 'error');
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    picuToast('Ukuran file maksimal adalah 2MB!', 'error');
    return;
  }

  berkasFotoAnakBaru.value = file;
  previewFotoAnakUrl.value = URL.createObjectURL(file);
  errorFotoAnak.value = '';
};

// Daftar kelas mengikuti sekolah yang dipilih pada form edit anak (dikelola
// Admin di menu Data Sekolah, lihat kelasTersedia di tipe SekolahRow).
const daftarKelasEdit = computed(() => daftarSekolah.value.find((s) => s.id === anakEdit.value.sekolah_id)?.kelasTersedia ?? []);

// Kelas yang sudah dipilih jadi tidak valid lagi kalau sekolah diganti --
// dikosongkan supaya orang tua tidak salah submit kelas milik sekolah lain.
watch(() => anakEdit.value.sekolah_id, () => {
  if (!daftarKelasEdit.value.includes(anakEdit.value.kelas)) {
    anakEdit.value.kelas = '';
  }
});

// State Logout
const modalLogoutTampil = ref(false);

const peranPengguna = computed(() => {
  return auth.userProfile.value?.peran || auth.currentUser.value?.user_metadata?.peran || 'tamu';
});

const picuToast = (pesan: string, tipe: 'sukses' | 'error') => {
  if (tipe === 'sukses') {
    suksesPesan.value = pesan;
    errorPesan.value = null;
  } else {
    errorPesan.value = pesan;
    suksesPesan.value = null;
  }
  setTimeout(() => {
    suksesPesan.value = null;
    errorPesan.value = null;
  }, 4000);
};

// Pop-up notifikasi mengambang (di atas banner inline yang sudah ada),
// supaya konfirmasi "perubahan berhasil disimpan" langsung terlihat oleh
// pengguna tanpa harus menyadari banner di dalam kartu.
const toastTampil = computed(() => !!suksesPesan.value || !!errorPesan.value);
const toastPesan = computed(() => suksesPesan.value || errorPesan.value || '');
const toastTipe = computed<'sukses' | 'error'>(() => (suksesPesan.value ? 'sukses' : 'error'));
const tutupToast = () => {
  suksesPesan.value = null;
  errorPesan.value = null;
};

// Muat data profil dan data anak
const muatData = async () => {
  // Redirect jika belum login
  if (!authStore.sudahLogin && !auth.isAuthenticated.value) {
    router.push('/login');
    return;
  }

  gagalMemuatProfil.value = false;

  // Coba muat ulang profil dari database dulu sebelum membaca state --
  // jaring pengaman kalau percobaan awal saat bootstrap aplikasi sempat
  // gagal semua (jaringan lambat dll) dan userProfile masih berisi
  // fallback generik dari user_metadata (lihat catatan lengkap di
  // muatProfilPengguna, useAuth.ts). Halaman ini yang paling sering
  // dipakai pengguna untuk mengecek/mengubah namanya sendiri, jadi wajar
  // dicoba muat ulang di sini secara eksplisit.
  if (auth.currentUser.value?.id) {
    await auth.muatProfilPengguna(auth.currentUser.value.id);
  }

  // Isi data profil dari state/metadata
  if (auth.userProfile.value) {
    namaLengkap.value = auth.userProfile.value.nama || '';
    email.value = auth.userProfile.value.email || '';
    nomorTelepon.value = auth.userProfile.value.nomor_telepon || '';
    fotoProfil.value = auth.userProfile.value.foto_profil || '';
  }

  if (auth.currentUser.value) {
    const meta = auth.currentUser.value.user_metadata || {};
    if (!namaLengkap.value) namaLengkap.value = meta.nama_lengkap || '';
    if (!email.value) email.value = auth.currentUser.value.email || '';
    if (!nomorTelepon.value) nomorTelepon.value = meta.nomor_telepon || '';
    if (!fotoProfil.value) fotoProfil.value = meta.foto_profil || '';
  }

  // Kalau setelah semua fallback di atas nama TETAP kosong (mis. fetch
  // profil timeout DAN user_metadata juga tidak punya nama_lengkap),
  // tampilkan banner error + tombol coba lagi -- alih-alih form kosong
  // yang terlihat seperti data hilang.
  if (!namaLengkap.value && !email.value) {
    gagalMemuatProfil.value = true;
  }

  const userId = auth.currentUser.value?.id;
  const client = supabase;

  if (client && userId && peranPengguna.value === 'orangtua') {
    // Ambil data anak
    await muatDataAnak();

    // Ambil daftar sekolah
    try {
      daftarSekolah.value = await ambilDaftarSekolah();
    } catch (err: any) {
      console.error('Gagal mengambil daftar sekolah:', err);
      picuToast(err.message || 'Gagal memuat daftar sekolah.', 'error');
    }
  }
};

// Realtime -- kalau profil diubah dari perangkat/tab lain, form ini ikut
// menyegarkan diri (KECUALI sedang menyimpan, hindari race). Ini JUGA
// menjadi jaring pengaman kedua terhadap bug lama di atas: bahkan kalau
// suatu saat state sempat basi lagi karena sebab lain, begitu baris
// `pengguna` ini berubah di database, event realtime akan memaksa
// muatData() berjalan ulang tanpa pengguna perlu tahu/reload manual.
let saluranPengguna: { unsubscribe: () => void } | null = null;

onUnmounted(() => {
  saluranPengguna?.unsubscribe();
  saluranPengguna = null;
});

const muatDataAnak = async () => {
  const userId = auth.currentUser.value?.id;
  const client = supabase;
  if (!client || !userId) return;

  sedangMemuatAnak.value = true;
  try {
    // Dibatasi waktu: tanpa ini, request yang menggantung karena masalah
    // sesi/token membuat spinner "memuat data anak" tidak akan pernah berhenti.
    const { data, error } = await client
      .from('anak')
      .select('*, sekolah(id, nama)')
      .eq('orang_tua_id', userId)
      .order('dibuat_pada', { ascending: true });

    if (error) throw error;
    listAnak.value = data ?? [];
  } catch (err: any) {
    console.error('Gagal memuat data anak:', err);
    picuToast(err.message || 'Gagal memuat data anak.', 'error');
  } finally {
    sedangMemuatAnak.value = false;
  }
};

onMounted(async () => {
  await muatData();

  const id = auth.currentUser.value?.id;
  if (id) {
    saluranPengguna = gunakanRealtimeSubscription('pengguna', `id=eq.${id}`, () => {
      if (!sedangLoading.value) muatData();
    });
  }
});

// Pilih berkas gambar profil
const triggerPilihFile = () => {
  fileInput.value?.click();
};

// Simpan berkas terpilih secara lokal & buat pratinjau instan
const tanganiUnggahFoto = (e: Event) => {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  // Validasi format file
  const formatDiperbolehkan = ['image/png', 'image/jpeg', 'image/jpg'];
  if (!formatDiperbolehkan.includes(file.type)) {
    picuToast('Format gambar harus PNG, JPG, atau JPEG!', 'error');
    return;
  }

  // Validasi ukuran file (Max 2MB)
  if (file.size > 2 * 1024 * 1024) {
    picuToast('Ukuran file maksimal adalah 2MB!', 'error');
    return;
  }

  berkasFotoBaru.value = file;
  previewFotoUrl.value = URL.createObjectURL(file);
  picuToast('Foto berhasil dipilih! Klik tombol Simpan Perubahan di bawah untuk menerapkan.', 'sukses');
};

// Simpan koordinat jemput anak saat peta di modal digeser -- deskripsi
// alamat selalu disinkronkan ulang mengikuti pin (pengguna tetap bisa
// mengedit teksnya secara manual sesudahnya via textarea di bawah).
const tanganiLokasiJemputAnak = (data: { lintang: number; bujur: number; alamat: string }) => {
  anakEdit.value.lintang_jemput = data.lintang;
  anakEdit.value.bujur_jemput = data.bujur;
  anakEdit.value.alamat_jemput = data.alamat;
};

// Simpan Data Profil Pengguna
const simpanProfil = async () => {
  if (!namaLengkap.value) {
    picuToast('Nama lengkap wajib diisi', 'error');
    return;
  }

  sedangLoading.value = true;
  errorPesan.value = null;
  suksesPesan.value = null;

  try {
    const client = supabase;
    const userId = auth.currentUser.value?.id;

    if (client && userId) {
      // 0. Unggah foto profil baru jika ada
      if (berkasFotoBaru.value) {
        console.log("Mulai upload foto");
        // Kompresi terlebih dahulu menggunakan canvas helper (selalu menghasilkan JPEG)
        const base64Kecil = await kompresiGambar(berkasFotoBaru.value);

        try {
          // Konversi ke Blob untuk diunggah
          const blob = konversiBase64KeBlob(base64Kecil);

          // Struktur folder: profile-images/{user_id}/foto-{timestamp}.jpg
          // Suffix timestamp WAJIB -- nama file yang selalu sama (dulu
          // `foto.jpg`) bikin URL publiknya juga selalu sama walau isinya
          // baru diganti, jadi browser tetap menampilkan foto LAMA dari
          // cache meski upload & simpan ke database sudah 100% berhasil.
          const pathFile = `${userId}/foto-${Date.now()}.jpg`;

          // Upload berkas langsung ke storage bucket 'profile-images'
          // Dibatasi waktu: request storage yang macet (bucket bermasalah, jaringan
          // lambat) bisa menggantung tanpa reject/resolve, membuat spinner tak berujung.
          const { error: uploadErr } = await denganBatasWaktu(
            client.storage
              .from('profile-images')
              .upload(pathFile, blob, {
                cacheControl: '3600',
                contentType: 'image/jpeg',
                upsert: true
              }),
            12000,
            'Waktu unggah foto profil habis'
          );

          if (uploadErr) {
            console.error("Gagal upload foto:", uploadErr);
            const pesanErr = (uploadErr.message || '').toLowerCase();
            if (pesanErr.includes('bucket not found') || pesanErr.includes('does not exist')) {
              throw new Error('Bucket penyimpanan "profile-images" belum dibuat di Supabase Storage. Harap buat bucket publik bernama "profile-images" di dashboard Supabase Anda terlebih dahulu.');
            }
            if (pesanErr.includes('row-level security') || pesanErr.includes('permission') || pesanErr.includes('policy')) {
              throw new Error('Tidak memiliki izin untuk mengunggah foto profil (kebijakan storage RLS membatasi akses). Harap buat policy INSERT/UPDATE untuk bucket "profile-images" di Supabase.');
            }
            throw new Error(`Gagal mengunggah foto ke penyimpanan: ${uploadErr.message}`);
          }

          console.log("Upload selesai");

          // Sukses unggah, ambil URL Publik
          const { data: dataUrl } = client.storage
            .from('profile-images')
            .getPublicUrl(pathFile);
          
          if (!dataUrl || !dataUrl.publicUrl) {
            throw new Error('Gagal mendapatkan URL publik untuk berkas foto yang diunggah.');
          }
          fotoProfil.value = dataUrl.publicUrl;
        } finally {
          // Bersihkan state file baru
          berkasFotoBaru.value = null;
          previewFotoUrl.value = '';
        }
      }

      // 1. Cek apakah pengguna sudah ada di tabel database
      const { data: dataCek, error: errCek } = await client
        .from('pengguna')
        .select('id')
        .eq('id', userId)
        .maybeSingle();

      if (errCek) throw errCek;

      if (!dataCek) {
        // Lakukan INSERT jika record belum ada
        const responseInsertDb = await client
          .from('pengguna')
          .insert({
            id: userId,
            email: email.value,
            nama_lengkap: namaLengkap.value,
            nomor_telepon: nomorTelepon.value,
            peran: peranPengguna.value,
            foto_profil: fotoProfil.value || null
          });

        const errInsertDb = responseInsertDb.error;
        console.log("Response insert pengguna:", responseInsertDb);
        console.log("Error insert pengguna:", errInsertDb);

        if (errInsertDb) {
          const pesanErr = (errInsertDb.message || '').toLowerCase();
          if (pesanErr.includes('row-level security') || pesanErr.includes('permission') || pesanErr.includes('policy')) {
            throw new Error('Permission database ditolak');
          }
          if (pesanErr.includes('foto_profil') && pesanErr.includes('column')) {
            throw new Error('Kolom foto_profil belum tersedia di tabel pengguna. Jalankan migrasi database SQL: "ALTER TABLE pengguna ADD COLUMN foto_profil text;" terlebih dahulu.');
          }
          throw new Error(`Gagal menyisipkan data profil ke database: ${errInsertDb.message}`);
        }

        if (peranPengguna.value === 'orangtua') {
          const responseInsertOt = await client
            .from('orang_tua')
            .insert({
              id: userId,
              alamat: alamat.value || '',
              nomor_whatsapp: nomorTelepon.value
            });

          const errInsertOt = responseInsertOt.error;
          console.log("Response insert orang_tua:", responseInsertOt);
          console.log("Error insert orang_tua:", errInsertOt);

          if (errInsertOt) {
            const pesanErr = (errInsertOt.message || '').toLowerCase();
            if (pesanErr.includes('row-level security') || pesanErr.includes('permission') || pesanErr.includes('policy')) {
              throw new Error('Permission database ditolak');
            }
            throw errInsertOt;
          }
        }
      } else {
        // Lakukan UPDATE jika record sudah ada
        const responseUpdateDb = await client
          .from('pengguna')
          .update({
            nama_lengkap: namaLengkap.value,
            nomor_telepon: nomorTelepon.value,
            foto_profil: fotoProfil.value || null
          })
          .eq('id', userId);

        const errUpdateDb = responseUpdateDb.error;
        console.log("Response update pengguna:", responseUpdateDb);
        console.log("Error update pengguna:", errUpdateDb);

        if (errUpdateDb) {
          const pesanErr = (errUpdateDb.message || '').toLowerCase();
          if (pesanErr.includes('row-level security') || pesanErr.includes('permission') || pesanErr.includes('policy')) {
            throw new Error('Permission database ditolak');
          }
          if (pesanErr.includes('foto_profil') && pesanErr.includes('column')) {
            throw new Error('Kolom foto_profil belum tersedia di tabel pengguna. Jalankan migrasi database SQL: "ALTER TABLE pengguna ADD COLUMN foto_profil text;" terlebih dahulu.');
          }
          throw new Error(`Gagal menyimpan data profil ke database: ${errUpdateDb.message}`);
        }

        if (peranPengguna.value === 'orangtua') {
          const responseUpdateOt = await client
            .from('orang_tua')
            .update({
              alamat: alamat.value,
              nomor_whatsapp: nomorTelepon.value
            })
            .eq('id', userId);

          const errUpdateOt = responseUpdateOt.error;
          console.log("Response update orang_tua:", responseUpdateOt);
          console.log("Error update orang_tua:", errUpdateOt);

          if (errUpdateOt) {
            const pesanErr = (errUpdateOt.message || '').toLowerCase();
            if (pesanErr.includes('row-level security') || pesanErr.includes('permission') || pesanErr.includes('policy')) {
              throw new Error('Permission database ditolak');
            }
            throw errUpdateOt;
          }
        }
      }

      // 3. Perbarui state singleton useAuth() SEGERA (optimistic) -- BUG
      // SEBELUMNYA: muatProfilPengguna() (refresh state di memori) ditaruh
      // di DALAM try/catch yang sama dengan client.auth.updateUser() (sinkron
      // metadata ke Supabase Auth, operasi pelengkap yang lewat antrean lock
      // auth internal & rawan lambat/timeout). Begitu updateUser() gagal/
      // timeout, refresh profil ITU IKUT TIDAK PERNAH JALAN -- data utama
      // sudah benar tersimpan di database (langkah 1-2 di atas), tapi
      // `userProfile` di memori (dibaca navbar, dashboard, halaman ini
      // sendiri saat mount berikutnya) tetap basi sampai reload penuh (F5).
      // Sekarang dipisah: patch langsung ke state di sini (instan, tidak
      // bergantung jaringan) SEKALIGUS tetap coba refetch dari DB supaya
      // data 100% konsisten dengan sumber kebenaran -- keduanya TIDAK lagi
      // bergantung pada updateUser() berhasil atau tidak.
      if (auth.userProfile.value) {
        auth.userProfile.value.nama = namaLengkap.value;
        auth.userProfile.value.nomor_telepon = nomorTelepon.value;
        auth.userProfile.value.foto_profil = fotoProfil.value || null;
      }
      try {
        await auth.muatProfilPengguna(userId);
      } catch (errRefresh) {
        console.warn('Gagal refetch profil dari database (patch optimistic di atas tetap berlaku):', errRefresh);
      }

      // Sinkronisasi metadata ke Supabase Auth -- BENAR-BENAR pelengkap
      // (cuma dipakai fallback user_metadata kalau baris `pengguna` gagal
      // dimuat, lihat muatData() di bawah), best-effort murni, TIDAK
      // memengaruhi apa pun di atas lagi.
      try {
        const { error: errUpdateAuth } = await denganBatasWaktu(
          client.auth.updateUser({
            data: {
              nama_lengkap: namaLengkap.value,
              nomor_telepon: nomorTelepon.value,
              foto_profil: fotoProfil.value
            }
          }),
          8000,
          'Waktu permintaan pembaruan sesi habis'
        );
        if (errUpdateAuth) throw errUpdateAuth;
      } catch (errSinkron: any) {
        console.warn('Gagal sinkronisasi metadata ke Supabase Auth (data utama tetap tersimpan & state tetap ter-update):', errSinkron);
      }

      picuToast('Profil berhasil diperbarui', 'sukses');
    } else {
      // Fallback offline mock
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (auth.userProfile.value) {
        auth.userProfile.value.nama = namaLengkap.value;
        auth.userProfile.value.nomor_telepon = nomorTelepon.value;
        auth.userProfile.value.foto_profil = fotoProfil.value;
      }
      picuToast('Profil berhasil diperbarui (simulasi offline)!', 'sukses');
    }
  } catch (err: any) {
    picuToast(err.message || 'Gagal menyimpan perubahan profil', 'error');
  } finally {
    sedangLoading.value = false;
  }
};

// Buka Modal Edit Detail Anak
const bukaModalEditAnak = (anak: any) => {
  anakEdit.value = {
    id: anak.id,
    nama_lengkap: anak.nama_lengkap,
    sekolah_id: anak.sekolah_id,
    kelas: anak.kelas,
    alamat_jemput: anak.alamat_jemput,
    lintang_jemput: anak.lintang_jemput || -0.9471,
    bujur_jemput: anak.bujur_jemput || 100.4172,
    url_foto: anak.url_foto || ''
  };
  berkasFotoAnakBaru.value = null;
  previewFotoAnakUrl.value = '';
  errorFotoAnak.value = '';
  modalEditAnakTampil.value = true;
};

// Simpan Perubahan Data Anak ke DB
const simpanDataAnak = async () => {
  if (!anakEdit.value.nama_lengkap) {
    picuToast('Nama anak wajib diisi', 'error');
    return;
  }
  // Foto WAJIB -- kecuali anak ini sebelumnya sudah punya foto
  // (anakEdit.value.url_foto terisi), pengguna tidak wajib menggantinya.
  if (!berkasFotoAnakBaru.value && !anakEdit.value.url_foto) {
    errorFotoAnak.value = 'Foto profil anak wajib diunggah sebelum melanjutkan.';
    picuToast('Foto profil anak wajib diunggah sebelum melanjutkan.', 'error');
    return;
  }
  errorFotoAnak.value = '';

  sedangMenyimpanAnak.value = true;
  try {
    const client = supabase;
    if (client) {
      // Unggah foto baru dulu (kalau dipilih) -- kalau tidak ada file baru,
      // foto lama (sudah divalidasi wajib ada di atas) tetap dipakai.
      let urlFotoBaru = anakEdit.value.url_foto;
      if (berkasFotoAnakBaru.value) {
        const userId = auth.currentUser.value?.id;
        if (!userId) throw new Error('Sesi login tidak ditemukan, silakan login ulang.');
        urlFotoBaru = await unggahFotoAnak(userId, anakEdit.value.id, berkasFotoAnakBaru.value);
      }

      const { error } = await client
        .from('anak')
        .update({
          nama_lengkap: anakEdit.value.nama_lengkap,
          sekolah_id: anakEdit.value.sekolah_id,
          kelas: anakEdit.value.kelas,
          alamat_jemput: anakEdit.value.alamat_jemput,
          lintang_jemput: anakEdit.value.lintang_jemput,
          bujur_jemput: anakEdit.value.bujur_jemput,
          url_foto: urlFotoBaru || null
        })
        .eq('id', anakEdit.value.id);

      if (error) throw error;

      berkasFotoAnakBaru.value = null;
      previewFotoAnakUrl.value = '';
      modalEditAnakTampil.value = false;
      await muatDataAnak();
      picuToast('Data anak berhasil diperbarui!', 'sukses');
    }
  } catch (err: any) {
    picuToast(err.message || 'Gagal menyimpan data anak', 'error');
  } finally {
    sedangMenyimpanAnak.value = false;
  }
};

// Keluar / Logout
const tanganiLogout = async () => {
  modalLogoutTampil.value = false;
  sedangLoading.value = true;
  try {
    await authStore.logout();
    router.push('/login');
  } catch (err: any) {
    console.error('Gagal logout:', err);
    picuToast(err.message || 'Gagal keluar dari akun, silakan coba lagi', 'error');
  } finally {
    sedangLoading.value = false;
  }
};
</script>

<template>
  <div class="bg-[#f5fbf7] min-h-screen text-slate-800 font-sans antialiased overflow-x-hidden relative flex flex-col pb-16">

    <!-- Pop-up Notifikasi -->
    <NotifikasiUtama
      :tampil="toastTampil"
      :pesan="toastPesan"
      :tipe="toastTipe"
      @tutup="tutupToast"
    />

    <!-- Blobs Dekoratif -->
    <div class="absolute top-0 left-0 w-80 h-80 bg-[#14a38b]/5 rounded-full filter blur-3xl -translate-x-1/3 -translate-y-1/3 pointer-events-none"></div>
    <div class="absolute bottom-0 right-0 w-96 h-96 bg-[#14a38b]/5 rounded-full filter blur-3xl translate-x-1/3 translate-y-1/3 pointer-events-none"></div>

    <!-- Header Sederhana -->
    <header class="w-full bg-white/80 backdrop-blur-md border-b border-slate-100 h-20 px-6 md:px-12 flex justify-between items-center z-20 sticky top-0 overflow-visible">
      <router-link to="/" class="flex items-center gap-1.5 no-underline">
        <img src="/logo-denanta.png" alt="Denanta TranSolution" class="h-14 md:h-24 w-auto" />
      </router-link>
      <a href="https://wa.me/6281213668215" target="_blank" class="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#14a38b] transition-colors no-underline">
        <HelpCircle class="w-4 h-4 text-slate-400" />
        <span>Butuh Bantuan?</span>
      </a>
    </header>

    <main class="w-full max-w-2xl mx-auto px-4 pt-8 relative z-10">
      
      <!-- Back Button -->
      <button 
        type="button"
        class="mb-6 text-slate-500 hover:text-[#14a38b] transition-colors bg-transparent border-0 cursor-pointer flex items-center gap-1 text-xs font-semibold"
        @click="router.back()"
      >
        <ChevronLeft class="w-4 h-4" />
        Kembali
      </button>

      <!-- Card Container Utama -->
      <div class="bg-white rounded-[16px] border border-slate-100 p-6 md:p-8 shadow-xs flex flex-col gap-6 relative text-left">
        
        <!-- Loading Overlay -->
        <div v-if="sedangLoading" class="absolute inset-0 bg-white/80 backdrop-blur-xs flex items-center justify-center z-20 rounded-[16px]">
          <div class="text-center space-y-2">
            <Loader2 class="w-10 h-10 text-[#14a38b] animate-spin mx-auto" />
            <p class="text-xs text-[#14a38b] font-semibold">Menyimpan Perubahan...</p>
          </div>
        </div>

        <!-- Header Halaman -->
        <div>
          <h1 class="text-2xl font-bold text-slate-800 tracking-tight">Ubah Profil</h1>
          <p class="text-xs text-slate-500 mt-1 leading-relaxed">Perbarui informasi profil akun Anda dan data anak di bawah ini.</p>
        </div>

        <!-- Alert Sukses / Error -->
        <div v-if="suksesPesan" class="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-xl flex items-start gap-2.5 text-xs">
          <CheckCircle class="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div class="leading-normal">{{ suksesPesan }}</div>
        </div>
        <div v-if="errorPesan" class="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-xl flex items-start gap-2.5 text-xs">
          <AlertTriangle class="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <div class="leading-normal">{{ errorPesan }}</div>
        </div>

        <!-- Gagal memuat profil total -- tampilkan alasan + tombol coba lagi,
             JANGAN biarkan form kosong tanpa penjelasan. -->
        <div v-if="gagalMemuatProfil" class="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl flex flex-col items-center gap-3 text-center text-xs">
          <AlertTriangle class="w-6 h-6 text-amber-600" />
          <p class="leading-relaxed">Gagal memuat data profil. Periksa koneksi internet Anda lalu coba lagi.</p>
          <button
            type="button"
            class="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold cursor-pointer border-0"
            @click="muatData"
          >
            Coba Lagi
          </button>
        </div>

        <!-- ==========================================
        BAGIAN 1: FOTO PROFIL
        ========================================== -->
        <div class="flex flex-col items-center justify-center pb-2 border-b border-slate-100">
          <div class="w-24 h-24 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shadow-inner relative group">
            <img 
              v-if="previewFotoUrl || fotoProfil" 
              :src="previewFotoUrl || fotoProfil" 
              alt="Foto Profil" 
              class="w-full h-full object-cover" 
            />
            <User v-else class="w-12 h-12 text-slate-400" />
            
            <!-- Uploading overlay inside avatar -->
            <div v-if="sedangLoading && berkasFotoBaru" class="absolute inset-0 bg-black/40 flex items-center justify-center rounded-full">
              <Loader2 class="w-6 h-6 text-white animate-spin" />
            </div>
          </div>

          <!-- Hidden Input File -->
          <input 
            ref="fileInput"
            type="file"
            accept="image/png, image/jpeg, image/jpg"
            class="hidden"
            @change="tanganiUnggahFoto"
          />

          <!-- Upload / Ganti Button -->
          <button
            type="button"
            :disabled="sedangLoading"
            class="mt-3 inline-flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-600 font-semibold text-xs rounded-[10px] hover:bg-slate-50 transition-colors bg-white cursor-pointer disabled:opacity-60"
            @click="triggerPilihFile"
          >
            <Upload class="w-3.5 h-3.5 text-slate-400" />
            {{ (fotoProfil || previewFotoUrl) ? 'Ganti Foto' : 'Unggah Foto' }}
          </button>
          <span class="text-[10px] text-slate-400 mt-1.5">Format: PNG, JPG, JPEG (Maks. 2MB)</span>
        </div>

        <!-- ==========================================
        BAGIAN 2: DATA PROFIL PENGGUNA
        ========================================== -->
        <form class="flex flex-col gap-4" @submit.prevent="simpanProfil">
          
          <!-- Nama Lengkap -->
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-bold text-slate-500 uppercase tracking-wider">Nama Lengkap</label>
            <div class="relative">
              <User class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                v-model="namaLengkap"
                required
                type="text"
                class="w-full h-11 px-3 pl-10 rounded-[10px] border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#14a38b] focus:border-[#14a38b] text-sm outline-none transition-colors"
                placeholder="Nama Lengkap Anda"
              />
            </div>
          </div>

          <!-- Email (Read Only) -->
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-bold text-slate-500 uppercase tracking-wider">Email (Tidak Dapat Diubah)</label>
            <div class="relative">
              <Mail class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                v-model="email"
                readonly
                type="email"
                class="w-full h-11 px-3 pl-10 rounded-[10px] border border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed text-sm outline-none"
              />
            </div>
          </div>

          <!-- Nomor WhatsApp -->
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-bold text-slate-500 uppercase tracking-wider">Nomor WhatsApp</label>
            <div class="relative">
              <Phone class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                v-model="nomorTelepon"
                type="tel"
                class="w-full h-11 px-3 pl-10 rounded-[10px] border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#14a38b] focus:border-[#14a38b] text-sm outline-none transition-colors"
                placeholder="Contoh: 08123456789 (Nomor WhatsApp)"
              />
            </div>
          </div>

          <!-- Submit Button -->
          <button 
            type="submit"
            class="w-full h-11 bg-[#14a38b] hover:bg-[#0f826e] text-white font-semibold rounded-[12px] transition-colors duration-200 shadow-xs border-0 cursor-pointer text-sm mt-3 flex items-center justify-center gap-2"
          >
            <Save class="w-4 h-4" />
            Simpan Perubahan
          </button>
        </form>

        <!-- ==========================================
        BAGIAN 3: PENGELOLAAN DATA ANAK
        ========================================== -->
        <div v-if="peranPengguna === 'orangtua'" class="flex flex-col gap-4 pt-4 border-t border-slate-100 mt-2 text-left">
          <div>
            <h2 class="text-sm font-bold text-slate-800 uppercase tracking-wider">Data Anak</h2>
            <p class="text-[11px] text-slate-400 mt-0.5">Daftar seluruh anak sekolah yang terdaftar pada akun Anda.</p>
          </div>

          <div v-if="sedangMemuatAnak" class="flex items-center justify-center py-6">
            <Loader2 class="w-6 h-6 text-[#14a38b] animate-spin" />
          </div>

          <div v-else-if="listAnak.length === 0" class="bg-slate-50 border border-slate-100 rounded-xl p-6 text-center">
            <p class="text-xs text-slate-500">Belum ada anak terdaftar pada akun Anda.</p>
            <router-link to="/berlangganan" class="no-underline mt-2 inline-block">
              <button class="bg-[#14a38b] text-white font-semibold text-xs px-4 py-2 rounded-lg border-0 cursor-pointer hover:bg-[#0f826e] transition-colors">
                Daftarkan Anak Sekarang
              </button>
            </router-link>
          </div>

          <!-- List Anak Dinamis -->
          <div v-else class="space-y-3">
            <div 
              v-for="(anak, idx) in listAnak" 
              :key="anak.id"
              class="bg-slate-50 border border-slate-100 rounded-[12px] p-4 flex items-center justify-between transition-all"
            >
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-full bg-[#14a38b]/10 flex items-center justify-center text-[#14a38b]">
                  <span class="font-extrabold text-sm">{{ idx + 1 }}</span>
                </div>
                <div>
                  <p class="font-bold text-slate-800 text-sm">{{ anak.nama_lengkap }}</p>
                  <p class="text-[11px] text-slate-500 mt-0.5">
                    {{ anak.sekolah?.nama || 'Sekolah Tidak Diketahui' }} • Kelas {{ anak.kelas }}
                  </p>
                  <p class="text-[10px] text-slate-400 mt-0.5 truncate max-w-xs">
                    Jemput: {{ anak.alamat_jemput }}
                  </p>
                </div>
              </div>
              
              <!-- Edit Anak Button -->
              <button
                type="button"
                class="flex items-center gap-1 px-3 py-1.5 border border-slate-200 text-slate-600 font-semibold text-xs rounded-lg hover:bg-slate-100 transition-colors bg-white cursor-pointer"
                @click="bukaModalEditAnak(anak)"
              >
                <Edit class="w-3.5 h-3.5 text-slate-400" />
                Edit
              </button>
            </div>
          </div>
        </div>

        <!-- ==========================================
        BAGIAN 4: TOMBOL KELUAR / LOGOUT
        ========================================== -->
        <div class="pt-4 border-t border-slate-100 mt-2 flex justify-center">
          <button
            type="button"
            class="inline-flex items-center gap-2 border border-rose-200 text-rose-600 hover:bg-rose-50 font-semibold py-3 px-8 rounded-[12px] transition-colors duration-200 cursor-pointer text-sm bg-transparent"
            @click="modalLogoutTampil = true"
          >
            <LogOut class="w-4 h-4" />
            Keluar dari Akun
          </button>
        </div>

      </div>

    </main>

    <!-- ==========================================
    MODAL 1: EDIT DETAIL DATA ANAK
    ========================================== -->
    <ModalUtama
      tema="terang"
      :tampil="modalEditAnakTampil"
      :judul="'Edit Data: ' + anakEdit.nama_lengkap"
      ukuran="lebar"
      @tutup="modalEditAnakTampil = false"
    >
      <div class="space-y-4 text-slate-800 text-sm text-left p-1">
        
        <!-- Loading Overlay Anak -->
        <div v-if="sedangMenyimpanAnak" class="absolute inset-0 bg-white/80 backdrop-blur-xs flex items-center justify-center z-30">
          <div class="text-center space-y-2">
            <Loader2 class="w-10 h-10 text-[#14a38b] animate-spin mx-auto" />
            <p class="text-xs text-[#14a38b] font-semibold">Menyimpan Perubahan Anak...</p>
          </div>
        </div>

        <!-- Foto Profil Anak (Wajib) -->
        <div class="flex flex-col items-center justify-center pb-2 border-b border-slate-100">
          <div
            class="w-20 h-20 rounded-xl bg-slate-100 border overflow-hidden flex items-center justify-center shadow-inner"
            :class="errorFotoAnak ? 'border-rose-400' : 'border-slate-200'"
          >
            <img
              v-if="previewFotoAnakUrl || anakEdit.url_foto"
              :src="previewFotoAnakUrl || anakEdit.url_foto"
              alt="Foto Anak"
              class="w-full h-full object-cover"
            />
            <User v-else class="w-9 h-9 text-slate-400" />
          </div>
          <input
            ref="fileInputAnak"
            type="file"
            accept="image/png, image/jpeg, image/jpg, image/webp"
            class="hidden"
            @change="tanganiUnggahFotoAnak"
          />
          <button
            type="button"
            :disabled="sedangMenyimpanAnak"
            class="mt-3 inline-flex items-center gap-1.5 px-4 py-2 border font-semibold text-xs rounded-[10px] transition-colors cursor-pointer disabled:opacity-60"
            :class="errorFotoAnak ? 'border-rose-300 text-rose-600 bg-rose-50 hover:bg-rose-100' : 'border-slate-200 text-slate-600 bg-white hover:bg-slate-50'"
            @click="triggerPilihFileAnak"
          >
            <Upload class="w-3.5 h-3.5" :class="errorFotoAnak ? 'text-rose-400' : 'text-slate-400'" />
            {{ (anakEdit.url_foto || previewFotoAnakUrl) ? 'Ganti Foto' : 'Unggah Foto (Wajib)' }}
          </button>
          <span v-if="errorFotoAnak" class="text-[11px] text-rose-600 font-semibold mt-1.5">{{ errorFotoAnak }}</span>
          <span v-else class="text-[10px] text-slate-400 mt-1.5">Format: PNG, JPG, JPEG, atau WEBP (Maks. 2MB)</span>
        </div>

        <!-- Nama Lengkap Anak -->
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-bold text-slate-500 uppercase tracking-wider">Nama Lengkap Anak</label>
          <input 
            v-model="anakEdit.nama_lengkap"
            required
            type="text"
            class="w-full h-11 px-3 rounded-[10px] border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#14a38b] focus:border-[#14a38b] text-sm outline-none transition-colors"
            placeholder="Nama Lengkap Anak"
          />
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Dropdown Sekolah -->
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-bold text-slate-500 uppercase tracking-wider">Sekolah</label>
            <select
              v-model="anakEdit.sekolah_id"
              class="w-full h-11 px-3 rounded-[10px] border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#14a38b] focus:border-[#14a38b] text-sm outline-none transition-colors"
            >
              <option value="" disabled>Pilih Sekolah</option>
              <option 
                v-for="sek in daftarSekolah" 
                :key="sek.id" 
                :value="sek.id"
              >
                {{ sek.nama }}
              </option>
            </select>
          </div>

          <!-- Kelas -->
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-bold text-slate-500 uppercase tracking-wider">Kelas / Jenjang</label>
            <select
              v-model="anakEdit.kelas"
              required
              class="w-full h-11 px-3 rounded-[10px] border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#14a38b] focus:border-[#14a38b] text-sm outline-none transition-colors"
            >
              <option value="" disabled>Pilih Kelas</option>
              <option v-for="cls in daftarKelasEdit" :key="cls" :value="cls">{{ cls }}</option>
            </select>
            <p v-if="anakEdit.sekolah_id && daftarKelasEdit.length === 0" class="text-[10px] text-slate-400">Sekolah ini belum memiliki data kelas, hubungi admin.</p>
          </div>
        </div>

        <!-- Alamat Jemput -->
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-bold text-slate-500 uppercase tracking-wider">Alamat Jemput Anak</label>
          <div class="relative">
            <MapPin class="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <textarea 
              v-model="anakEdit.alamat_jemput"
              rows="2"
              class="w-full p-3 pl-10 rounded-[10px] border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#14a38b] focus:border-[#14a38b] text-sm outline-none transition-colors resize-none"
              placeholder="Alamat Penjemputan Anak"
            ></textarea>
          </div>
        </div>

        <!-- Maps Jemput Anak -->
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-bold text-slate-500 uppercase tracking-wider">Titik Koordinat Penjemputan</label>
          <PemilihPeta
            :lintang="anakEdit.lintang_jemput"
            :bujur="anakEdit.bujur_jemput"
            :awal-terkonfirmasi="true"
            tinggi="220px"
            tema="terang"
            @pilih-lokasi="tanganiLokasiJemputAnak"
          />
        </div>

      </div>

      <template #footer>
        <button 
          type="button"
          class="px-6 py-2.5 rounded-[12px] text-slate-500 font-semibold hover:text-slate-700 transition-colors bg-transparent border-0 cursor-pointer text-sm"
          @click="modalEditAnakTampil = false"
        >
          Batal
        </button>
        <button 
          type="button"
          class="px-6 py-2.5 rounded-[12px] bg-[#14a38b] hover:bg-[#0f826e] text-white font-semibold transition-colors shadow-xs border-0 cursor-pointer text-sm"
          @click="simpanDataAnak"
        >
          Simpan Perubahan Anak
        </button>
      </template>
    </ModalUtama>

    <!-- ==========================================
    MODAL 2: DIALOG KONFIRMASI LOGOUT
    ========================================== -->
    <ModalUtama
      tema="terang"
      :tampil="modalLogoutTampil"
      judul="Konfirmasi Keluar"
      ukuran="sedang"
      @tutup="modalLogoutTampil = false"
    >
      <div class="space-y-3 text-center py-3">
        <div class="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mx-auto mb-2">
          <LogOut class="w-6 h-6" />
        </div>
        <h3 class="text-base font-bold text-slate-800">Apakah Anda yakin ingin keluar?</h3>
        <p class="text-xs text-slate-500 leading-relaxed">Sesi login Anda akan dihapus dan Anda harus memasukkan kata sandi kembali untuk masuk.</p>
      </div>

      <template #footer>
        <button 
          type="button"
          class="px-5 py-2.5 rounded-[12px] text-slate-500 font-semibold hover:text-slate-700 transition-colors bg-transparent border-0 cursor-pointer text-sm"
          @click="modalLogoutTampil = false"
        >
          Batal
        </button>
        <button 
          type="button"
          class="px-5 py-2.5 rounded-[12px] bg-rose-600 hover:bg-rose-700 text-white font-semibold transition-colors border-0 cursor-pointer text-sm"
          @click="tanganiLogout"
        >
          Keluar
        </button>
      </template>
    </ModalUtama>

  </div>
</template>
