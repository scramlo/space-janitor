import type { AppBase } from 'playcanvas';

import type { JobDef } from '../config/jobs.ts';

import { buildBay } from './buildBay.ts';
import type { BuiltWorld } from './buildBay.ts';
import { buildMine } from './buildMine.ts';

export function buildJobWorld(app: AppBase, job: JobDef): BuiltWorld {
    if (job.environment === 'mining-facility') {
        return buildMine(app, job);
    }
    return buildBay(app, job);
}
