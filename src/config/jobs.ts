export type JobPay = {
    base: number;
    speedBonusMax: number;
    failPenalty: number;
};

export type JobBounds = {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
};

export type JobStart = {
    x: number;
    y: number;
    z: number;
};

export type JobEnvironment = 'docking-bay' | 'mining-facility';

export type JobDef = {
    id: string;
    number: string;
    title: string;
    client: string;
    assignment: string;
    briefingNote: string;
    environment: JobEnvironment;
    debrisCount: number;
    deadlineSeconds: number;
    pay: JobPay;
    start: JobStart;
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
        environment: 'docking-bay',
        debrisCount: 14,
        deadlineSeconds: 90,
        pay: {
            base: 400,
            speedBonusMax: 80,
            failPenalty: 50
        },
        start: { x: 0, y: 5, z: 12 },
        bounds: {
            min: { x: -18, y: 1.4, z: -18 },
            max: { x: 18, y: 13.5, z: 18 }
        },
        debris: {
            minRadius: 0.32,
            maxRadius: 0.7,
            innerMargin: 2
        }
    },
    {
        id: 'job-002',
        number: '002',
        title: 'Vesta Extraction Site',
        client: 'Helios Asteroid Mining Cooperative',
        assignment:
            'Collect unsecured mining debris. Remain clear of industrial equipment classified as inactive.',
        briefingNote:
            'Management has assured us the crushers are offline for the duration of remediation. The indicator lamps are decorative. Do not become a productivity statistic.',
        environment: 'mining-facility',
        debrisCount: 18,
        deadlineSeconds: 100,
        pay: {
            base: 550,
            speedBonusMax: 90,
            failPenalty: 80
        },
        start: { x: 0, y: 5.2, z: 16 },
        bounds: {
            min: { x: -20, y: 1.5, z: -20 },
            max: { x: 20, y: 14, z: 20 }
        },
        debris: {
            minRadius: 0.28,
            maxRadius: 0.62,
            innerMargin: 2.4
        }
    }
];

export function assignmentFor(jobsCompleted: number): JobDef {
    const index = Math.min(Math.max(0, jobsCompleted), jobs.length - 1);
    const job = jobs[index];
    if (!job) {
        throw new Error('No jobs configured.');
    }
    return job;
}
