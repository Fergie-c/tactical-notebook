/* Tactical Notebook — mp4.js: 영상 인코딩(WebCodecs H.264) + 표준 MP4 파일 묶기 (외부 라이브러리 없음)
   일반 <script>로 순서대로 로드됨(file:// 호환). 순서는 index.html 하단 참고.
   Why: MediaRecorder MP4 is fragmented with duration 0 and no index → many players (Windows) show no length and can't seek.
   Here every frame is encoded off-line and written as a plain (non-fragmented) MP4 with moov first: duration, sync-sample
   table and chunk offsets are all present, so any player shows the length and can seek. */
'use strict';

const MP4_FPS = 30;
const H264_CODECS = ['avc1.640028', 'avc1.4d0028', 'avc1.42e028', 'avc1.42001f'];   // High / Main / Baseline, level 4.0 (1080p30) first

/* null when this browser can't encode H.264 with WebCodecs → caller falls back to MediaRecorder */
async function pickH264(width, height){
  if (!window.VideoEncoder || !window.VideoFrame) return null;
  for (const codec of H264_CODECS) {
    // realtime latency mode: no B-frames in practice, so decode order = display order (ctts is still written if not)
    const config = { codec, width, height, bitrate:10_000_000, framerate:MP4_FPS, latencyMode:'realtime', avc:{ format:'avc' } };
    try { const s = await VideoEncoder.isConfigSupported(config); if (s.supported) return s.config || config; } catch (e) {}
  }
  return null;
}

/* macro-task yield that background tabs don't throttle the way they throttle setTimeout */
function yieldTask(){ return new Promise(r => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); }); }

/* draw(i) paints frame i onto canvas. Returns an MP4 Blob, or null if cancelled. */
async function encodeMp4(config, canvas, frameCount, draw, onProgress, isCancelled){
  const samples = []; let avcC = null, failure = null;
  const enc = new VideoEncoder({
    output: (chunk, meta) => {
      const d = meta && meta.decoderConfig && meta.decoderConfig.description;
      if (d && !avcC) avcC = new Uint8Array(ArrayBuffer.isView(d) ? d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength) : d.slice(0));
      const data = new Uint8Array(chunk.byteLength); chunk.copyTo(data);
      samples.push({ data, key: chunk.type === 'key', ts: chunk.timestamp });
    },
    error: e => { failure = e; },
  });
  enc.configure(config);
  for (let i = 0; i < frameCount; i++) {
    if (failure) throw failure;
    if (isCancelled()) { enc.close(); return null; }
    draw(i);
    const vf = new VideoFrame(canvas, { timestamp: Math.round(i * 1e6 / MP4_FPS), duration: Math.round(1e6 / MP4_FPS) });
    enc.encode(vf, { keyFrame: i % (MP4_FPS * 2) === 0 });   // a key frame every 2 s → quick seeking
    vf.close();
    while (enc.encodeQueueSize > 4 && !failure) await new Promise(r => enc.addEventListener('dequeue', r, { once:true }));
    if (i % 4 === 0) { onProgress(i, frameCount); await yieldTask(); }
  }
  await enc.flush(); enc.close();
  if (failure) throw failure;
  if (!avcC || !samples.length) throw new Error('H.264 encoder returned no data');
  return muxMp4(samples, avcC, config.width, config.height, MP4_FPS);
}

/* ---------- minimal ISO-BMFF writer: ftyp + moov (faststart) + mdat, one video track, one chunk ---------- */
const MP4_TXT = new TextEncoder();
function mp4Cat(parts){ let n = 0; for (const p of parts) n += p.length; const out = new Uint8Array(n); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; }
function mp4Int(bytes, v, signed){ const b = new Uint8Array(bytes), dv = new DataView(b.buffer);
  if (bytes === 1) dv.setUint8(0, v); else if (bytes === 2) dv.setUint16(0, v); else if (bytes === 3) { dv.setUint8(0, (v >> 16) & 255); dv.setUint16(1, v & 0xffff); }
  else if (signed) dv.setInt32(0, v); else dv.setUint32(0, v >>> 0); return b; }
