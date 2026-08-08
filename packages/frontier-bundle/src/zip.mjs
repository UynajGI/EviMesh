/**
 * Minimal ZIP support (stored, uncompressed) so bundles can be produced and
 * inspected without external dependencies. Format reference: PKZIP APPNOTE
 * local file header + central directory + end-of-central-directory record.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const time = ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | ((date.getSeconds() >> 1) & 0x1f);
  const day = (((date.getFullYear() - 1980) & 0x7f) << 9) | (((date.getMonth() + 1) & 0xf) << 5) | (date.getDate() & 0x1f);
  return { time, day };
}

function writeUInt16(view, offset, value) {
  view.setUint16(offset, value, true);
  return offset + 2;
}

function writeUInt32(view, offset, value) {
  view.setUint32(offset, value >>> 0, true);
  return offset + 4;
}

/** Create a stored (uncompressed) ZIP archive from `{path: Uint8Array}` files. */
export function createZip(files, { now = new Date() } = {}) {
  const entries = Object.entries(files).sort(([a], [b]) => a.localeCompare(b));
  const encoder = new TextEncoder();
  const { time, day } = dosDateTime(now);

  const chunks = [];
  const central = [];
  let offset = 0;

  for (const [path, content] of entries) {
    const nameBytes = encoder.encode(path);
    const data = content instanceof Uint8Array ? content : encoder.encode(String(content));
    const checksum = crc32(data);

    const local = new DataView(new ArrayBuffer(30));
    let pos = writeUInt32(local, 0, 0x04034b50);
    pos = writeUInt16(local, pos, 20);
    pos = writeUInt16(local, pos, 0x0800); // UTF-8 names
    pos = writeUInt16(local, pos, 0); // method: store
    pos = writeUInt16(local, pos, time);
    pos = writeUInt16(local, pos, day);
    pos = writeUInt32(local, pos, checksum);
    pos = writeUInt32(local, pos, data.length);
    pos = writeUInt32(local, pos, data.length);
    pos = writeUInt16(local, pos, nameBytes.length);
    writeUInt16(local, pos, 0);

    chunks.push(new Uint8Array(local.buffer), nameBytes, data);

    const record = new DataView(new ArrayBuffer(46));
    pos = writeUInt32(record, 0, 0x02014b50);
    pos = writeUInt16(record, pos, 20);
    pos = writeUInt16(record, pos, 20);
    pos = writeUInt16(record, pos, 0x0800);
    pos = writeUInt16(record, pos, 0);
    pos = writeUInt16(record, pos, time);
    pos = writeUInt16(record, pos, day);
    pos = writeUInt32(record, pos, checksum);
    pos = writeUInt32(record, pos, data.length);
    pos = writeUInt32(record, pos, data.length);
    pos = writeUInt16(record, pos, nameBytes.length);
    pos = writeUInt16(record, pos, 0);
    pos = writeUInt16(record, pos, 0);
    pos = writeUInt16(record, pos, 0);
    pos = writeUInt16(record, pos, 0);
    pos = writeUInt32(record, pos, 0);
    writeUInt32(record, pos, offset);

    central.push(new Uint8Array(record.buffer), nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }

  const centralSize = central.reduce((sum, chunk) => sum + chunk.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  let pos = writeUInt32(end, 0, 0x06054b50);
  pos = writeUInt16(end, pos, 0);
  pos = writeUInt16(end, pos, 0);
  pos = writeUInt16(end, pos, entries.length);
  pos = writeUInt16(end, pos, entries.length);
  pos = writeUInt32(end, pos, centralSize);
  pos = writeUInt32(end, pos, offset);
  writeUInt16(end, pos, 0);

  const total = offset + centralSize + 22;
  const output = new Uint8Array(total);
  let cursor = 0;
  for (const chunk of [...chunks, ...central, new Uint8Array(end.buffer)]) {
    output.set(chunk, cursor);
    cursor += chunk.length;
  }
  return output;
}

/** Read a stored ZIP archive back into `{path: Uint8Array}`. */
export function readZip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  const files = {};

  let offset = 0;
  while (offset + 30 <= bytes.length) {
    const signature = view.getUint32(offset, true);
    if (signature !== 0x04034b50) break;
    const method = view.getUint16(offset + 8, true);
    if (method !== 0) throw new Error("only stored (uncompressed) ZIP entries are supported");
    const compressedSize = view.getUint32(offset + 18, true);
    const expectedCrc = view.getUint32(offset + 14, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const name = decoder.decode(bytes.subarray(offset + 30, offset + 30 + nameLength));
    const dataStart = offset + 30 + nameLength + extraLength;
    const data = bytes.subarray(dataStart, dataStart + compressedSize);
    if (crc32(data) !== expectedCrc) throw new Error(`CRC mismatch for ${name}`);
    files[name] = new Uint8Array(data);
    offset = dataStart + compressedSize;
  }
  return files;
}
