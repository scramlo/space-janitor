import { Vec3 } from 'playcanvas';

import type { ShipController } from '../player/ShipController.ts';

import type { DebrisField } from './DebrisField.ts';

export class CollectionSystem {
    private readonly shipPos = new Vec3();
    private readonly piecePos = new Vec3();

    update(ship: ShipController, field: DebrisField): number {
        this.shipPos.copy(ship.entity.getPosition());
        let collected = 0;
        for (const piece of field.pieces) {
            if (piece.collected) {
                continue;
            }
            this.piecePos.copy(piece.entity.getPosition());
            if (this.shipPos.distance(this.piecePos) <= ship.radius + piece.radius) {
                field.collect(piece);
                collected += 1;
            }
        }
        return collected;
    }
}
