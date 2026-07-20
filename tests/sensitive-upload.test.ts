import assert from 'node:assert/strict';
import test from 'node:test';
import { validateSensitiveUpload } from '../src/lib/sensitiveUpload.ts';

test('accepts PDF contents independently of the supplied filename and MIME', async () => {
  const file = new File([new TextEncoder().encode('%PDF-1.7')], 'misleading.txt', { type: 'text/plain' });
  assert.deepEqual(await validateSensitiveUpload(file), { extension: 'pdf', mimeType: 'application/pdf' });
});

test('accepts JPEG and PNG magic bytes', async () => {
  const jpeg = new File([Uint8Array.from([0xff, 0xd8, 0xff, 0xe0])], 'receipt.jpg');
  const png = new File([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], 'receipt.png');
  assert.equal((await validateSensitiveUpload(jpeg)).mimeType, 'image/jpeg');
  assert.equal((await validateSensitiveUpload(png)).mimeType, 'image/png');
});

test('rejects renamed executables and empty files', async () => {
  await assert.rejects(() => validateSensitiveUpload(new File([new TextEncoder().encode('MZ executable')], 'receipt.pdf')), /Unsupported file contents/);
  await assert.rejects(() => validateSensitiveUpload(new File([], 'empty.pdf')), /between 1 byte and 10 MB/);
});
