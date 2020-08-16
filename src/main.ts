import { App } from "./App"
import { Config } from "./Config"
import { Renderer } from "./Renderer"

let config = new Config()
let canvas = document.getElementById('canvas') as HTMLCanvasElement
canvas.height = window.innerHeight
canvas.width = window.innerWidth
export let app = new App(canvas, config)

let renderer = new Renderer(canvas)

let renderAndStep = () => {
    renderer.render(app.scene)
    app.step()
    window.requestAnimationFrame(renderAndStep)
}

window.requestAnimationFrame(renderAndStep)