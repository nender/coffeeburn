import "./float64ArrayExtensions"

export class GraphInfo {
    rawData: Float64Array
    header: Float64Array
    graph: Float64Array

    wrap(data: Float64Array) {
        this.rawData = data
        let hubCount = data[0]
        this.header = data.subarray(1, hubCount)
        this.graph = data.subarray(hubCount + 1, hubCount + 1 + size(hubCount))
    }

    hubIDs(): Float64Array {
        return this.header
    }

    isDead(hub: number): boolean {
        let index = this.idToIndex(hub)
        return
    }

    linkCost(from: number, to: number): number {
        let fromIndex = this.idToIndex(from)
        let toIndex = this.idToIndex(to)
        if (fromIndex < toIndex) {
            return this.graph.readTri(fromIndex, toIndex)
        } else {
            return this.graph.readTri(toIndex, fromIndex)
        }
    }

    idToIndex(id: number): number {
        return this.header.indexOf(id)
    }
}