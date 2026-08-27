export type JobPay = {
    base: number;
    speedBonusMax: number;
    failPenalty: number;
};

export type JobBounds = {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
};

export type JobDef = {
    id: string;
    number: string;
    title: string;
    client: string;
    assignment: string;
    briefingNote: string;
    debrisCount: number;
    deadlineSeconds: number;
    pay: JobPay;
    bounds: JobBounds;
    debris: {
        minRadius: number;
        maxRadius: number;
        innerMargin: number;
    };
};

export const jobs: JobDef[] = [
    {
        id: 'job-001',
        number: '001',
        title: 'Docking Bay 7',
        client: 'Galactic Freight Corporation',
        assignment:
            'Collect all unsecured orbital debris within the designated remediation volume.',
        briefingNote:
            'Client describes the area as perfectly safe. Standard interstellar custodial remediation. Do not scratch the bulkheads.',
        debrisCount: 14,
        deadlineSeconds: 90,
        pay: {
            base: 400,
            speedBonusMax: 80,
            failPenalty: 50
        },
        bounds: {
            min: { x: -18, y: 1.4, z: -18 },
            max: { x: 18, y: 13.5, z: 18 }
        },
        debris: {
            minRadius: 0.32,
            maxRadius: 0.7,
            innerMargin: 2
        }
    }
];

export function currentJob(): JobDef {
    const job = jobs[0];
    if (!job) {
        throw new Error('No jobs configured.');
    }
    return job;
}
