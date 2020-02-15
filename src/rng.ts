export class RandomNumberGenerator {
    private state: number | null = null

    constructor(seed?: number) {
        if (seed)
            this.state = seed
    }

    random(): number {
        if (!this.state)
            return Math.random()

        let max = 1
        let min = 0

        this.state = (this.state * 9301 + 49297) % 233280
        var rnd = this.state / 233281

        return min + rnd * (max - min)
    }

    randomSelection<T>(collection: Iterable<T>): T {
        let result: T | null = null
        let count = 0
        for (let curr of collection) {
            if (this.random() < 1/++count)
                result = curr
        }
        return result!
    }
}