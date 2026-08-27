import { getAudioContext } from './context.ts';

const TRUCK_START_URL = '/audio/truck_start.mp3';

let bufferPromise: Promise<AudioBuffer | null> | null = null;

function loadTruckStart(): Promise<AudioBuffer | null> {
    bufferPromise ??= (async () => {
        const ctx = getAudioContext();
        if (!ctx) {
            return null;
        }
        try {
            const response = await fetch(TRUCK_START_URL);
            if (!response.ok) {
                return null;
            }
            const data = await response.arrayBuffer();
            return await ctx.decodeAudioData(data.slice(0));
        } catch {
            return null;
        }
    })();
    return bufferPromise;
}

/** One-shot truck startup; safe to call from a user gesture (Accept Assignment). */
export function playTruckEngineStart(): void {
    const ctx = getAudioContext();
    if (!ctx) {
        return;
    }
    void loadTruckStart().then((buffer) => {
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
        gain.gain.value = 0.55;
        source.connect(gain);
        gain.connect(live.destination);
        source.start(0);
    });
}

/** Prefetch decode so the first job accept is less delayed. */
export function preloadTruckEngine(): void {
    void loadTruckStart();
}
