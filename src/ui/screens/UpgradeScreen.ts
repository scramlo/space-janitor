import { copy } from '../../config/copy.ts';
import { gameConfig } from '../../config/gameConfig.ts';
import type { UpgradeDef } from '../../config/upgrades.ts';
import type { GameSession } from '../../game/session.ts';
import { ownsUpgrade } from '../../game/session.ts';
import { canPurchase } from '../../systems/UpgradeSystem.ts';
import { el, setHidden } from '../dom.ts';
import { formatMoney } from '../format.ts';

export class UpgradeScreen {
    readonly root: HTMLElement;
    private readonly name: HTMLElement;
    private readonly description: HTMLElement;
    private readonly cost: HTMLElement;
    private readonly funds: HTMLElement;
    private readonly buy: HTMLButtonElement;

    constructor(onBuy: () => void, onSkip: () => void) {
        this.root = el('section', 'screen');
        this.name = el('h1', 'screen__title');
        this.description = el('p', 'screen__body');
        this.cost = el('p', 'screen__note');
        this.funds = el('p', 'screen__funds');
        this.buy = el('button', 'btn btn--primary');
        this.buy.type = 'button';
        this.buy.addEventListener('click', () => onBuy());

        const skip = el('button', 'btn', copy.upgradeSkip);
        skip.type = 'button';
        skip.addEventListener('click', () => onSkip());

        const panel = el('div', 'panel');
        const actions = el('div', 'panel__actions');
        actions.append(this.buy, skip);
        panel.append(
            el('p', 'panel__eyebrow', `${copy.company}  ·  ${copy.upgradeEyebrow}`),
            this.name,
            this.description,
            this.cost,
            this.funds,
            el(
                'p',
                'screen__hint',
                'Improved thrusters increase collection efficiency on future jobs. Deadlines remain contractual.'
            ),
            actions
        );
        this.root.append(panel);
        setHidden(this.root, true);
    }

    show(upgrade: UpgradeDef, session: GameSession): void {
        const owned = ownsUpgrade(session, upgrade.id);
        this.name.textContent = upgrade.name;
        this.description.textContent = upgrade.description;
        this.cost.textContent = `Requisition cost: ${formatMoney(upgrade.cost)}`;
        this.funds.textContent = `Available funds ${formatMoney(session.money)}  ·  Surgery target ${formatMoney(gameConfig.surgeryCost)}`;
        this.buy.textContent = owned ? copy.upgradeOwned : copy.upgradeBuy;
        this.buy.disabled = owned || !canPurchase(session, upgrade);
        setHidden(this.root, false);
    }

    hide(): void {
        setHidden(this.root, true);
    }
}
