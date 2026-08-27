export const gameConfig = {
    surgeryCost: 2000,
    startingMoney: 0,
    startingEmployment: 80,
    dtClamp: 0.05,
    saveKey: 'space-janitor-mvp',
    /** Seconds to hold still after Accept while the engine start SFX plays. */
    jobStartHold: 3,
    /** "GO!" cue length; shown this many seconds before the hold ends so it clears with the SFX. */
    goCueDuration: 1.2,
    employment: {
        successDelta: 10,
        failDelta: -25,
        max: 100,
        firedAt: 0
    },
    ship: {
        thrust: 28,
        maxSpeed: 16,
        linearDamping: 2.4,
        yawSpeed: 95,
        pitchSpeed: 70,
        maxPitch: 55,
        radius: 1.15,
        steerAngle: 32,
        steerLerp: 14,
        headlight: {
            intensity: 16,
            range: 36,
            innerCone: 22,
            outerCone: 48
        }
    },
    camera: {
        distance: 9,
        height: 2.8,
        lookAhead: 4,
        lerp: 7,
        fov: 52,
        collisionPadding: 0.45,
        showcase: {
            distance: 8.5,
            height: 2.4,
            yaw: 38,
            frameShift: 2.5,
            spinSpeed: 18
        }
    }
} as const;
