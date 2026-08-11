// Dipakai bersama oleh setiap alur unggah foto (profil pengguna, foto anak,
// dst) supaya berkas asli dari kamera/galeri (bisa berukuran MB) tidak
// diunggah mentah-mentah -- dikompresi ke JPEG kecil dulu di sisi klien lewat
// canvas, jauh lebih hemat kuota Storage & lebih cepat dimuat di UI.

/**
 * Kompresi gambar ke JPEG persegi (maksimal maxW x maxH, mempertahankan
 * aspect ratio), dikembalikan sebagai data URL base64.
 */
export function kompresiGambar(file: File, maxW = 150, maxH = 150): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new window.Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxW) {
            height = Math.round((height * maxW) / width);
            width = maxW;
          }
        } else {
          if (height > maxH) {
            width = Math.round((width * maxH) / height);
            height = maxH;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

/** Konversi data URL base64 (hasil kompresiGambar) menjadi Blob siap unggah. */
export function konversiBase64KeBlob(base64: string): Blob {
  const parts = base64.split(';base64,');
  const contentType = parts[0].split(':')[1];
  const raw = window.atob(parts[1]);
  const rawLength = raw.length;
  const uInt8Array = new Uint8Array(rawLength);
  for (let i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }
  return new Blob([uInt8Array], { type: contentType });
}
