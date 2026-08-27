import { copy } from '../../config/copy.ts';
import { el, setHidden } from '../dom.ts';

export class GameOverScreen {
    readonly root: HTMLElement;

    constructor(onRestart: () => void) {
        this.root = el('section', 'screen');
        const panel = el('div', 'panel');
        const restart = el('button', 'btn btn--primary', copy.gameOverCta);
        restart.type = 'button';
        restart.addEventListener('click', () => onRestart());
        const actions = el('div', 'panel__actions');
        actions.append(restart);
        panel.append(
            el('p', 'panel__eyebrow', copy.company),
            el('h1', 'screen__title', copy.gameOverTitle),
            el('p', 'screen__body', copy.gameOverBody),
            actions
        );
        this.root.append(panel);
        setHidden(this.root, true);
    }

    show(): void {
        setHidden(this.root, false);
    }

    hide(): void {
        setHidden(this.root, true);
    }
}
