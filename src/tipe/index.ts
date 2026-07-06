export interface Kordinat {
  lat: number;
  lng: number;
}

export interface Pengguna {
  id: string;
  nama: string;
  surel: string;
  peran: 'tamu' | 'orangtua' | 'supir' | 'admin';
  noTelepon?: string;
}

export interface Anak {
  id: string;
  nama: string;
  idOrangTua: string;
  alamatJemput: string;
  statusJemput: 'Belum Dijemput' | 'Sudah Dijemput' | 'Tiba di Sekolah';
}

export interface Supir {
  id: string;
  nama: string;
  noPolisi: string;
  jenisKendaraan: string;
  lokasiTerkini?: Kordinat;
  aktif: boolean;
}

export interface Tagihan {
  id: string;
  bulan: string;
  total: number;
  status: 'Belum Dibayar' | 'Lunas';
  idOrangTua: string;
}
