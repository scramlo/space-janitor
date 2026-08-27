import { KEY_ENTER, KEY_SPACE  } from 'playcanvas';
import type { AppBase } from 'playcanvas';

import { playCollectBlip } from '../audio/blip.ts';
import { gameConfig } from '../config/gameConfig.ts';
import { assignmentFor } from '../config/jobs.ts';
import type { JobDef } from '../config/jobs.ts';
import { thrusterUpgrade } from '../config/upgrades.ts';
import { clearSave, loadSave, writeSave } from '../persist/save.ts';
import { CameraController } from '../player/CameraController.ts';
import { ShipController } from '../player/ShipController.ts';
import { settleJob  } from '../systems/Economy.ts';
import type { JobPayout } from '../systems/Economy.ts';
import { hasReachedSurgeryFund, isFired } from '../systems/Employment.ts';
import { JobSystem } from '../systems/JobSystem.ts';
import { Timer } from '../systems/Timer.ts';
import { canPurchase, movementMultipliers, purchaseUpgrade } from '../systems/UpgradeSystem.ts';
import { GameUI } from '../ui/GameUI.ts';
import { buildJobWorld } from '../world/buildJobWorld.ts';
import { CollectionSystem } from '../world/CollectionSystem.ts';
import { DebrisField } from '../world/DebrisField.ts';
import type { ObstacleBox } from '../world/obstacles.ts';
import type { WorldTextures } from '../world/textures.ts';

import { GameScreen } from './screens.ts';
import { createSession, ownsUpgrade } from './session.ts';
import type { GameSession } from './session.ts';

export class Game {
    private readonly app: AppBase;
    private readonly ship: ShipController;
    private readonly camera: CameraController;
    private readonly debris: DebrisField;
    private readonly collection: CollectionSystem;
    private readonly jobSystem: JobSystem;
    private readonly timer: Timer;
    private readonly ui: GameUI;

    private session: GameSession;
    private job: JobDef;
    private worldJobId: string | null = null;
    private worldRoot: { destroy(): void } | null = null;
    private obstacles: readonly ObstacleBox[] = [];
    private propertyDamage = 0;
    private screen: GameScreen = GameScreen.Briefing;
    private payout: JobPayout | null = null;
    private confirmLock = 0.35;
    private readonly textures: WorldTextures;

    constructor(app: AppBase, uiHost: HTMLElement, textures: WorldTextures = { rockWall: null }) {
        this.app = app;
        this.textures = textures;
        this.session = loadSave();
        this.job = assignmentFor(this.session.jobsCompleted);
        this.ship = new ShipController(app, this.job.bounds);
        this.camera = new CameraController(app, this.ship.entity);
        this.debris = new DebrisField(app);
        this.collection = new CollectionSystem();
        this.jobSystem = new JobSystem();
        this.timer = new Timer();
        this.ui = new GameUI(uiHost, {
            onAcceptJob: () => this.acceptJob(),
            onAcknowledgeResults: () => this.acknowledgeResults(),
            onBuyUpgrade: () => this.buyUpgrade(),
            onSkipUpgrade: () => this.enterBriefing(),
            onRestart: () => this.newCareer()
        });
        this.applyUpgrades();
        this.loadAssignment();

        if (this.session.outcome === 'victory') {
            this.setScreen(GameScreen.Victory);
        } else if (this.session.outcome === 'terminated') {
            this.setScreen(GameScreen.GameOver);
        } else {
            this.setScreen(GameScreen.Briefing);
        }

        window.addEventListener('keydown', this.onWindowKeyDown);
    }

    update(dt: number): void {
        const clamped = Math.min(dt, gameConfig.dtClamp);
        this.confirmLock = Math.max(0, this.confirmLock - clamped);
        this.handleConfirmKeys();

        if (this.screen !== GameScreen.Playing) {
            this.camera.update(clamped);
            return;
        }

        this.ship.update(clamped);
        this.camera.update(clamped);
        this.debris.spin(clamped);
        const collected = this.collection.update(this.ship, this.debris);
        if (collected > 0) {
            this.jobSystem.noteCollected(collected);
            playCollectBlip();
        }
        const hits = this.ship.consumeHits();
        if (hits > 0) {
            this.propertyDamage = Math.min(120, this.propertyDamage + hits * 20);
        }
        this.timer.update(clamped);
        this.ui.renderHud(this.hudSnapshot());

        if (this.jobSystem.isComplete()) {
            this.finishJob(true);
            return;
        }
        if (this.timer.expired) {
            this.finishJob(false);
        }
    }

    destroy(): void {
        window.removeEventListener('keydown', this.onWindowKeyDown);
    }

