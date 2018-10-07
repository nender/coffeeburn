import { triangleNumber } from "./float64ArrayExtensions"
import { Hub } from "./burn"

export class GraphInfo {
    header: Float64Array
    graph: Float64Array

    private _rawData: Float64Array
    get rawData() {
        return this._rawData
    }
    set rawData(newData: Float64Array) {
        this._rawData = newData
        this.header = null
        this.graph = null
    }

    static bufferSizeDoubles(count: number): number {
        return 1 + count + triangleNumber(count)
    }

    writeGraph(hubs: Hub[]) {
        if (!this.rawData) {
            throw "Data Not Initialized"
        }

        let hubCount = hubs.length
        this.rawData[0] = hubCount

        this.header = this.rawData.subarray(1, hubCount + 1)

        for (let i = 0; i < hubs.length; i++) {
            this.header[i] = hubs[i].id
        }

        this.graph = this.rawData.subarray(hubCount + 1, hubCount + 1 + triangleNumber(hubCount))

        for (let h of hubs) {
            for (let [n, p] of h.neighbors) {
                let hindex = this.idToIndex(h.id)
                let nindex = this.idToIndex(n.id)
                this.graph.writeTri(hindex, nindex, p.cost())
            }
        }
    }

    wrap(data: Float64Array) {
        this.rawData = data
        let hubCount = data[0]
        this.header = data.subarray(1, hubCount + 1)
        this.graph = data.subarray(hubCount + 1, hubCount + 1 + triangleNumber(hubCount))
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