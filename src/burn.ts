declare var DEBUG: boolean
export function log(msg: string) {
    if (DEBUG) {
        let now = performance.now().toPrecision(4)
        console.log(now + ' ' + msg)
    }
}

// Data Types
export type RouteInfo = Map<number, Map<number, number | null>>