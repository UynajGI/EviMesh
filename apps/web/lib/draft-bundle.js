const BUNDLE_VERSION = 1;

function uint32(value) {
  return new Uint8Array([value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255]);
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipStored(filename, content) {
  const encoder = new TextEncoder();
  const name = encoder.encode(filename);
  const data = encoder.encode(content);
  const checksum = uint32(crc32(data));
  const local = new Uint8Array(30 + name.length + data.length);
  const view = new DataView(local.buffer);
  view.setUint32(0, 0x04034b50, true); view.setUint16(4, 20, true); view.setUint16(8, 0, true);
  view.setUint32(14, crc32(data), true); view.setUint32(18, data.length, true); view.setUint32(22, data.length, true);
  view.setUint16(26, name.length, true); view.setUint16(28, 0, true);
  local.set(name, 30); local.set(data, 30 + name.length);
  const central = new Uint8Array(46 + name.length);
  const centralView = new DataView(central.buffer);
  centralView.setUint32(0, 0x02014b50, true); centralView.setUint16(4, 20, true); centralView.setUint16(6, 20, true);
  centralView.setUint32(16, crc32(data), true); centralView.setUint32(20, data.length, true); centralView.setUint32(24, data.length, true);
  centralView.setUint16(28, name.length, true); centralView.setUint32(42, 0, true); central.set(name, 46);
  const end = new Uint8Array(22); const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true); endView.setUint16(8, 1, true); endView.setUint16(10, 1, true);
  endView.setUint32(12, central.length, true); endView.setUint32(16, local.length, true);
  return new Blob([local, central, end], { type: 'application/zip' });
}

export function createDraftBundle(form) {
  return { kind: 'evimesh-draft-bundle', version: BUNDLE_VERSION, draftType: 'claim', exportedAt: new Date().toISOString(), form };
}

export function downloadDraftBundle(form, format) {
  const bundle = createDraftBundle(form);
  const json = JSON.stringify(bundle, null, 2);
  const blob = format === 'zip' ? zipStored('claim-draft.json', json) : new Blob([json], { type: 'application/json' });
  const suffix = format === 'zip' ? 'zip' : 'json';
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
  anchor.href = url; anchor.download = `evimesh-claim-draft.${suffix}`; anchor.click();
  URL.revokeObjectURL(url);
}
