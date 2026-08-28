import { getAudioContext } from './context.ts';

const TRUCK_START_URL = '/audio/truck_start.mp3';
const TRUCK_RUN_URL = '/audio/engine_running_low.mp3';
const TRUCK_TOP_URL = '/audio/add_top_speed.mp3';

const IDLE_GAIN = 0.5;
const MAX_GAIN = 0.7;
const TOP_MAX_GAIN = MAX_GAIN * 1;
/** Normalized speed where the top-speed layer starts fading in. */
const TOP_SPEED_IN = 0.55;
const GAIN_SLEW = 0.08;
const TOP_GAIN_SLEW = 0.05;

let startBuffer: Promise<AudioBuffer | null> | null = null;
let runBuffer: Promise<AudioBuffer | null> | null = null;
let topBuffer: Promise<AudioBuffer | null> | null = null;

let runSource: AudioBufferSourceNode | null = null;
let runGain: GainNode | null = null;
let topSource: AudioBufferSourceNode | null = null;
let topGain: GainNode | null = null;
let runDesired = IDLE_GAIN;
let topDesired = 0;
let startGeneration = 0;
let engineActive = false;
let topStartPromise: Promise<void> | null = null;
let runStartPromise: Promise<void> | null = null;

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

function loadStart(): Promise<AudioBuffer | null> {
    startBuffer ??= decodeUrl(TRUCK_START_URL);
    return startBuffer;
}

function loadRun(): Promise<AudioBuffer | null> {
    runBuffer ??= decodeUrl(TRUCK_RUN_URL);
    return runBuffer;
}

function loadTop(): Promise<AudioBuffer | null> {
    topBuffer ??= decodeUrl(TRUCK_TOP_URL);
    return topBuffer;
}

function stopSource(source: AudioBufferSourceNode | null): void {
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
}

function ensureGain(existing: GainNode | null, initial: number): GainNode | null {
    if (existing) {
        return existing;
    }
    const ctx = getAudioContext();
    if (!ctx) {
        return null;
    }
    const gain = ctx.createGain();
    gain.gain.value = initial;
    gain.connect(ctx.destination);
    return gain;
}

function stopRunningInternal(): void {
    stopSource(runSource);
    runSource = null;
    stopSource(topSource);
    topSource = null;
    runGain?.disconnect();
    runGain = null;
    topGain?.disconnect();
    topGain = null;
    topStartPromise = null;
    runStartPromise = null;
}

function attachLoopingSource(
    buffer: AudioBuffer,
    gain: GainNode,
    onEnded: () => void
): AudioBufferSourceNode {
    const ctx = getAudioContext();
    if (!ctx) {
        throw new Error('No audio context');
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = 0;
    source.loopEnd = buffer.duration;
    source.connect(gain);
    source.onended = () => {
        // Some browsers still fire ended around loop boundaries or after suspend;
        // restart while the engine bed should keep playing.
        onEnded();
    };
    source.start(0);
    return source;
}

async function ensureRunLoop(): Promise<void> {
    if (runSource || runStartPromise || !engineActive) {
        return runStartPromise ?? Promise.resolve();
    }
    runStartPromise = (async () => {
        const buffer = await loadRun();
        if (!buffer || !engineActive || runSource) {
            return;
        }
        runGain = ensureGain(runGain, runDesired);
        if (!runGain) {
            return;
        }
        runSource = attachLoopingSource(buffer, runGain, () => {
            runSource = null;
            if (engineActive) {
                void ensureRunLoop();
            }
        });
    })();
    try {
        await runStartPromise;
    } finally {
        runStartPromise = null;
    }
}

async function ensureTopLoop(): Promise<void> {
    if (topSource || topStartPromise || !engineActive) {
        return topStartPromise ?? Promise.resolve();
    }
    topStartPromise = (async () => {
        const buffer = await loadTop();
        if (!buffer || !engineActive || topSource) {
            return;
        }
        topGain = ensureGain(topGain, Math.max(topDesired, 0.0001));
        if (!topGain) {
            return;
        }
        topSource = attachLoopingSource(buffer, topGain, () => {
            topSource = null;
            if (engineActive && topDesired > 0) {
                void ensureTopLoop();
            }
        });
        if (topDesired > 0) {
            const ctx = getAudioContext();
            if (ctx) {
                topGain.gain.setValueAtTime(topDesired, ctx.currentTime);
            }
        }
    })();
    try {
        await topStartPromise;
    } finally {
        topStartPromise = null;
    }
}

async function startRunningLoop(): Promise<void> {
    engineActive = true;
    await ensureRunLoop();
    await ensureTopLoop();
}

function slewGain(node: GainNode | null, desired: number, dt: number, slew: number): void {
    if (!node) {
        return;
    }
    const ctx = getAudioContext();
    if (!ctx) {
        return;
    }
    const current = node.gain.value;
    const alpha = 1 - Math.exp(-Math.max(dt, 0) / slew);
    const next = current + (desired - current) * alpha;
    node.gain.setValueAtTime(next, ctx.currentTime);
}

/**
 * One-shot truck startup; when it ends, begin the looping run bed.
 * Safe to call from a user gesture (Accept Assignment).
 */
export function playTruckEngineStart(): void {
    const ctx = getAudioContext();
    if (!ctx) {
        return;
    }
    stopTruckEngine();
    const generation = ++startGeneration;
    void loadStart().then((buffer) => {
        if (!buffer || generation !== startGeneration) {
            return;
        }
        const live = getAudioContext();
        if (!live) {
            return;
        }
        const source = live.createBufferSource();
        const gain = live.createGain();
        source.buffer = buffer;
        gain.gain.value = 0.5;
        source.connect(gain);
        gain.connect(live.destination);
        source.onended = () => {
            if (generation !== startGeneration) {
                return;
            }
            void startRunningLoop();
        };
        source.start(0);
    });
}

/**
 * Map normalized speed 0..1 into volumes.
 * Run bed stays up the whole time; top-speed layers in above TOP_SPEED_IN.
 */
export function updateTruckEngineSpeed(speed01: number, dt: number): void {
    if (!engineActive) {
        return;
    }
    const t = Math.min(1, Math.max(0, speed01));
    const topT = t <= TOP_SPEED_IN ? 0 : (t - TOP_SPEED_IN) / (1 - TOP_SPEED_IN);
    runDesired = IDLE_GAIN + (MAX_GAIN - IDLE_GAIN) * t;
    topDesired = TOP_MAX_GAIN * topT;

    if (!runSource) {
        void ensureRunLoop();
    }
    if (topDesired > 0 && !topSource) {
        void ensureTopLoop();
    }

    slewGain(runGain, runDesired, dt, GAIN_SLEW);
    slewGain(topGain, topDesired, dt, TOP_GAIN_SLEW);
}

export function stopTruckEngine(): void {
    startGeneration += 1;
    engineActive = false;
    stopRunningInternal();
    runDesired = IDLE_GAIN;
    topDesired = 0;
}

/** Prefetch start, run, and top-speed clips. */
export function preloadTruckEngine(): void {
    void loadStart();
    void loadRun();
    void loadTop();
}
