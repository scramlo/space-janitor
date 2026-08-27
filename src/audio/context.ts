let context: AudioContext | null = null;

export function getAudioContext(): AudioContext | null {
    const AudioCtx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) {
        return null;
    }
    context ??= new AudioCtx();
    if (context.state === 'suspended') {
        void context.resume();
    }
    return context;
}
