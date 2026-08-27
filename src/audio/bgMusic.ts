import { getAudioContext } from './context.ts';

const BG_URL = '/audio/default_bg_music.mp3';
/** Keep under SFX; tweak freely. */
const BG_GAIN = 0.28;

let bufferPromise: Promise<AudioBuffer | null> | null = null;
let source: AudioBufferSourceNode | null = null;
let gain: GainNode | null = null;
let startPromise: Promise<void> | null = null;
let wantPlaying = false;

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
    bufferPromise ??= decodeUrl(BG_URL);
    return bufferPromise;
}

function stopSource(): void {
    if (!source) {
        return;
    }
    try {
        source.onended = null;
        source.stop();
    } catch {
        // already stopped
    }
    source.disconnect();
    source = null;
}

async function ensurePlaying(): Promise<void> {
    if (source || startPromise || !wantPlaying) {
        return startPromise ?? Promise.resolve();
    }
    startPromise = (async () => {
        const buffer = await loadBuffer();
        if (!buffer || !wantPlaying || source) {
            return;
        }
        const ctx = getAudioContext();
        if (!ctx) {
            return;
        }
        gain ??= ctx.createGain();
        gain.gain.value = BG_GAIN;
        gain.connect(ctx.destination);

        const next = ctx.createBufferSource();
        next.buffer = buffer;
        next.loop = true;
        next.loopStart = 0;
        next.loopEnd = buffer.duration;
        next.connect(gain);
        next.onended = () => {
            source = null;
            if (wantPlaying) {
                void ensurePlaying();
            }
        };
        next.start(0);
        source = next;
    })();
    try {
        await startPromise;
    } finally {
        startPromise = null;
    }
}

/** Prefetch the bed track. */
export function preloadBgMusic(): void {
    void loadBuffer();
}

/**
 * Start looping BGM. Safe to call repeatedly; needs a user gesture
 * so the shared AudioContext can resume.
 */
export function startBgMusic(): void {
    wantPlaying = true;
    void ensurePlaying();
}

export function stopBgMusic(): void {
    wantPlaying = false;
    stopSource();
    gain?.disconnect();
    gain = null;
    startPromise = null;
}
