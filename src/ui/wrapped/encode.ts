/**
 * Turns the Wrapped timeline into a video file, entirely on this device.
 *
 * 1. WebCodecs via Mediabunny: frames are drawn one by one (faster than real
 *    time) and encoded to MP4 (H.264 + AAC, or Opus where AAC is missing) or,
 *    without H.264, to WebM (VP9/VP8 + Opus).
 * 2. Fallback for browsers without WebCodecs: MediaRecorder on a canvas
 *    stream, recorded in real time.
 *
 * Nothing touches the network: the canvas, the encoders and the muxer all
 * run in this tab, and the result is a Blob.
 */
import {
  AudioBufferSource,
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  WebMOutputFormat,
  canEncodeAudio,
  canEncodeVideo,
  type AudioCodec,
  type VideoCodec,
} from 'mediabunny';
import type { WrappedData } from './data';
import { H, W } from './draw';
import { loadWrappedFonts } from './fonts';
import { renderSoundtrack } from './audio';
import { renderFrame } from './scenes';
import { FPS, frameCount, type Timeline } from './timeline';

export type ExportPhase = 'audio' | 'frames' | 'finish' | 'realtime';
export interface ExportProgress {
  phase: ExportPhase;
  done: number;
  total: number;
}

export interface ExportResult {
  blob: Blob;
  ext: 'mp4' | 'webm';
  /** Human label, e.g. "MP4 · H.264 + AAC". */
  label: string;
}

interface Plan {
  container: 'mp4' | 'webm';
  video: VideoCodec;
  audio: AudioCodec | null;
}

const VIDEO_BITRATE = 9_000_000;
const AUDIO_BITRATE = 192_000;

const CODEC_LABEL: Record<string, string> = { avc: 'H.264', hevc: 'HEVC', vp9: 'VP9', vp8: 'VP8', av1: 'AV1', aac: 'AAC', opus: 'Opus' };

async function pickPlan(): Promise<Plan | null> {
  if (typeof VideoEncoder === 'undefined') return null;
  const size = { width: W, height: H, bitrate: VIDEO_BITRATE, frameRate: FPS };
  const audioFor = async (list: AudioCodec[]) => {
    if (typeof AudioEncoder === 'undefined') return null;
    for (const c of list) if (await canEncodeAudio(c, { numberOfChannels: 2, sampleRate: 48_000, bitrate: AUDIO_BITRATE }).catch(() => false)) return c;
    return null;
  };
  if (await canEncodeVideo('avc', size).catch(() => false)) return { container: 'mp4', video: 'avc', audio: await audioFor(['aac', 'opus']) };
  for (const v of ['vp9', 'vp8', 'av1'] as const) {
    if (await canEncodeVideo(v, size).catch(() => false)) return { container: 'webm', video: v, audio: await audioFor(['opus']) };
  }
  if (await canEncodeVideo('hevc', size).catch(() => false)) return { container: 'mp4', video: 'hevc', audio: await audioFor(['aac', 'opus']) };
  return null;
}

/** The container this browser will produce ("MP4"/"WebM"), or null if it cannot make videos. */
export async function exportFormat(): Promise<'MP4' | 'WebM' | null> {
  const plan = await pickPlan().catch(() => null);
  if (plan) return plan.container === 'mp4' ? 'MP4' : 'WebM';
  if (typeof MediaRecorder === 'undefined' || typeof HTMLCanvasElement === 'undefined' || !('captureStream' in HTMLCanvasElement.prototype)) return null;
  return MediaRecorder.isTypeSupported('video/mp4') ? 'MP4' : MediaRecorder.isTypeSupported('video/webm') ? 'WebM' : null;
}

const channel = typeof MessageChannel !== 'undefined' ? new MessageChannel() : null;
/** Yield to the event loop without the 4 ms setTimeout clamp. */
function yieldToUI(): Promise<void> {
  return new Promise((resolve) => {
    if (!channel) return void setTimeout(resolve, 0);
    channel.port1.onmessage = () => resolve();
    channel.port2.postMessage(0);
  });
}

function abortError() {
  return new DOMException('Cancelled', 'AbortError');
}

export interface ExportOptions {
  data: WrappedData;
  tl: Timeline;
  sig: string;
  signal: AbortSignal;
  onProgress: (p: ExportProgress) => void;
}

export async function exportVideo(o: ExportOptions): Promise<ExportResult> {
  await loadWrappedFonts();
  o.onProgress({ phase: 'audio', done: 0, total: 1 });
  const audio = await renderSoundtrack(o.tl).catch(() => null);
  if (o.signal.aborted) throw abortError();
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d', { alpha: false });
  if (!g) throw new Error('No 2D canvas');
  const plan = await pickPlan();
  if (plan) return encode(plan, canvas, g, audio, o);
  return record(canvas, g, audio, o);
}

