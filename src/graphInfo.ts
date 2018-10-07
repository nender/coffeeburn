export class GraphInfo {
    rawData: Float64Array

    wrap(data: Float64Array) {
        this.rawData = data
    }

    hubIDs(): Float64Array {
        let hubCount = this.rawData[0]
        return this.rawData.subarray(1, hubCount + 1)
    }

    isDead(hub: number): boolean {
        throw "notimplemented"
    }

    linkCost(from: number, to: number): number {
        throw "notimplemented"
    }
}

function writeTri(row: number, column: number, data: number) { 
    let index = size(row - 1) + column
    this[index] = data
}

function readTri(row: number, column: number): number {
    let index = size(row - 1) + column
    return this[index]
}

function size(n: number): number {
    return Math.trunc(n * (n + 1) / 2)
}