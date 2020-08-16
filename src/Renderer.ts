import { Scene } from "./burn";
import { Packet } from "./Packet";
import { app } from "./main";

export const intToColor = (function() {
    const colorTable = new Map<number, string>()
    return function intToColor(i: number): string {
        if (colorTable.has(i))
            return colorTable.get(i)!
        else {
            // turns out that random rgb values don't *look* random!
            // so instead randomize hue value of hsl color
            const colorString = `hsl(${randInt(0,360)},100%,50%)`
            colorTable.set(i, colorString)
            return colorString
        }
    }
})()

function randInt(min: number, max: number): number {
    const low = Math.ceil(min)
    const high = Math.floor(max)
    return Math.floor(app.rng.random() * (max - min)) + min
}

export class Renderer {
    ctx: CanvasRenderingContext2D

    readonly height: number
    readonly width: number

    frameCount = 0
    milisPerFrame = 0
    lastFrame = performance.now()

    constructor(canvas: HTMLCanvasElement) {
        this.width = canvas.width
        this.height = canvas.height
        this.ctx = canvas.getContext('2d')!
        this.ctx.font = '8px monospace'
    }

    render(scene: Scene): void {
        let ctx = this.ctx
        this.ctx.fillStyle = "black"
        ctx.fillRect(0, 0, this.width, this.height)
        
        for (let pipe of scene.pipes) {
            let lineWidth = Math.min(6, (pipe.traffic() - 1) / 24)
            let p1 = pipe.ends[0].position
            let p2 = pipe.ends[1].position

            if (lineWidth >= 1/255) {
                if (pipe.ends[0].isDead || pipe.ends[1].isDead)
                    ctx.strokeStyle = "red"
                else 
                    ctx.strokeStyle = "white"

                ctx.lineWidth = lineWidth

                let [x1, y1] = p1
                let [x2, y2] = p2

                ctx.beginPath()
                ctx.moveTo(x1, y1)
                ctx.lineTo(x2, y2)
                ctx.stroke()
            }

            for (let packet of pipe.inflight.keys()) {
                const aToB = packet.TAToB
                if (aToB) {
                    this.drawPacket(packet, p1, p2)
                } else {
                    this.drawPacket(packet, p2, p1)
                }
            }
        }
        
        const hubsize = 7
        for (let h of scene.hubs.values()) {
            if (h.isDead)
                ctx.fillStyle = "red"
            else
                ctx.fillStyle = "white"

            let [x, y] = h.position
            ctx.fillRect(x - (hubsize/2), y - (hubsize/2), hubsize, hubsize)
        }

        let fps = Math.round(1000/this.milisPerFrame)
        if (fps >= 60) {
            ctx.fillStyle = "green"
        } else {
            ctx.fillStyle = "yellow"
        }
        ctx.fillText(fps.toString(), 0, 8)

        ctx.fillStyle = "white"
        ctx.fillText(`Packets: ${scene.packets.size} `, 0, 8*2)
        ctx.fillText(`Hubs: ${scene.hubs.size} `, 0, 8*3)

        this.frameCount += 1
        let frameTime = performance.now()
        this.milisPerFrame = (this.milisPerFrame * 19 + (frameTime - this.lastFrame)) / 20
        this.lastFrame = frameTime
    }

    drawPacket(packet: Packet, p1: [number, number], p2: [number, number]) {
        let ctx = this.ctx
        let [x1, y1] = p1
        let dx = (p2[0] - p1[0]) * packet.TProgress
        let dy = (p2[1] - p1[1]) * packet.TProgress
        if (packet.isPOD) {
            const packetSize = 12
            const r = packetSize / 2
            ctx.fillStyle = "red"
            ctx.beginPath()
            ctx.moveTo(x1+ dx, y1 + dy - r)
            ctx.lineTo(x1 + dx + r, y1 + dy + r)
            ctx.lineTo(x1 + dx - r, y1 + dy + r)
            ctx.fill()
        } else {
            const packetSize = 4
            const r = packetSize / 2
            ctx.fillStyle = intToColor(packet.target.id)
            ctx.fillRect((x1 + dx) - r,
                (y1 + dy) - r,
                packetSize, packetSize)
        }
    }
}