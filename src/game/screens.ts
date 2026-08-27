export const GameScreen = {
    Briefing: 'briefing',
    Playing: 'playing',
    Results: 'results',
    Upgrade: 'upgrade',
    GameOver: 'gameOver',
    Victory: 'victory'
} as const;

export type GameScreen = (typeof GameScreen)[keyof typeof GameScreen];