    setTextures(textures: WorldTextures): void {
        this.textures.rockWall = textures.rockWall;
        if (this.job.environment !== 'mining-facility') {
            return;
        }
        this.worldRoot?.destroy();
        const built = buildJobWorld(this.app, this.job, this.textures);
        this.worldRoot = built.root;
        this.obstacles = built.obstacles;
        this.worldJobId = this.job.id;
        this.ship.setObstacles(this.obstacles);
        if (this.screen === GameScreen.Playing) {
            this.debris.spawn(this.job, this.obstacles);
        }
    }

    private readonly onWindowKeyDown = (event: globalThis.KeyboardEvent): void => {
        if (event.repeat || event.code !== 'KeyH') {
            return;
        }
        event.preventDefault();
        this.ship.toggleHeadlight();
    };

    private handleConfirmKeys(): void {
        const keyboard = this.app.keyboard;
        if (!keyboard || this.confirmLock > 0) {
            return;
        }
        const pressed = keyboard.wasPressed(KEY_SPACE) || keyboard.wasPressed(KEY_ENTER);
        if (!pressed || this.screen === GameScreen.Playing) {
            return;
        }
        this.blurUi();
        if (this.screen === GameScreen.Briefing) {
            this.acceptJob();
            return;
        }
        if (this.screen === GameScreen.Results) {
            this.acknowledgeResults();
            return;
        }
        if (this.screen === GameScreen.Upgrade) {
            if (canPurchase(this.session, thrusterUpgrade())) {
                this.buyUpgrade();
                return;
            }
            this.enterBriefing();
            return;
        }
        if (this.screen === GameScreen.GameOver || this.screen === GameScreen.Victory) {
            this.newCareer();
        }
    }

    private acceptJob(): void {
        if (this.screen !== GameScreen.Briefing) {
            return;
        }
        const job = this.job;
        this.ship.reset();
        this.applyUpgrades();
        this.propertyDamage = 0;
        this.debris.spawn(job, this.obstacles);
        this.jobSystem.start(job.debrisCount);
        this.timer.start(job.deadlineSeconds);
        this.camera.snap();
        this.blurUi();
        this.setScreen(GameScreen.Playing);
    }

    private finishJob(success: boolean): void {
        this.jobSystem.stop();
        this.timer.stop();
        this.payout = settleJob(this.job, success, this.timer.remaining, this.session, this.propertyDamage);
        writeSave(this.session);
        this.setScreen(GameScreen.Results);
    }

    private acknowledgeResults(): void {
        if (this.screen !== GameScreen.Results) {
            return;
        }
        if (hasReachedSurgeryFund(this.session)) {
            this.session.outcome = 'victory';
            writeSave(this.session);
            this.setScreen(GameScreen.Victory);
            return;
        }
        if (isFired(this.session)) {
            this.session.outcome = 'terminated';
            writeSave(this.session);
            this.setScreen(GameScreen.GameOver);
            return;
        }
        if (ownsUpgrade(this.session, thrusterUpgrade().id)) {
            this.enterBriefing();
            return;
        }
        this.setScreen(GameScreen.Upgrade);
    }

    private buyUpgrade(): void {
        if (this.screen !== GameScreen.Upgrade) {
            return;
        }
        const upgrade = thrusterUpgrade();
        if (!purchaseUpgrade(this.session, upgrade)) {
            return;
        }
        this.applyUpgrades();
        writeSave(this.session);
        this.enterBriefing();
    }

    private enterBriefing(): void {
        this.loadAssignment();
        this.setScreen(GameScreen.Briefing);
    }

    private loadAssignment(): void {
        this.job = assignmentFor(this.session.jobsCompleted);
        if (this.worldJobId !== this.job.id) {
            this.worldRoot?.destroy();
            const built = buildJobWorld(this.app, this.job, this.textures);
            this.worldRoot = built.root;
            this.obstacles = built.obstacles;
            this.worldJobId = this.job.id;
            this.ship.setObstacles(this.obstacles);
        }
        this.ship.setBounds(this.job.bounds);
        this.ship.setStart(this.job.start);
        this.ship.reset();
        this.debris.spawn(this.job, this.obstacles);
        this.camera.snap();
    }

    private newCareer(): void {
        clearSave();
        this.session = createSession();
        writeSave(this.session);
        this.applyUpgrades();
        this.enterBriefing();
    }

    private applyUpgrades(): void {
        const multipliers = movementMultipliers(this.session);
        this.ship.setMultipliers(multipliers.thrust, multipliers.maxSpeed);
    }

    private setScreen(screen: GameScreen): void {
        this.screen = screen;
        this.confirmLock = 0.35;
        this.ui.show(screen, {
            job: this.job,
            session: this.session,
            payout: this.payout,
            upgrade: thrusterUpgrade(),
            hud: this.hudSnapshot()
        });
    }

    private hudSnapshot() {
        return {
            timeRemaining: this.timer.remaining,
            debrisRemaining: this.jobSystem.remaining(),
            money: this.session.money,
            employment: this.session.employment
        };
    }

    private blurUi(): void {
        if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }
    }
}
