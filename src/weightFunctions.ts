export function weightTraffic(w: number, mode: string): number {
    switch (mode) {
        case "none":
            return 1;
        case "linear":
            return w;
        case "sqrt":
            return Math.sqrt(w);
        case "square":
            return w ** 2;
        case "exp":
            return Math.min(1e6, Math.exp(w / 3));
        case "log":
            return Math.log(w) + 1;
        case "bell":
            let aw = w / 3 - 2;
            return Math.max(0.01, Math.exp(aw - aw ** 2 / 2) * 25)
        default:
            throw Error("Invalid mode");
    }
}