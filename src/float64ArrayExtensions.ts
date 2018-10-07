function size(n: number): number {
    return Math.trunc(n * (n + 1) / 2)
}

interface Float64Array {
    writeTri(row: number, column: number, data: number)
    readTri(row: number, column: number): number
}

Float64Array.prototype.writeTri = function(row: number, column: number, data: number) {
    let index = size(row - 1) + column
    this[index] = data
}

Float64Array.prototype.readTri = function(row: number, column: number): number {
    let index = size(row - 1) + column
    return this[index]
}