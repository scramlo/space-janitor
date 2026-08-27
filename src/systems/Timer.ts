export class Timer {
    remaining = 0;
    duration = 0;
    running = false;

    start(seconds: number): void {
        this.duration = seconds;
        this.remaining = seconds;
        this.running = true;
    }

    stop(): void {
        this.running = false;
    }

    reset(): void {
        this.remaining = 0;
        this.duration = 0;
        this.running = false;
    }

    update(dt: number): void {
        if (!this.running) {
            return;
        }
        this.remaining = Math.max(0, this.remaining - dt);
        if (this.remaining <= 0) {
            this.running = false;
        }
    }

    get expired(): boolean {
        return this.duration > 0 && this.remaining <= 0;
    }
}