async function encode(plan: Plan, canvas: HTMLCanvasElement, g: CanvasRenderingContext2D, audio: AudioBuffer | null, o: ExportOptions): Promise<ExportResult> {
  const output = new Output({
    format: plan.container === 'mp4' ? new Mp4OutputFormat({ fastStart: 'in-memory' }) : new WebMOutputFormat(),
    target: new BufferTarget(),
  });
  const video = new CanvasSource(canvas, { codec: plan.video, bitrate: VIDEO_BITRATE, keyFrameInterval: 2 });
  output.addVideoTrack(video, { frameRate: FPS });
  const audioSource = plan.audio && audio ? new AudioBufferSource({ codec: plan.audio, bitrate: AUDIO_BITRATE }) : null;
  if (audioSource) output.addAudioTrack(audioSource);
  output.setMetadataTags({ title: o.data.copy['summaryKicker'] ?? 'Wrapped', comment: 'Made with Left on Read, on-device.' });
  await output.start();
  const frames = frameCount(o.tl);
  try {
    if (audioSource && audio) {
      await audioSource.add(audio);
      audioSource.close();
    }
    for (let i = 0; i < frames; i++) {
      if (o.signal.aborted) throw abortError();
      renderFrame(g, o.data, o.tl, i / FPS, { calm: false, sig: o.sig });
      await video.add(i / FPS, 1 / FPS);
      if (i % 2 === 0) o.onProgress({ phase: 'frames', done: i + 1, total: frames });
      await yieldToUI();
    }
    video.close();
    o.onProgress({ phase: 'finish', done: frames, total: frames });
    await output.finalize();
  } catch (e) {
    await output.cancel().catch(() => undefined);
    throw e;
  }
  const buffer = output.target.buffer;
  if (!buffer) throw new Error('Empty output');
  const type = plan.container === 'mp4' ? 'video/mp4' : 'video/webm';
  const codecs = [plan.video, audioSource ? plan.audio : null].filter(Boolean).map((c) => CODEC_LABEL[c!] ?? c);
  return { blob: new Blob([buffer], { type }), ext: plan.container, label: `${plan.container.toUpperCase()} · ${codecs.join(' + ')}` };
}

/** Real-time fallback with MediaRecorder. Slower, but works without WebCodecs. */
async function record(canvas: HTMLCanvasElement, g: CanvasRenderingContext2D, audio: AudioBuffer | null, o: ExportOptions): Promise<ExportResult> {
  if (typeof MediaRecorder === 'undefined' || !('captureStream' in canvas)) throw new Error('unsupported');
  const mime = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((m) =>
    MediaRecorder.isTypeSupported(m),
  );
  if (!mime) throw new Error('unsupported');
  renderFrame(g, o.data, o.tl, 0, { calm: false, sig: o.sig });
  const stream = canvas.captureStream(FPS);
  let actx: AudioContext | null = null;
  let source: AudioBufferSourceNode | null = null;
  if (audio) {
    actx = new AudioContext({ sampleRate: audio.sampleRate });
    const dest = actx.createMediaStreamDestination();
    source = actx.createBufferSource();
    source.buffer = audio;
    source.connect(dest);
    dest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));
  }
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: VIDEO_BITRATE });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  const stopped = new Promise<void>((r) => (rec.onstop = () => r()));
  rec.start(1000);
  source?.start();
  const t0 = performance.now();
  try {
    await new Promise<void>((resolve, reject) => {
      const tick = () => {
        if (o.signal.aborted) return reject(abortError());
        const t = (performance.now() - t0) / 1000;
        if (t >= o.tl.duration) {
          renderFrame(g, o.data, o.tl, o.tl.duration - 1e-3, { calm: false, sig: o.sig });
          return resolve();
        }
        renderFrame(g, o.data, o.tl, t, { calm: false, sig: o.sig });
        o.onProgress({ phase: 'realtime', done: t, total: o.tl.duration });
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  } finally {
    rec.stop();
    await stopped;
    source?.stop();
    void actx?.close();
  }
  if (o.signal.aborted) throw abortError();
  const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
  return { blob: new Blob(chunks, { type: mime.split(';')[0] }), ext, label: `${ext.toUpperCase()} · MediaRecorder` };
}

/** The finished summary frame as a 1080×1920 PNG. */
export async function renderStill(data: WrappedData, tl: Timeline, sig: string): Promise<Blob> {
  await loadWrappedFonts();
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d')!;
  renderFrame(g, data, tl, tl.duration - 1e-3, { calm: false, sig });
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'));
}
