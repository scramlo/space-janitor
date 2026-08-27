export class JobSystem {
    required = 0;
    collected = 0;
    active = false;

    start(required: number): void {
        this.required = required;
        this.collected = 0;
        this.active = true;
    }

    noteCollected(count: number): void {
        if (!this.active || count <= 0) {
            return;
        }
        this.collected = Math.min(this.required, this.collected + count);
    }

    remaining(): number {
        return Math.max(0, this.required - this.collected);
    }

    isComplete(): boolean {
        return this.active && this.collected >= this.required && this.required > 0;
    }

    stop(): void {
        this.active = false;
    }
}
