/** BlendKit food props for Space Burger debris. Scales target ~1 m longest axis. */

export type FoodDebrisTuning = {
    id: string;
    url: string;
    dims: readonly [number, number, number];
    center: readonly [number, number, number];
    /** Uniform scale so the longest authored axis ≈ targetMeters. */
    scale: number;
};

function tune(
    id: string,
    url: string,
    dims: readonly [number, number, number],
    center: readonly [number, number, number],
    targetMeters: number
): FoodDebrisTuning {
    const longest = Math.max(dims[0], dims[1], dims[2]);
    return {
        id,
        url,
        dims,
        center,
        scale: targetMeters / longest
    };
}

export const foodDebrisCatalog: readonly FoodDebrisTuning[] = [
    tune('burger_lowpoly', '/models/food/burger_lowpoly.glb', [0.1093, 0.0658, 0.1106], [-0.0019, 0.0336, -0.0002], 0.95),
    tune('burger', '/models/food/burger.glb', [0.1326, 0.1107, 0.1257], [-0.0046, 0.0546, -0.0009], 1.05),
    tune('hotdog', '/models/food/hotdog.glb', [0.2005, 0.0779, 0.0955], [-0.0039, 0.0386, -0.0025], 1.1),
    tune('drink', '/models/food/drink.glb', [0.0928, 0.2281, 0.078], [-0.007, 0.114, 0], 0.9),
    tune('pizza', '/models/food/pizza.glb', [0.117, 0.0423, 0.222], [-0.0149, 0.0183, 0], 1.15),
    tune('squeeze_bottle', '/models/food/squeeze_bottle.glb', [0.0527, 0.1976, 0.0527], [0, 0.0988, 0], 0.85)
];

export function foodCollectRadius(tuning: FoodDebrisTuning): number {
    const longest = Math.max(tuning.dims[0], tuning.dims[1], tuning.dims[2]);
    return (longest * tuning.scale) * 0.45;
}
