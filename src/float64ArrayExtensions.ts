export function triangleNumber(n: number): number {
    return Math.trunc(n * (n + 1) / 2)
}

declare global {
    interface Float64Array {
        writeTri(row: number, column: number, data: number)
        readTri(row: number, column: number): number
    }
}

Float64Array.prototype.writeTri = function(row: number, column: number, data: number) {
    if (row <= column) {
        this[triangleNumber(row - 1) + column] = data
    } else if (row > column) {
        this[triangleNumber(column - 1) + row] = data
    }
}

Float64Array.prototype.readTri = function(row: number, column: number): number {
    if (row <= column) {
        return this[triangleNumber(row - 1) + column]
    } else if (row > column) {
        return this[triangleNumber(column - 1) + row]
    }
}