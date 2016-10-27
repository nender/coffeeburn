// ad-hoc config
let LOGGING = false;

function log(str: string): void {
    if (LOGGING)
        console.log(str);
}

let getId = (function() {
    let id = 0;
    return () => id += 1;
}());

function randomSelection<T>(target: T[]): T {
    const index = Math.floor(Math.random() * target.length);
    return target[index];
}


// Data Types

class Packet {
    readonly id: number;
    readonly destId: number;
    
    constructor(destId: number) {
        this.id = getId();
        this.destId = destId;
    }
}

class Pipe {
    readonly ends: [Hub, Hub];
    readonly inflight: Map<number, FlightState>;
    readonly name: string;
    readonly weight: number;
    private readonly speed: number;
    
    constructor(a: Hub, b: Hub) {
        const canonicalEnds: [Hub, Hub] = [a , b];
        canonicalEnds.sort();
        this.name = canonicalEnds[0].id + '|' + canonicalEnds[1].id;
        
        this.ends = [a, b];
        
        this.inflight = new Map<number, FlightState>();
        let dx = Math.abs(a.position[0] - b.position[0]);
        let dy = Math.abs(a.position[1] - b.position[1]);
        this.weight = Math.sqrt(dx*dx+dy*dy);
        
        this.speed = 1/this.weight;
    }
    
    receive(p: Packet, senderId: number): void {
        log(`P${p.id} received by ${this.name}`);
        if (senderId == this.ends[0].id)
            this.inflight.set(p.id, new FlightState(p, true));
        else if (senderId == this.ends[1].id)
            this.inflight.set(p.id, new FlightState(p, false));
        else
            throw "Bad id";
    }
    
    step(dt: number): void {
        let delivered: FlightState[] = [];
        
        for (let flightStatus of this.inflight.values()){
            flightStatus.progress += this.speed*dt;
            
            if (flightStatus.progress >= 1)
                delivered.push(flightStatus);
        }
        
        for (let status of delivered) {
            this.inflight.delete(status.packet.id);
            
            let end = (() => {
                if (status.flyingAtoB)
                    return this.ends[1];
                else
                    return this.ends[0];
            })();
            
            log(`${this.name} handed off P${status.packet.id} to H${end.id}`)
            end.receive(status.packet);
        }
    }
}

class FlightState {
    readonly packet: Packet;
    readonly flyingAtoB: boolean;
    progress: number;
    
    constructor(p: Packet, direction: boolean) {
        this.packet = p;
        this.flyingAtoB = direction;
        this.progress = 0;
    }
}

class PipeReference {
    readonly pipe: Pipe;
    readonly hub: Hub;
    
    constructor(pipe: Pipe, hub: Hub) {
        this.pipe = pipe;
        this.hub = hub;
    }
}

class Hub {
    readonly position: [number, number];
    readonly id: number;
    readonly neighbors: PipeReference[];
    
    constructor(x: number, y: number) {
        this.position = [x, y]
        this.id = getId();
        this.neighbors = [];
    }
    
    receive(p: Packet): void {
        if (p.destId === this.id) {
            log(`P${p.id} delivered to ${this.id}!`);
            return;
       }
            
        if (this.neighbors.length === 0)
            throw "No pipes";
            
        let targetPipe = randomSelection(this.neighbors);
        log(`H${this.id} routing P${p.id} on ${targetPipe.pipe.name}`);
        targetPipe.pipe.receive(p, this.id);
    }
}


// Program

function generateScene(): [Hub[], Pipe[]] {
    function linkHubs(a: Hub, b: Hub): void {
        const pipe = new Pipe(a, b);
        a.neighbors.push(new PipeReference(pipe, b));
        b.neighbors.push(new PipeReference(pipe, a));
        pipes.push(pipe);
    }
    
    const hubs: Hub[] = [];
    
    for (let i = 0; i < 20; i++) {
        let x = Math.random();
        let y = Math.random();
        hubs.push(new Hub(x,y));
    }
    
    const pipes: Pipe[] = [];
    const startHub = randomSelection(hubs);
    const disovered = new Set<Hub>();
    function dfs(h: Hub) {
        disovered.add(h);
        for (let w of hubs) {
            if (w !== h && !disovered.has(w)) {
                linkHubs(h, w);
                dfs(w);
            }
        }
    }
    dfs(startHub);
    
    const bonusPipes = hubs.length;
    for (let i = 0; i < bonusPipes; i++) {
        let a: Hub, b: Hub;
        do {
            a = randomSelection(hubs);
            b = randomSelection(hubs);
        } while (a === b)
        linkHubs(a, b);
    }
    
    return [hubs, pipes];
}

