import { supabase } from './supabase';
import { ambilWaktuSekarang } from '../bantuan/waktuSimulasi';

const kunciKlien = import.meta.env.VITE_MIDTRANS_CLIENT_KEY;
const isSandbox = import.meta.env.VITE_MIDTRANS_IS_PRODUCTION !== 'true';

function klienWajibAda() {
  if (!supabase) {
    throw new Error('Supabase tidak dikonfigurasi. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di file .env');
  }
  return supabase;
}

// Helper untuk memuat script Snap.js secara dinamis di frontend
export function muatScriptSnap(): Promise<boolean> {
  return new Promise((resolve) => {
    if (document.getElementById('midtrans-snap-script')) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.id = 'midtrans-snap-script';
    script.src = isSandbox
      ? 'https://app.sandbox.midtrans.com/snap/snap.js'
      : 'https://app.midtrans.com/snap/snap.js';
    script.setAttribute('data-client-key', kunciKlien);

    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);

    document.body.appendChild(script);
  });
}

/**
 * Meminta token Snap yang SUNGGUHAN dari Midtrans lewat Edge Function
 * "buat-transaksi-midtrans" (server yang memegang Server Key). Lihat
 * supabase/functions/buat-transaksi-midtrans/index.ts untuk detail kenapa
 * ini tidak boleh dipanggil langsung ke API Midtrans dari client.
 *
 * Menerima SATU atau LEBIH pembayaranId sekaligus (Pembayaran Gabungan
 * Multi-Anak) -- kalau lebih dari satu, semuanya dilunasi lewat SATU
 * transaksi Snap untuk totalnya (Edge Function yang menjumlahkan & menaruh
 * order_id yang sama di semua baris pembayaran terkait).
 */
export async function buatTransaksiMidtrans(pembayaranIds: string | string[]): Promise<{ token: string; urlRedirect: string }> {
  const client = klienWajibAda();
  const idList = Array.isArray(pembayaranIds) ? pembayaranIds : [pembayaranIds];

  // SENGAJA pakai fetch() langsung, bukan client.functions.invoke() --
  // supabase-js@2.47.10 membungkus response non-2xx jadi FunctionsHttpError
  // generik ("Edge Function returned a non-2xx status code") dan pesan JSON
  // asli yang sudah kita tulis di response body (alasan sebenarnya, mis.
  // error dari Midtrans) tidak pernah sampai ke sini -- terbukti tidak bisa
  // digali ulang lewat error.context.clone().json() (kemungkinan body
  // stream sudah kepakai duluan oleh internal invoke()). fetch() manual
  // memberi kontrol penuh membaca body persis sekali di sini.
  const { data: sessionData } = await client.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error('Sesi login tidak valid, silakan login ulang.');

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

  const res = await fetch(`${supabaseUrl}/functions/v1/buat-transaksi-midtrans`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      apikey: anonKey
    },
    // waktuKlien: dititipkan supaya midtrans-webhook (Edge Function yang
    // dipanggil langsung oleh Midtrans, tidak pernah tahu localStorage
    // klien) bisa menghitung tanggal_berakhir langganan mengikuti fitur
    // "waktu simulasi" demo, bukan waktu server sungguhan.
    body: JSON.stringify({ pembayaranIds: idList, waktuKlien: ambilWaktuSekarang().toISOString() })
  });

  const hasil = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(hasil?.error || `Gagal membuat transaksi Midtrans (status ${res.status}).`);
  }
  return { token: hasil.token, urlRedirect: hasil.redirect_url };
}

/**
 * Integrasi Frontend: Menampilkan pop-up pembayaran Snap Midtrans yang
 * sungguhan. Status pembayaran TIDAK diubah langsung dari callback ini --
 * konfirmasi resmi datang dari webhook Midtrans (lihat
 * supabase/functions/midtrans-webhook/index.ts) yang memperbarui baris
 * `pembayaran`/`langganan` di database. Callback di sini hanya dipakai
 * untuk feedback UI (mis. menampilkan status "menunggu konfirmasi").
 */
