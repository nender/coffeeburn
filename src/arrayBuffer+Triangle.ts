interface Float64Array {
    writeTri(row: number, column: number, data: number)
    readTri(row: number, column: number): number
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

Float64Array.prototype.writeTri = writeTri
Float64Array.prototype.readTri = readTri