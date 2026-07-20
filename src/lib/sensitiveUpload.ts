export const MAX_SENSITIVE_UPLOAD_BYTES = 10 * 1024 * 1024;

export async function validateSensitiveUpload(file: File): Promise<{ extension: string; mimeType: string }> {
  if (file.size <= 0 || file.size > MAX_SENSITIVE_UPLOAD_BYTES) throw new Error('File must be between 1 byte and 10 MB.');
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const ascii = String.fromCharCode(...bytes);

  if (ascii.startsWith('%PDF-')) return { extension: 'pdf', mimeType: 'application/pdf' };
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { extension: 'jpg', mimeType: 'image/jpeg' };
  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.slice(0, 8).every((value, index) => value === pngSignature[index])) return { extension: 'png', mimeType: 'image/png' };

  const heifBrand = ascii.slice(4, 12).toLowerCase();
  if (heifBrand.startsWith('ftyp') && ['heic', 'heix', 'hevc', 'hevx', 'mif1'].some((brand) => heifBrand.includes(brand))) {
    return { extension: 'heic', mimeType: 'image/heic' };
  }
  throw new Error('Unsupported file contents. Upload a genuine PDF, JPEG, PNG, or HEIC file.');
}