let intToColor = (function() {
    const colorTable = new Map<number, string>();
    const r100 = () => Math.floor(Math.random() * 100);
    return function intToColor(i: number): string {
        if (colorTable.has(i))
            return colorTable.get(i);
        else {
            const colorString = `rgb(${r100()}%,${r100()}%,${r100()}%)`;
            colorTable.set(i, colorString);
            return colorString;
        }
    }
})();

function render(ctx: CanvasRenderingContext2D, pipes: Pipe[], hubs: Hub[], height: number, width: number): void {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, width, height);
    
    for (let p of pipes) {
        ctx.strokeStyle = "dimgrey";
            
        let [x1, y1] = p.ends[0].position;
        let [x2, y2] = p.ends[1].position;
        ctx.beginPath();
        ctx.moveTo(x1*width, y1*height);
        ctx.lineTo(x2*width, y2*height);
        ctx.stroke();
        
        const packetSize = 4;
        for (let flightStatus of p.inflight.values()) {
            ctx.fillStyle = intToColor(flightStatus.packet.destId);
            if (flightStatus.flyingAtoB) {
                let dx = (x2 - x1) * flightStatus.progress;
                let dy = (y2 - y1) * flightStatus.progress;
                ctx.fillRect((x1+dx)*width - packetSize/2,
                    (y1+dy)*height - packetSize/2,
                    packetSize, packetSize);
            } else {
                let dx = (x1 - x2) * flightStatus.progress;
                let dy = (y1 - y2) * flightStatus.progress;
                
                ctx.fillRect((x2+dx)*width - packetSize/2,
                    (y2+dy)*height - packetSize/2,
                    packetSize, packetSize);
            }
        }
    }
    
    const hubsize = 7;
    for (let h of hubs) {
        ctx.fillStyle = intToColor(h.id);
        let [x, y] = h.position;
        ctx.fillRect(x*width - (hubsize/2), y*height - (hubsize/2), hubsize, hubsize);
    }
}

function dijkstra(graph: Hub[], source: Hub): [Map<Hub, number>, Map<Hub, Hub>] {
    function minDistFromQ(): Hub {
        let minDist = Infinity;
        let hub: Hub = null;
        
        for (let v of Q.keys()) {
            let weight = dist.get(v);
            if (weight < minDist) {
                minDist = weight;
                hub = v;
            }
        }
        
        return hub;
    }
    
    const Q = new Set<Hub>();
    const dist = new Map<Hub, number>();
    const prev = new Map<Hub, Hub>();
    
    for (let v of graph) {
        dist.set(v, Infinity);
        prev.set(v, null);
        Q.add(v);
    }
    
    dist.set(source, 0);
    
    while (Q.size > 0) {
        const u = minDistFromQ();
        Q.delete(u);
        
        for (let pr of u.neighbors) {
            const v = pr.hub;
            const alt = dist.get(v) + pr.pipe.weight;
            if (alt < dist.get(v)) {
                dist.set(v, alt);
                prev.set(v, u);
            }
        }
    }
    
    return [dist, prev];
}

function main() {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    
    const height = canvas.height;
    const width = canvas.width;
    
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, width, height);
    
    const [hubs, pipes] = generateScene();
    
    for (let i = 0; i < 100; i++) {
        const targetId = randomSelection(hubs).id;
        randomSelection(hubs).receive(new Packet(targetId));
    }
    
    let renderStep = function() {
        render(ctx, pipes, hubs, height, width);
        for (let p of pipes)
            p.step(0.005);
        window.requestAnimationFrame(renderStep);
    }
    
    renderStep();
}

main()