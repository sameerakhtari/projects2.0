// A deliberately narrow raster format: 8-bit non-interlaced RGB/RGBA PNG.
// Ancillary chunks (including EXIF, text, ICC and animation) are never retained.
const signature = [137, 80, 78, 71, 13, 10, 26, 10];
export class InvalidImage extends Error {}
// Table-driven CRC bounds CPU overhead for the maximum accepted upload.
const crcTable = Uint32Array.from({ length: 256 }, (_, i) => {
  let v = i;
  for (let bit = 0; bit < 8; bit++) v = (v >>> 1) ^ (v & 1 ? 0xedb88320 : 0);
  return v >>> 0;
});
function crc(bytes: Uint8Array) {
  let v = 0xffffffff;
  for (const b of bytes) v = (v >>> 8) ^ crcTable[(v ^ b) & 255];
  return (v ^ 0xffffffff) >>> 0;
}
export async function sanitizePng(bytes: Uint8Array) {
  if (
    bytes.length < 57 ||
    bytes.length > 5 * 1024 * 1024 ||
    !signature.every((b, i) => bytes[i] === b)
  )
    throw new InvalidImage("Choose a PNG image under 5 MB.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const kept: Uint8Array[] = [bytes.subarray(0, 8)],
    compressed: Uint8Array[] = [];
  let offset = 8,
    chunks = 0,
    width = 0,
    height = 0,
    channels = 0,
    ended = false,
    compressedSize = 0;
  while (offset < bytes.length) {
    if (++chunks > 512 || offset + 12 > bytes.length)
      throw new InvalidImage("Invalid PNG structure.");
    const length = view.getUint32(offset);
    const end = offset + 12 + length;
    if (end > bytes.length) throw new InvalidImage("Truncated PNG.");
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    if (
      !/^[A-Za-z]{4}$/.test(type) ||
      crc(bytes.subarray(offset + 4, end - 4)) !== view.getUint32(end - 4)
    )
      throw new InvalidImage("Invalid PNG checksum.");
    if (chunks === 1 && type !== "IHDR")
      throw new InvalidImage("Invalid PNG header.");
    if (type === "IHDR") {
      if (chunks !== 1 || length !== 13)
        throw new InvalidImage("Invalid PNG header.");
      width = view.getUint32(offset + 8);
      height = view.getUint32(offset + 12);
      const color = bytes[offset + 17];
      channels = color === 2 ? 3 : color === 6 ? 4 : 0;
      if (
        !width ||
        !height ||
        width > 4096 ||
        height > 4096 ||
        width * height > 4000000 ||
        !channels ||
        bytes[offset + 16] !== 8 ||
        bytes[offset + 18] !== 0 ||
        bytes[offset + 19] !== 0 ||
        bytes[offset + 20] !== 0
      )
        throw new InvalidImage(
          "Use an 8-bit RGB PNG up to 4 megapixels. The editor converts photos automatically.",
        );
      kept.push(bytes.subarray(offset, end));
    } else if (type === "IDAT") {
      if (!length || ended) throw new InvalidImage("Invalid PNG image data.");
      compressed.push(bytes.subarray(offset + 8, end - 4));
      compressedSize += length;
      kept.push(bytes.subarray(offset, end));
    } else if (type === "IEND") {
      if (length !== 0 || !compressed.length || end !== bytes.length)
        throw new InvalidImage("Invalid PNG ending.");
      kept.push(bytes.subarray(offset, end));
      ended = true;
    } else if ((type.charCodeAt(0) & 32) === 0 && type !== "PLTE")
      throw new InvalidImage("Unsupported PNG content.");
    offset = end;
  }
  if (!ended) throw new InvalidImage("PNG ending is missing.");
  const data = new Uint8Array(compressedSize);
  let at = 0;
  for (const part of compressed) {
    data.set(part, at);
    at += part.length;
  }
  const expected = (width * channels + 1) * height;
  let decoded = 0;
  const reader = new Blob([data])
    .stream()
    .pipeThrough(new DecompressionStream("deflate"))
    .getReader();
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (decoded + value.length > expected) {
        await reader.cancel();
        throw new InvalidImage("PNG decompressed size is invalid.");
      }
      const stride = width * channels + 1;
      for (
        let i = (stride - (decoded % stride)) % stride;
        i < value.length;
        i += stride
      )
        if (value[i] > 4) throw new InvalidImage("Invalid PNG filter.");
      decoded += value.length;
    }
  } catch {
    throw new InvalidImage("PNG image data could not be decoded.");
  } finally {
    reader.releaseLock();
  }
  if (decoded !== expected)
    throw new InvalidImage("PNG pixel data is incomplete.");
  const output = new Uint8Array(kept.reduce((n, c) => n + c.length, 0));
  at = 0;
  for (const part of kept) {
    output.set(part, at);
    at += part.length;
  }
  return { bytes: output, width, height, mime: "image/png" as const };
}
