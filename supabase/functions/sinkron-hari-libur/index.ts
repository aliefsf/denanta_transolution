// Edge Function: sinkron-hari-libur
//
// Mengambil daftar hari libur nasional Indonesia dari API kalender
// eksternal publik (date.nager.at -- gratis, tanpa API key) untuk tahun
// berjalan + tahun berikutnya, lalu menyimpannya ke tabel
// `hari_libur` (jenis='nasional', sekolah_id=null, sumber='api'). Dipicu:
//   1. Manual oleh Admin lewat tombol "Sinkronkan dari API" di
//      KelolaJadwalAdmin.vue (lihat sinkronkanHariLiburDariApi() di
//      src/layanan/kalenderLayanan.ts).
//   2. (Opsional) berkala lewat pg_cron -- lihat sinkron_hari_libur_cron.sql.
//
// PENTING soal duplikasi: baris yang sudah ada dengan sumber='manual'
// (ditambahkan Admin sendiri -- libur sekolah tambahan, kegiatan sekolah,
// cuti bersama internal) TIDAK PERNAH ditimpa oleh sinkronisasi ini, walau
// kebetulan tanggalnya sama dengan hasil dari API. Hanya baris yang
// SEBELUMNYA juga berasal dari API (sumber='api') yang boleh diperbarui
// (mis. nama hari libur dikoreksi upstream).
//
// Deploy manual (tidak ada akses CLI dari environment Claude Code ini):
//   supabase functions deploy sinkron-hari-libur

import { createClient } from 'jsr:@supabase/supabase-js@2';

// Function ini dipanggil LANGSUNG dari browser (client.functions.invoke()
// di kalenderLayanan.ts), beda dari pengingat-tagihan/midtrans-webhook yang
// cuma dipanggil server-to-server (pg_cron/Midtrans) -- tanpa header CORS
// ini, browser MEMBLOKIR request lintas-origin (localhost:5173 ->
// *.supabase.co) sebelum sempat sampai ke kode di bawah, persis pola yang
// sudah dipakai buat-transaksi-midtrans/buat-akun-supir.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

interface HariLiburEksternal {
  tanggal: string; // YYYY-MM-DD
  nama: string;
  keterangan: string | null;
}

// Sumber: date.nager.at (Nager.Date) -- API publik hari libur internasional,
// gratis, tanpa API key, sudah lama berjalan & dipakai luas, mendukung
// Indonesia lewat kode negara "ID". Format respons: array of
// { date: "YYYY-MM-DD", localName: string, name: string, countryCode: "ID", ... }.
// SEBELUMNYA memakai api-harilibur.vercel.app (proyek komunitas), tapi
// ternyata sekarang membalas 402 Payment Required -- diganti ke sumber yang
// lebih stabil. Kalau upstream ini pun suatu saat berubah format/mati,
// cukup ganti URL & isi fungsi ini saja -- bagian lain function (upsert,
// pembedaan manual/api) tidak perlu diubah.
async function ambilDariApiEksternal(tahun: number): Promise<HariLiburEksternal[]> {
  const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${tahun}/ID`);
  if (!res.ok) throw new Error(`API kalender eksternal membalas status ${res.status} untuk tahun ${tahun}.`);
  const mentah = await res.json();
  if (!Array.isArray(mentah)) throw new Error('Format respons API kalender eksternal tidak dikenali (bukan array).');

  return mentah
    .map((item: any) => ({
      tanggal: item.date,
      nama: item.localName ?? item.name ?? 'Hari Libur Nasional',
      keterangan: item.name && item.name !== item.localName ? item.name : 'Hari Libur Nasional'
    }))
    .filter((h: HariLiburEksternal) => !!h.tanggal);
}

Deno.serve(async (req) => {
  // Preflight -- browser mengirim OPTIONS dulu sebelum request POST
  // sungguhan, WAJIB dijawab dengan corsHeaders atau request aslinya tidak
  // pernah dikirim sama sekali.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const client = createClient(supabaseUrl, supabaseServiceRoleKey);

    let tahunDiminta: number | null = null;
    try {
      const body = await req.json();
      if (typeof body?.tahun === 'number') tahunDiminta = body.tahun;
    } catch {
      // Tidak ada body / bukan JSON -- pakai default (tahun berjalan + berikutnya).
    }

    const tahunSekarang = new Date().getUTCFullYear();
    const daftarTahun = tahunDiminta ? [tahunDiminta] : [tahunSekarang, tahunSekarang + 1];

    let totalDiperiksa = 0;
    let totalDitambah = 0;
    let totalDiperbarui = 0;
    let totalDilewati = 0;
    const kegagalanPerTahun: Record<number, string> = {};

    for (const tahun of daftarTahun) {
      let daftarEksternal: HariLiburEksternal[];
      try {
        daftarEksternal = await ambilDariApiEksternal(tahun);
      } catch (err) {
        kegagalanPerTahun[tahun] = (err as Error).message;
        continue;
      }

      // Ambil semua baris `hari_libur` NASIONAL (sekolah_id null) yang SUDAH
      // ada untuk tahun ini, supaya bisa dibandingkan satu-satu -- baik utk
      // mendeteksi baris manual (jangan ditimpa) maupun baris api lama
      // (boleh diperbarui).
      const { data: existingRows, error: errExisting } = await client
        .from('hari_libur')
        .select('id, tanggal, nama, keterangan, sumber')
        .is('sekolah_id', null)
        .gte('tanggal', `${tahun}-01-01`)
        .lte('tanggal', `${tahun}-12-31`);
      if (errExisting) {
        kegagalanPerTahun[tahun] = errExisting.message;
        continue;
      }

      const petaExisting = new Map((existingRows ?? []).map((r) => [r.tanggal, r]));

      for (const libur of daftarEksternal) {
        totalDiperiksa++;
        const existing = petaExisting.get(libur.tanggal);

        if (!existing) {
          const { error: errInsert } = await client.from('hari_libur').insert({
            tanggal: libur.tanggal,
            nama: libur.nama,
            jenis: 'nasional',
            sekolah_id: null,
            keterangan: libur.keterangan,
            sumber: 'api'
          });
          if (errInsert) {
            kegagalanPerTahun[tahun] = errInsert.message;
            continue;
          }
          totalDitambah++;
        } else if (existing.sumber === 'api') {
          if (existing.nama !== libur.nama || existing.keterangan !== libur.keterangan) {
            const { error: errUpdate } = await client
              .from('hari_libur')
              .update({ nama: libur.nama, keterangan: libur.keterangan })
              .eq('id', existing.id);
            if (errUpdate) {
              kegagalanPerTahun[tahun] = errUpdate.message;
              continue;
            }
            totalDiperbarui++;
          } else {
            totalDilewati++;
          }
        } else {
          // sumber === 'manual' -- SENGAJA tidak disentuh sama sekali.
          totalDilewati++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        tahunDiproses: daftarTahun,
        totalDiperiksa,
        totalDitambah,
        totalDiperbarui,
        totalDilewati,
        kegagalanPerTahun: Object.keys(kegagalanPerTahun).length > 0 ? kegagalanPerTahun : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message || 'Terjadi kesalahan tak terduga.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
