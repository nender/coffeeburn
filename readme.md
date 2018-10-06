# Coffeeburn - a toy transit network simulation in the browser
![alt text](https://raw.githubusercontent.com/nender/coffeeburn/master/demo.gif) 

Coffeeburn (a typescript reimplementation of [chemicalburn](https://github.com/mikeash/ChemicalBurn/)) is a simple non-interactive simulation of a packet transit network. It is built using typescript and HTML canvas. See it in action [here](http://nender.net/coffeeburn). Packets are randomly added to the system and attempt to travel the fastest route possible to their target. Paths between nodes get faster as traffic crosses them, and thus become more popular. The result is a kind of self-organizing network displayed for your viewing pleasure.

## Usage 
Click [here](http://nender.net/coffeeburn) and watch :smile: Try messing around with the parameters in the query string. To run your own instance, see _Installation_. 

## Compatibility 
It should work in most modern browsers!™

## Prerequisites 
For the end user, just a modern-ish web browser. To build you'll need node. I used node 8.11.3, but other versions may work as well.

## Installation 
```
$ npm install
$ npm start
```
`npm start` should run the build and then automatically open the page in a web browser.
 
## Acknowledgements
This whole project is essentially a port of [chemicalburn](https://github.com/mikeash/ChemicalBurn/) by Mike Ash. Originally a screensaver for OS X, it fascinated me when I was younger. I thought reimplimenting it in the browser would be a fun excercise. Thanks Mike for open sourcing your code!
