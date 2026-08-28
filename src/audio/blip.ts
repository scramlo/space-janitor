import { getAudioContext } from './context.ts';

const SUCK_URL = '/audio/suck.mp3';
const SUCK_GAIN = 1;

let bufferPromise: Promise<AudioBuffer | null> | null = null;

async function decodeUrl(url: string): Promise<AudioBuffer | null> {
    const ctx = getAudioContext();
    if (!ctx) {
        return null;
    }
    try {
        const response = await fetch(url);
        if (!response.ok) {
            return null;
        }
        const data = await response.arrayBuffer();
        return await ctx.decodeAudioData(data.slice(0));
    } catch {
        return null;
    }
}

function loadBuffer(): Promise<AudioBuffer | null> {
    bufferPromise ??= decodeUrl(SUCK_URL);
    return bufferPromise;
}

/** Prefetch the pickup suck SFX. */
export function preloadCollectBlip(): void {
    void loadBuffer();
}

/** One-shot suck when collecting debris. Overlapping picks can stack. */
export function playCollectBlip(): void {
    const ctx = getAudioContext();
    if (!ctx) {
        return;
    }
    void loadBuffer().then((buffer) => {
        if (!buffer) {
            return;
        }
        const live = getAudioContext();
        if (!live) {
            return;
        }
        const source = live.createBufferSource();
        const gain = live.createGain();
        source.buffer = buffer;
        gain.gain.value = SUCK_GAIN;
        source.connect(gain);
        gain.connect(live.destination);
        source.start(0);
    });
}
