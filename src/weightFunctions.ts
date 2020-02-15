export enum Weight {
    none,
    linear,
    sqrt,
    square,
    exp,
    log,
    bell
}

export function weight({ value, mode }: { value: number; mode: Weight }): number {
    switch (mode) {
        case Weight.none:
            return 1
        case Weight.linear:
            return value
        case Weight.sqrt:
            return Math.sqrt(value)
        case Weight.square:
            return value ** 2
        case Weight.exp:
            return Math.min(1e6, Math.exp(value / 3))
        case Weight.log:
            return Math.log(value) + 1
        case Weight.bell:
            let aw = value / 3 - 2
            return Math.max(0.01, Math.exp(aw - aw ** 2 / 2) * 25)
    }
}