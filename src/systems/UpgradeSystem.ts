import { thrusterUpgrade  } from '../config/upgrades.ts';
import type { UpgradeDef } from '../config/upgrades.ts';
import { ownsUpgrade  } from '../game/session.ts';
import type { GameSession } from '../game/session.ts';

export type MovementMultipliers = {
    thrust: number;
    maxSpeed: number;
};

export function movementMultipliers(session: GameSession): MovementMultipliers {
    let thrust = 1;
    let maxSpeed = 1;
    for (const id of session.ownedUpgradeIds) {
        const upgrade = thrusterUpgrade().id === id ? thrusterUpgrade() : undefined;
        if (!upgrade) {
            continue;
        }
        thrust *= upgrade.effects.thrustMultiplier ?? 1;
        maxSpeed *= upgrade.effects.maxSpeedMultiplier ?? 1;
    }
    return { thrust, maxSpeed };
}

export function canPurchase(session: GameSession, upgrade: UpgradeDef): boolean {
    return !ownsUpgrade(session, upgrade.id) && session.money >= upgrade.cost;
}

export function purchaseUpgrade(session: GameSession, upgrade: UpgradeDef): boolean {
    if (!canPurchase(session, upgrade)) {
        return false;
    }
    session.money -= upgrade.cost;
    session.ownedUpgradeIds.push(upgrade.id);
    return true;
}