export async function bayarDenganMidtrans(
  tokenSnap: string,
  onSukses?: (hasil: any) => void,
  onMenunggu?: (hasil: any) => void,
  onError?: (err: any) => void,
  onClose?: () => void
) {
  const scriptLoaded = await muatScriptSnap();
  if (!scriptLoaded) {
    if (onError) onError(new Error('Gagal memuat skrip pembayaran Midtrans Snap.js'));
    return;
  }

  const snap = (window as any).snap;
  if (!snap) {
    if (onError) onError(new Error('Modul pembayaran Snap tidak ditemukan pada browser.'));
    return;
  }

  snap.pay(tokenSnap, {
    onSuccess: function (result: any) {
      if (onSukses) onSukses(result);
    },
    onPending: function (result: any) {
      if (onMenunggu) onMenunggu(result);
    },
    onError: function (result: any) {
      if (onError) onError(result);
    },
    onClose: function () {
      if (onClose) onClose();
    }
  });
}

/**
 * Menunggu webhook Midtrans (Edge Function "midtrans-webhook") mengubah
 * status SELURUH baris `pembayaran` yang diberikan menjadi 'lunas'/'gagal'
 * -- konfirmasi resmi TIDAK PERNAH dilakukan langsung dari client, jadi di
 * sini kita polling status terbaru dari database setiap beberapa detik
 * sampai semuanya lunas (atau ada satu yang gagal) atau timeout. Dipakai
 * oleh prosesPembayaranMidtrans() di bawah -- kalau pembayaranIds lebih
 * dari satu (Pembayaran Gabungan Multi-Anak), webhook menandai semuanya
 * lunas bersamaan (satu order_id yang sama), tapi tetap di-poll semuanya
 * untuk jaga-jaga kalau ada race condition kecil antar UPDATE baris.
 */
