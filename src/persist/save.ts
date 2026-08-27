import { gameConfig } from '../config/gameConfig.ts';
import { createSession  } from '../game/session.ts';
import type { GameSession } from '../game/session.ts';

function isSession(value: unknown): value is GameSession {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const record = value as Record<string, unknown>;
    return (
        typeof record.money === 'number' &&
        typeof record.employment === 'number' &&
        Array.isArray(record.ownedUpgradeIds) &&
        typeof record.jobsCompleted === 'number' &&
        (record.outcome === 'playing' || record.outcome === 'victory' || record.outcome === 'terminated')
    );
}

export function loadSave(): GameSession {
    try {
        const raw = localStorage.getItem(gameConfig.saveKey);
        if (!raw) {
            return createSession();
        }
        const parsed: unknown = JSON.parse(raw);
        if (!isSession(parsed)) {
            return createSession();
        }
        return parsed;
    } catch {
        return createSession();
    }
}

export function writeSave(session: GameSession): void {
    localStorage.setItem(gameConfig.saveKey, JSON.stringify(session));
}

export function clearSave(): void {
    localStorage.removeItem(gameConfig.saveKey);
}
