import { gameConfig } from '../config/gameConfig.ts';

export type CareerOutcome = 'playing' | 'victory' | 'terminated';

export type GameSession = {
    money: number;
    employment: number;
    ownedUpgradeIds: string[];
    jobsCompleted: number;
    outcome: CareerOutcome;
};

export function createSession(): GameSession {
    return {
        money: gameConfig.startingMoney,
        employment: gameConfig.startingEmployment,
        ownedUpgradeIds: [],
        jobsCompleted: 0,
        outcome: 'playing'
    };
}

export function ownsUpgrade(session: GameSession, id: string): boolean {
    return session.ownedUpgradeIds.includes(id);
}
