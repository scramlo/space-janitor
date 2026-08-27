import type { AppBase } from 'playcanvas';

import type { JobDef } from '../config/jobs.ts';

import { buildBay } from './buildBay.ts';
import type { BuiltWorld } from './buildBay.ts';
import { buildMine } from './buildMine.ts';
import type { WorldTextures } from './textures.ts';

export function buildJobWorld(app: AppBase, job: JobDef, textures: WorldTextures = { rockWall: null }): BuiltWorld {
    if (job.environment === 'mining-facility') {
        return buildMine(app, job, textures.rockWall);
    }
    return buildBay(app, job);
}
