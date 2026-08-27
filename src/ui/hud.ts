import { copy } from '../config/copy.ts';
import { gameConfig } from '../config/gameConfig.ts';
import { employmentMeter } from '../systems/Employment.ts';

import { el, setHidden } from './dom.ts';
import { formatMoney, formatTime } from './format.ts';

export type HudSnapshot = {
    timeRemaining: number;
    debrisRemaining: number;
    money: number;
    employment: number;
};

export class Hud {
    readonly root: HTMLElement;
    private readonly time: HTMLElement;
    private readonly debris: HTMLElement;
    private readonly money: HTMLElement;
    private readonly standing: HTMLElement;
    private readonly surgery: HTMLElement;

    constructor() {
        this.root = el('div', 'hud');
        this.time = el('div', 'hud__value');
        this.debris = el('div', 'hud__value');
        this.money = el('div', 'hud__value');
        this.standing = el('div', 'hud__value hud__value--meter');
        this.surgery = el('div', 'hud__value');

        this.root.append(
            metric(copy.hudTime, this.time),
            metric(copy.hudDebris, this.debris),
            metric(copy.hudFunds, this.money),
            metric(copy.hudStanding, this.standing),
            metric(copy.surgeryLabel, this.surgery)
        );
        setHidden(this.root, true);
    }

    setVisible(visible: boolean): void {
        setHidden(this.root, !visible);
    }

    render(snapshot: HudSnapshot): void {
        this.time.textContent = formatTime(snapshot.timeRemaining);
        this.time.classList.toggle('is-urgent', snapshot.timeRemaining <= 10);
        this.debris.textContent = String(snapshot.debrisRemaining);
        this.money.textContent = formatMoney(snapshot.money);
        this.standing.textContent = employmentMeter(snapshot.employment);
        this.surgery.textContent = `${formatMoney(snapshot.money)} / ${formatMoney(gameConfig.surgeryCost)}`;
    }
}

function metric(label: string, value: HTMLElement): HTMLElement {
    const wrap = el('div', 'hud__metric');
    wrap.append(el('div', 'hud__label', label), value);
    return wrap;
}
