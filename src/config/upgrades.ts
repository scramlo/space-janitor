export type UpgradeCategory = 'thrusters' | 'scanner' | 'maneuverability' | 'capacity';

export type UpgradeEffects = {
    thrustMultiplier?: number;
    maxSpeedMultiplier?: number;
};

export type UpgradeDef = {
    id: string;
    category: UpgradeCategory;
    name: string;
    description: string;
    cost: number;
    effects: UpgradeEffects;
};

export const upgrades: UpgradeDef[] = [
    {
        id: 'thrusters-1',
        category: 'thrusters',
        name: 'Certified Impulse Thrusters',
        description:
            'Factory-authorized linear accelerators. Improves professional response time. Does not, under any policy, extend client deadlines.',
        cost: 500,
        effects: {
            thrustMultiplier: 1.35,
            maxSpeedMultiplier: 1.28
        }
    }
];

export function thrusterUpgrade(): UpgradeDef {
    const upgrade = upgrades[0];
    if (!upgrade) {
        throw new Error('No upgrades configured.');
    }
    return upgrade;
}
