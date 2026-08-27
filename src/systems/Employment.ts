import { gameConfig } from '../config/gameConfig.ts';
import type { GameSession } from '../game/session.ts';

export function isFired(session: GameSession): boolean {
    return session.employment <= gameConfig.employment.firedAt || session.outcome === 'terminated';
}

export function hasReachedSurgeryFund(session: GameSession): boolean {
    return session.money >= gameConfig.surgeryCost || session.outcome === 'victory';
}

export function employmentMeter(percent: number): string {
    const clamped = Math.max(0, Math.min(100, percent));
    const filled = Math.round(clamped / 10);
    return `${'█'.repeat(filled)}${'░'.repeat(10 - filled)} ${Math.round(clamped)}%`;
}