const mp4U8 = v => mp4Int(1, v), mp4U16 = v => mp4Int(2, v), mp4U24 = v => mp4Int(3, v), mp4U32 = v => mp4Int(4, v), mp4I32 = v => mp4Int(4, v, true);
function mp4Box(type, ...parts){ const body = mp4Cat(parts); return mp4Cat([mp4U32(8 + body.length), MP4_TXT.encode(type), body]); }
function mp4Full(type, version, flags, ...parts){ return mp4Box(type, mp4U8(version), mp4U24(flags), ...parts); }
const MP4_MATRIX = () => mp4Cat([0x00010000, 0, 0, 0, 0x00010000, 0, 0, 0, 0x40000000].map(mp4U32));
const mp4Zeros = n => new Uint8Array(n);

function muxMp4(samples, avcC, width, height, fps){
  const TS = fps * 1000, DELTA = 1000, n = samples.length;   // media timescale: 1 frame = 1000 ticks
  const durMedia = n * DELTA, durMovie = Math.round(n * 1000 / fps);   // movie timescale = ms
  const cts = samples.map((s, i) => Math.round(s.ts * TS / 1e6) - i * DELTA);   // display time − decode time
  const keys = []; samples.forEach((s, i) => { if (s.key) keys.push(i + 1); });
  const dataSize = samples.reduce((a, s) => a + s.data.length, 0);

  const ftyp = mp4Box('ftyp', MP4_TXT.encode('isom'), mp4U32(512), MP4_TXT.encode('isomiso2avc1mp41'));
  const moovFor = chunkOffset => {
    const stbl = mp4Box('stbl',
      mp4Full('stsd', 0, 0, mp4U32(1),
        mp4Box('avc1', mp4Zeros(6), mp4U16(1), mp4Zeros(16), mp4U16(width), mp4U16(height), mp4U32(0x00480000), mp4U32(0x00480000), mp4U32(0), mp4U16(1), mp4Zeros(32), mp4U16(0x18), mp4U16(0xffff),
          mp4Box('avcC', avcC))),
      mp4Full('stts', 0, 0, mp4U32(1), mp4U32(n), mp4U32(DELTA)),
      ...(cts.some(v => v !== 0) ? [mp4Full('ctts', 1, 0, mp4U32(n), ...cts.flatMap(v => [mp4U32(1), mp4I32(v)]))] : []),
      mp4Full('stss', 0, 0, mp4U32(keys.length), ...keys.map(mp4U32)),
      mp4Full('stsc', 0, 0, mp4U32(1), mp4U32(1), mp4U32(n), mp4U32(1)),
      mp4Full('stsz', 0, 0, mp4U32(0), mp4U32(n), ...samples.map(s => mp4U32(s.data.length))),
      mp4Full('stco', 0, 0, mp4U32(1), mp4U32(chunkOffset)));
    const minf = mp4Box('minf', mp4Full('vmhd', 0, 1, mp4Zeros(8)), mp4Box('dinf', mp4Full('dref', 0, 0, mp4U32(1), mp4Full('url ', 0, 1))), stbl);
    const mdia = mp4Box('mdia',
      mp4Full('mdhd', 0, 0, mp4U32(0), mp4U32(0), mp4U32(TS), mp4U32(durMedia), mp4U16(0x55c4), mp4U16(0)),   // language 'und'
      mp4Full('hdlr', 0, 0, mp4U32(0), MP4_TXT.encode('vide'), mp4Zeros(12), MP4_TXT.encode('VideoHandler\0')),
      minf);
    const tkhd = mp4Full('tkhd', 0, 3, mp4U32(0), mp4U32(0), mp4U32(1), mp4U32(0), mp4U32(durMovie), mp4Zeros(8), mp4U16(0), mp4U16(0), mp4U16(0), mp4U16(0), MP4_MATRIX(), mp4U32(width << 16), mp4U32(height << 16));
    const mvhd = mp4Full('mvhd', 0, 0, mp4U32(0), mp4U32(0), mp4U32(1000), mp4U32(durMovie), mp4U32(0x00010000), mp4U16(0x0100), mp4Zeros(10), MP4_MATRIX(), mp4Zeros(24), mp4U32(2));
    return mp4Box('moov', mvhd, mp4Box('trak', tkhd, mdia));
  };
  const size = moovFor(0).length;   // offsets are fixed-width, so the size doesn't depend on the value
  const moov = moovFor(ftyp.length + size + 8);
  return new Blob([ftyp, moov, mp4U32(8 + dataSize), MP4_TXT.encode('mdat'), ...samples.map(s => s.data)], { type:'video/mp4' });
}
