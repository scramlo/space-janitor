import { getAudioContext } from './context.ts';

const BACKUP_URL = '/audio/backup.mp3';
const BACKUP_GAIN = 0.55;

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
    bufferPromise ??= decodeUrl(BACKUP_URL);
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
        gain.gain.value = BACKUP_GAIN;
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

export function preloadBackupBeep(): void {
    void loadBuffer();
}

/** Start or stop the reverse beep loop. */
export function setBackupBeeping(active: boolean): void {
    if (active) {
        wantPlaying = true;
        void ensurePlaying();
        return;
    }
    wantPlaying = false;
    stopSource();
}

export function stopBackupBeep(): void {
    setBackupBeeping(false);
    gain?.disconnect();
    gain = null;
    startPromise = null;
}
