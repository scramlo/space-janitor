import { copy } from '../config/copy.ts';
import { gameConfig } from '../config/gameConfig.ts';
import type { JobDef } from '../config/jobs.ts';
import type { GameSession } from '../game/session.ts';

export type PayLine = {
    label: string;
    amount: number;
};

export type JobPayout = {
    success: boolean;
    lines: PayLine[];
    total: number;
    employmentDelta: number;
};

export function settleJob(
    job: JobDef,
    success: boolean,
    remainingTime: number,
    session: GameSession,
    propertyDamage = 0
): JobPayout {
    const lines: PayLine[] = [];
    if (success) {
        const fraction = Math.max(0, Math.min(1, remainingTime / job.deadlineSeconds));
        const bonus = Math.round(job.pay.speedBonusMax * fraction);
        lines.push({ label: copy.lineBase, amount: job.pay.base });
        lines.push({ label: copy.lineEfficiency, amount: bonus });
        lines.push({ label: copy.lineDamage, amount: -Math.max(0, Math.round(propertyDamage)) });
        lines.push({ label: copy.lineLate, amount: 0 });
    } else {
        lines.push({ label: copy.lineBase, amount: 0 });
        lines.push({ label: copy.lineEfficiency, amount: 0 });
        lines.push({ label: copy.lineDamage, amount: -Math.max(0, Math.round(propertyDamage)) });
        lines.push({ label: copy.lineLate, amount: -job.pay.failPenalty });
    }

    const total = lines.reduce((sum, line) => sum + line.amount, 0);
    session.money = Math.max(0, session.money + total);

    const employmentDelta = success ? gameConfig.employment.successDelta : gameConfig.employment.failDelta;
    session.employment = Math.min(
        gameConfig.employment.max,
        Math.max(gameConfig.employment.firedAt, session.employment + employmentDelta)
    );

    if (success) {
        session.jobsCompleted += 1;
    }

    if (session.employment <= gameConfig.employment.firedAt) {
        session.outcome = 'terminated';
    } else if (session.money >= gameConfig.surgeryCost) {
        session.outcome = 'victory';
    }

    return { success, lines, total, employmentDelta };
}