export async function tungguKonfirmasiPembayaran(
  pembayaranIds: string | string[],
  timeoutMs = 120000
): Promise<'lunas' | 'gagal' | 'timeout'> {
  const client = supabase;
  if (!client) return 'lunas'; // fallback mock (Supabase tidak dikonfigurasi)
  const idList = Array.isArray(pembayaranIds) ? pembayaranIds : [pembayaranIds];

  const mulai = Date.now();
  while (Date.now() - mulai < timeoutMs) {
    const { data } = await client.from('pembayaran').select('status').in('id', idList);
    const statusList = (data ?? []).map((d) => d.status);
    if (statusList.length === idList.length) {
      if (statusList.some((s) => s === 'gagal')) return 'gagal';
      if (statusList.every((s) => s === 'lunas')) return 'lunas';
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  return 'timeout';
}

/**
 * Cek SEKALI (bukan polling) status baris `pembayaran` terkini -- dipakai
 * tombol "Cek Status Sekarang" setelah prosesPembayaranMidtrans()
 * mengembalikan 'timeout_setelah_sukses', supaya pengguna bisa memeriksa
 * ulang tanpa perlu menunggu polling otomatis lagi atau reload halaman.
 */
export async function cekStatusPembayaran(pembayaranIds: string | string[]): Promise<'lunas' | 'gagal' | 'menunggu'> {
  const client = supabase;
  if (!client) return 'lunas';
  const idList = Array.isArray(pembayaranIds) ? pembayaranIds : [pembayaranIds];
  const { data } = await client.from('pembayaran').select('status').in('id', idList);
  const statusList = (data ?? []).map((d) => d.status);
  if (statusList.length !== idList.length) return 'menunggu';
  if (statusList.some((s) => s === 'gagal')) return 'gagal';
  if (statusList.every((s) => s === 'lunas')) return 'lunas';
  return 'menunggu';
}

/**
 * Satu kali percobaan alur pembayaran Midtrans untuk SATU ATAU LEBIH baris
 * `pembayaran` sekaligus (Pembayaran Gabungan Multi-Anak -- kalau
 * pembayaranIds lebih dari satu, semuanya dilunasi lewat SATU popup Snap
 * untuk totalnya, bukan satu-satu per anak): buat transaksi baru lalu buka
 * popup Snap. Kalau pengguna menutup popup (baik sebelum sempat pilih
 * metode, maupun sesudah pilih metode seperti Alfamart/Indomaret/VA lalu
 * tidak kunjung membayar), fungsi ini BERHENTI dan mengembalikan 'batal' --
 * pengguna harus menekan tombol "Bayar Sekarang" lagi untuk membuka popup
 * baru (tidak otomatis mencoba ulang).
 *
 * PENTING soal batasan nyata Snap.js: hanya SATU dari onSuccess/onPending/
 * onError yang pernah dipanggil per percobaan, dan begitu salah satunya
 * terpanggil popup langsung menutup diri sendiri -- onClose TIDAK akan
 * menyusul setelah onPending (sempat salah diasumsikan sebelumnya,
 * menyebabkan alur macet selamanya di "menunggu konfirmasi" saat pengguna
 * salah pilih metode). Karena itu, begitu status "pending" diterima, kita
 * HANYA menunggu konfirmasi lunas dalam jangka pendek (timeoutPendingMs) --
 * kalau belum lunas juga dalam waktu itu, dianggap "ditinggal" dan
 * langsung dikembalikan sebagai 'batal' (bukan otomatis dicoba ulang).
 */
export async function prosesPembayaranMidtrans(
  pembayaranIds: string | string[],
  opsi: {
    onProgres?: (teks: string) => void;
    timeoutPendingMs?: number;
    timeoutSuksesMs?: number;
  } = {}
): Promise<'lunas' | 'gagal' | 'batal' | 'timeout_setelah_sukses'> {
  const idList = Array.isArray(pembayaranIds) ? pembayaranIds : [pembayaranIds];
  const timeoutPendingMs = opsi.timeoutPendingMs ?? 15000;
  // SEBELUMNYA 120 detik -- pengguna terpaku pada spinner "Menunggu
  // konfirmasi pembayaran..." tanpa kepastian sampai 2 menit penuh kalau
  // webhook Midtrans lambat/tidak terdaftar dengan benar. Dipersingkat jadi
  // 45 detik supaya tidak terasa macet; kalau memang belum lunas juga
  // setelah itu, dikembalikan sbg 'timeout_setelah_sukses' (BUKAN 'batal')
  // -- lihat catatan di bawah kenapa keduanya harus dibedakan.
  const timeoutSuksesMs = opsi.timeoutSuksesMs ?? 45000;
  const lapor = (teks: string) => opsi.onProgres?.(teks);

  lapor('Membuka jendela pembayaran...');
  const { token } = await buatTransaksiMidtrans(idList);

  const hasilPopup = await new Promise<'sukses' | 'pending' | 'tutup' | 'error'>((resolve) => {
    bayarDenganMidtrans(
      token,
      () => resolve('sukses'),
      () => resolve('pending'),
      () => resolve('error'),
      () => resolve('tutup')
    );
  });

  if (hasilPopup === 'error') return 'gagal';
  if (hasilPopup === 'tutup') return 'batal';

  lapor(
    hasilPopup === 'pending'
      ? 'Menunggu penyelesaian pembayaran...'
      : 'Menunggu konfirmasi pembayaran...'
  );
  const status = await tungguKonfirmasiPembayaran(
    idList,
    hasilPopup === 'pending' ? timeoutPendingMs : timeoutSuksesMs
  );
  if (status === 'lunas') return 'lunas';
  if (status === 'gagal') return 'gagal';

  // Timeout: Midtrans SENDIRI sudah bilang 'sukses' (Snap onSuccess benar-
  // benar terpanggil) -- webhook kita yang belum sempat mengonfirmasi ke
  // database dalam batas waktu di atas, BUKAN pembayarannya yang gagal/
  // dibatalkan. Membedakan ini dari 'batal' (ditinggal/ditutup sebelum
  // sempat bayar) penting supaya pemanggil TIDAK menyuruh pengguna
  // "Bayar Sekarang" lagi -- itu bisa berarti membayar dua kali padahal
  // pembayaran pertama kemungkinan besar sudah berhasil.
  if (hasilPopup === 'sukses') return 'timeout_setelah_sukses';
  return 'batal'; // hasilPopup === 'pending' & timeout -> anggap ditinggal, minta pengguna coba lagi manual
}
