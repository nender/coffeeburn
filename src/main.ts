import { App } from "./App";
import { Config } from "./Config";

let config = new Config()
let canvas = document.getElementById('canvas') as HTMLCanvasElement
export let app = new App(canvas, config)