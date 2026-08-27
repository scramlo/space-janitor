import { copy } from '../../config/copy.ts';
import { gameConfig } from '../../config/gameConfig.ts';
import type { JobDef } from '../../config/jobs.ts';
import type { GameSession } from '../../game/session.ts';
import { el, setHidden } from '../dom.ts';
import { formatMoney } from '../format.ts';

export class BriefingScreen {
    readonly root: HTMLElement;
    private readonly title: HTMLElement;
    private readonly client: HTMLElement;
    private readonly assignment: HTMLElement;
    private readonly note: HTMLElement;
    private readonly meta: HTMLElement;
    private readonly funds: HTMLElement;

    constructor(onAccept: () => void) {
        this.root = el('section', 'screen');
        this.title = el('h1', 'screen__title');
        this.client = el('p', 'screen__kicker');
        this.assignment = el('p', 'screen__body');
        this.note = el('p', 'screen__note');
        this.meta = el('ul', 'screen__meta');
        this.funds = el('p', 'screen__funds');

        const panel = el('div', 'panel');
        panel.append(
            el('p', 'panel__eyebrow', `${copy.company}  ·  ${copy.briefingEyebrow}`),
            this.title,
            this.client,
            this.assignment,
            this.note,
            this.meta,
            this.funds,
            el('p', 'screen__hint', copy.controlsHint)
        );

        const accept = el('button', 'btn btn--primary', copy.briefingCta);
        accept.type = 'button';
        accept.addEventListener('click', () => onAccept());
        const actions = el('div', 'panel__actions');
        actions.append(accept);
        panel.append(actions);

        this.root.append(panel);
        setHidden(this.root, true);
    }

    show(job: JobDef, session: GameSession): void {
        this.title.textContent = `JOB #${job.number} — ${job.title}`;
        this.client.textContent = `Client: ${job.client}`;
        this.assignment.textContent = job.assignment;
        this.note.textContent = job.briefingNote;
        this.meta.replaceChildren(
            metaItem('Deadline', `${job.deadlineSeconds} seconds`),
            metaItem('Objective', `Collect ${job.debrisCount} pieces of debris`),
            metaItem('Base Pay', formatMoney(job.pay.base))
        );
        this.funds.textContent = `Current savings ${formatMoney(session.money)}  ·  Surgery target ${formatMoney(gameConfig.surgeryCost)}  ·  Standing ${session.employment}%`;
        setHidden(this.root, false);
    }

    hide(): void {
        setHidden(this.root, true);
    }
}

function metaItem(label: string, value: string): HTMLElement {
    const item = el('li');
    item.append(el('span', 'meta__label', label), el('span', 'meta__value', value));
    return item;
}
