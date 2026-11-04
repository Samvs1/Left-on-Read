/**
 * Renders the Wrapped soundtrack off the main thread, so the preview keeps
 * animating while the music is being synthesised.
 */
import { renderSoundtrackPCM, type SynthScene } from './synth';

interface Req {
  id: number;
  scenes: SynthScene[];
  duration: number;
}

const scope = self as unknown as { postMessage(message: unknown, transfer?: Transferable[]): void; onmessage: ((e: MessageEvent<Req>) => void) | null };

scope.onmessage = (e) => {
  const { id, scenes, duration } = e.data;
  try {
    const r = renderSoundtrackPCM(scenes, duration);
    scope.postMessage({ id, left: r.left, right: r.right, sampleRate: r.sampleRate }, [r.left.buffer, r.right.buffer]);
  } catch (err) {
    scope.postMessage({ id, error: String(err) });
  }
};
