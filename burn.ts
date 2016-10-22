
let getId = function() {
    let id = 0;
    return function getId() {
        return id++;
    }
}();

class Packet {
    id: number;
    destId: number;
    
    constructor(destId: number) {
        this.id = destId;
        this.destId = destId;
    }
}

class Pipe {
    ends: [Hub, Hub];
    inflight: IMap<FlightState>;
    private speed: number;
    
    constructor(a: Hub, b: Hub) {
        this.ends = [a, b];
        this.inflight = {}
        this.speed = 0.001;
    }
    
    receive(p: Packet, senderId: number): void {
        this.inflight[p.id] = new FlightState(p, senderId);
    }
    
    step(dt: number): void {
        let delivered: FlightState[] = [];
        
        for (let key in this.inflight) {
            let status = this.inflight[key];
            status.progress += this.speed*dt;
            
            if (status.progress > 1.0)
                delivered.push(status);
        }
        
        for (let status of delivered) {
            delete this.inflight[status.packet.id];
            
            if (status.senderId === this.ends[0].id)
                this.ends[1].receive(status.packet);
            else
                this.ends[0].receive(status.packet);
        }
    }
}

class FlightState {
    packet: Packet;
    progress: number;
    senderId: number;
    
    constructor(p: Packet, senderId: number) {
        this.packet = p;
        this.senderId = senderId;
        this.progress = 0;
    }
}

interface IMap<T> {
    [K: string]: T;
}

class Hub {
    position: [number, number];
    id: number;
    pipes: Pipe[];
    
    constructor(x: number, y: number) {
        this.position = [x, y]
        this.id = getId();
        this.pipes = [];
    }
    
    receive(p: Packet): void {
        if (p.destId === this.id)
            return;
            
        if (this.pipes.length === 0)
            throw "No pipes";
            
        let rawRandom = Math.random();
        let randIndex = Math.floor(rawRandom*this.pipes.length);
        this.pipes[randIndex].receive(p, this.id);
    }
}

function generateScene(): [Hub[], Pipe[]] {
    let hubs: Hub[] = [];
    for (let i = 0; i < 20; i++) {
        let x = Math.random();
        let y = Math.random();
        hubs.push(new Hub(x,y));
    }
    
    let pipes: Pipe[] = [];
    for (let self of hubs) {
        for (let other of hubs) {
            if (self === other)
                continue;
                
            let bail = false;
            
            for (let existing of self.pipes) {
                if (existing.ends[0].id === other.id || existing.ends[1].id === other.id)
                    bail = true;
            }
            
            if (!bail) {
                let newPipe = new Pipe(self, other);
                pipes.push(newPipe);
                self.pipes.push(newPipe);
                other.pipes.push(newPipe);
            }
        }
    }   
    
    return [hubs, pipes];
}

function render(ctx: CanvasRenderingContext2D, pipes: Pipe[], hubs: Hub[], height: number, width: number): void {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "white";
    for (let p of pipes) {
        let count = 0;
        for (let k in p.inflight)
            count += 1;
            
        if (count !== 0)
            ctx.strokeStyle = "red";
        else
            ctx.strokeStyle = "white";
            
        let [x1, y1] = p.ends[0].position;
        let [x2, y2] = p.ends[1].position;
        ctx.beginPath();
        ctx.moveTo(x1*width, y1*height);
        ctx.lineTo(x2*width, y2*height);
        ctx.stroke();
    }
    
    const hubsize = 5;
    ctx.fillStyle = "green";
    for (let h of hubs) {
        let [x, y] = h.position;
        ctx.fillRect(x*width - (hubsize/2), y*height - (hubsize/2), hubsize, hubsize);
    }
}

function main() {
    let canvas = document.getElementById('canvas') as HTMLCanvasElement;
    let ctx = canvas.getContext('2d');
    
    let height = canvas.height;
    let width = canvas.width;
    
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, width, height);
    
    let [hubs, pipes] = generateScene();
    
    let targetId = hubs[0].id;
    for (let i = 0; i < 50; i++) {
        hubs[2].receive(new Packet(targetId));
    }
    
    let renderStep = function() {
        render(ctx, pipes, hubs, height, width);
        for (let p of pipes)
            p.step(0.001);
        window.requestAnimationFrame(renderStep);
    }
    
    renderStep();
}

main()