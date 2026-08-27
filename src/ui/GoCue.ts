import { copy } from '../config/copy.ts';
import { el, setHidden } from './dom.ts';

/** Center-screen "GO!" flash when the job timer starts. */
export class GoCue {
    readonly root: HTMLElement;
    private readonly label: HTMLElement;
    private hideTimer = 0;

    constructor() {
        this.root = el('div', 'go-cue');
        this.label = el('div', 'go-cue__label', copy.goCue);
        this.root.append(this.label);
        setHidden(this.root, true);
        this.root.addEventListener('animationend', this.onAnimationEnd);
    }

    show(): void {
        window.clearTimeout(this.hideTimer);
        setHidden(this.root, false);
        this.label.classList.remove('is-playing');
        // Restart CSS animation
        void this.label.offsetWidth;
        this.label.classList.add('is-playing');
        this.hideTimer = window.setTimeout(() => this.hide(), 1400);
    }

    hide(): void {
        window.clearTimeout(this.hideTimer);
        this.hideTimer = 0;
        this.label.classList.remove('is-playing');
        setHidden(this.root, true);
    }

    private readonly onAnimationEnd = (event: AnimationEvent): void => {
        if (event.target !== this.label || !this.label.classList.contains('is-playing')) {
            return;
        }
        this.hide();
    };
}
