import type { JobDef } from '../config/jobs.ts';
import type { UpgradeDef } from '../config/upgrades.ts';
import { GameScreen } from '../game/screens.ts';
import type { GameSession } from '../game/session.ts';
import type { JobPayout } from '../systems/Economy.ts';

import { Hud  } from './hud.ts';
import type { HudSnapshot } from './hud.ts';
import { GoCue } from './GoCue.ts';
import { BriefingScreen } from './screens/BriefingScreen.ts';
import { GameOverScreen } from './screens/GameOverScreen.ts';
import { ResultsScreen } from './screens/ResultsScreen.ts';
import { UpgradeScreen } from './screens/UpgradeScreen.ts';
import { VictoryScreen } from './screens/VictoryScreen.ts';

export class GameUI {
    readonly hud: Hud;
    private readonly goCue: GoCue;
    private readonly briefing: BriefingScreen;
    private readonly results: ResultsScreen;
    private readonly upgrade: UpgradeScreen;
    private readonly gameOver: GameOverScreen;
    private readonly victory: VictoryScreen;

    constructor(host: HTMLElement, handlers: {
        onAcceptJob: () => void;
        onAcknowledgeResults: () => void;
        onBuyUpgrade: () => void;
        onSkipUpgrade: () => void;
        onRestart: () => void;
    }) {
        host.classList.add('ui-root');
        this.hud = new Hud();
        this.goCue = new GoCue();
        this.briefing = new BriefingScreen(handlers.onAcceptJob);
        this.results = new ResultsScreen(handlers.onAcknowledgeResults);
        this.upgrade = new UpgradeScreen(handlers.onBuyUpgrade, handlers.onSkipUpgrade);
        this.gameOver = new GameOverScreen(handlers.onRestart);
        this.victory = new VictoryScreen(handlers.onRestart);
        host.append(
            this.hud.root,
            this.goCue.root,
            this.briefing.root,
            this.results.root,
            this.upgrade.root,
            this.gameOver.root,
            this.victory.root
        );
    }

    show(screen: GameScreen, data: {
        job: JobDef;
        session: GameSession;
        payout: JobPayout | null;
        upgrade: UpgradeDef;
        hud: HudSnapshot;
    }): void {
        this.hideAll();
        this.hud.setVisible(screen === GameScreen.Playing);
        if (screen === GameScreen.Playing) {
            this.hud.render(data.hud);
            return;
        }
        if (screen === GameScreen.Briefing) {
            this.briefing.show(data.job, data.session);
            return;
        }
        if (screen === GameScreen.Results && data.payout) {
            this.results.show(data.payout, data.session);
            return;
        }
        if (screen === GameScreen.Upgrade) {
            this.upgrade.show(data.upgrade, data.session);
            return;
        }
        if (screen === GameScreen.GameOver) {
            this.gameOver.show();
            return;
        }
        if (screen === GameScreen.Victory) {
            this.victory.show();
        }
    }

    renderHud(snapshot: HudSnapshot): void {
        this.hud.render(snapshot);
    }

    showGoCue(): void {
        this.goCue.show();
    }

    private hideAll(): void {
        this.goCue.hide();
        this.briefing.hide();
        this.results.hide();
        this.upgrade.hide();
        this.gameOver.hide();
        this.victory.hide();
        this.hud.setVisible(false);
    }
}
