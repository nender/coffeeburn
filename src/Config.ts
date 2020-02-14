import { Weight } from "./weightFunctions";

export class Config {
    trafficWeight = Weight.linear
    distanceWeight = "square"
    nodeCount = 80
    packetSpawnChance = 1 / 60
    addRemoveNodes = true
    addRemoveChance = 45
    packetOfDeath = true
}