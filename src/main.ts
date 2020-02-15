import { App } from "./App";
import { Config } from "./Config";

let config = new Config()
let canvas = document.getElementById('canvas') as HTMLCanvasElement
canvas.height = window.innerHeight
canvas.width = window.innerWidth
export let app = new App(canvas, config)

let renderAndStep = () => {
    app.render()
    app.step()
    window.requestAnimationFrame(renderAndStep)
}

window.requestAnimationFrame(renderAndStep)