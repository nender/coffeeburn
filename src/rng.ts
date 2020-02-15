export class RandomNumberGenerator {
    private state: number | null = null

    constructor(seed?: number) {
        if (seed)
            this.state = seed;
    }

    random(): number {
        if (!this.state)
            return Math.random()

        let max = 1
        let min = 0

        this.state = (this.state * 9301 + 49297) % 233280;
        var rnd = this.state / 233281;

        return min + rnd * (max - min);
    }
}