import { Hub } from "./Hub";
import { Packet } from "./Packet";
import { weight, Weight } from "./weightFunctions";
import { globalConfig } from "./App";

export class Pipe {
    readonly ends: [Hub, Hub];
    readonly inflight: Set<Packet>;
    _weight: number;
    _length: number;

    constructor(a: Hub, b: Hub) {
        this.ends = [a, b];
        this._weight = 1;
        this.inflight = new Set();
        
        let dx = Math.abs(a.position[0] - b.position[0]);
        let dy = Math.abs(a.position[1] - b.position[1]);
        this._length = this.weightLength(dx**2+dy**2, globalConfig.distanceWeight);
    }

    weightLength(l: number, mode: string): number {
        switch (mode) {
            case "linear":
                return Math.sqrt(l);
            case "sqrt":
                return l ** 0.25 * 5;
            case "square":
                return l / 25;
            case "exp":
                // yes this seems nuts, I'm just copying reference implementation for now
                return Math.min(1e6, Math.exp(Math.sqrt(l) / 10) / 3);
            case "log":
                return Math.max(1, (Math.log(l) / 2 + 1) * 25);
            default:
                throw Error("Invalid mode");
        }
    }
    
    incrementWeight(): void {
        if (this.ends[0].isDead || this.ends[1].isDead)
            return;

        this._weight += 1;
    }
    
    decrementWeight() : void {
        // this formula stolen verbatim from chemicalburn,
        this._weight = ((this._weight - 1) * 0.99) + 1;
    }

    traffic(): number {
        let w = this._weight;
        return weight({ value: w, mode: Weight.linear });
    }

    distance(): number {
        return this._length;
    }
    
    cost(): number {
        if (this.ends[0].isDead || this.ends[1].isDead)
            return Number.MAX_VALUE;
        else
            return this.distance() / this.traffic();
    }
    
    receive(p: Packet, destination: Hub): void {
        if (!(destination === this.ends[0] || destination === this.ends[1]))
            throw "Requested destination not available";
            
        p.TAToB = destination === this.ends[1];
        p.TProgress = 0;
        this.inflight.add(p);
        this.incrementWeight();
    }

    step(): void {
        const delivered: Set<Packet> = new Set();
        // loop through all the inflight packets, updating their status and making note
        // of those which are complete;
        for (let packet of this.inflight) {
            const newProgress = packet.TProgress + packet.speed * this.traffic() / this.distance();
            
            if (newProgress < 1)
                packet.TProgress = newProgress;
            else
                delivered.add(packet);
        }
        
        for (let packet of delivered) {
            this.inflight.delete(packet);
            if (packet.TAToB)
                this.ends[1].receive(packet);
            else
                this.ends[0].receive(packet);
        }
        
        this.decrementWeight();
    }
}
