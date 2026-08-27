import { copy } from '../../config/copy.ts';
import { gameConfig } from '../../config/gameConfig.ts';
import type { GameSession } from '../../game/session.ts';
import type { JobPayout } from '../../systems/Economy.ts';
import { employmentMeter } from '../../systems/Employment.ts';
import { el, setHidden } from '../dom.ts';
import { formatMoney, formatSignedMoney } from '../format.ts';

export class ResultsScreen {
    readonly root: HTMLElement;
    private readonly status: HTMLElement;
    private readonly lines: HTMLElement;
    private readonly total: HTMLElement;
    private readonly standing: HTMLElement;
    private readonly funds: HTMLElement;

    constructor(onContinue: () => void) {
        this.root = el('section', 'screen');
        this.status = el('h1', 'screen__title');
        this.lines = el('ul', 'ledger');
        this.total = el('p', 'ledger__total');
        this.standing = el('p', 'screen__note');
        this.funds = el('p', 'screen__funds');

        const panel = el('div', 'panel');
        panel.append(
            el('p', 'panel__eyebrow', `${copy.company}  ·  ${copy.resultsEyebrow}`),
            this.status,
            this.lines,
            this.total,
            this.standing,
            this.funds
        );

        const next = el('button', 'btn btn--primary', copy.resultsCta);
        next.type = 'button';
        next.addEventListener('click', () => onContinue());
        const actions = el('div', 'panel__actions');
        actions.append(next);
        panel.append(actions);

        this.root.append(panel);
        setHidden(this.root, true);
    }

    show(payout: JobPayout, session: GameSession): void {
        this.status.textContent = payout.success ? 'ASSIGNMENT COMPLETE' : 'ASSIGNMENT FAILED';
        this.lines.replaceChildren(
            ...payout.lines.map((line) => {
                const row = el('li', 'ledger__row');
                const amount = el('span', line.amount < 0 ? 'is-penalty' : line.amount > 0 ? 'is-bonus' : '');
                amount.textContent = formatSignedMoney(line.amount);
                row.append(el('span', '', line.label), amount);
                return row;
            })
        );
        this.total.textContent = `TOTAL: ${formatSignedMoney(payout.total)}`;
        const sign = payout.employmentDelta >= 0 ? '+' : '';
        this.standing.textContent = `${copy.standingChange}: ${sign}${payout.employmentDelta}  ·  ${employmentMeter(session.employment)}`;
        this.funds.textContent = `Savings ${formatMoney(session.money)} / ${formatMoney(gameConfig.surgeryCost)}`;
        setHidden(this.root, false);
    }

    hide(): void {
        setHidden(this.root, true);
    }
}
