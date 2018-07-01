# Coffeeburn - a toy packet router in the browser 
![alt text](https://raw.githubusercontent.com/nender/coffeeburn/master/demo.gif) 

Simple simulation and visualization of packet routing in the browser, built using typescript and HTML canvas. Demo [here](http://nender.net/coffeeburn). Packets are randomly added to the system and travel the fastest route to their target. Paths between nodes get faster as traffic crosses them, and thus become more popular. The result is a beautiful self-organizing network colorfully displayed on your screen.

## Usage 
Click [here](http://nender.net/coffeeburn) and watch :) Try messing around with the parameters in the query string. To run your own instance, see _Installation_. 

## Compatibility 
It should work in most modern browsers!™

## Prerequisites 
For the end user, just a modern-ish web browser. To build you'll need node, typescript, and webpack.

## Installation 
Clone the repository and run ```npm install```. Compile the javascript with ```webpack```, and viola! The contents of /dist will contain the compiled javascript. 
 
## Acknowledgements
This whole project is essentially a port of [chemicalburn](https://github.com/mikeash/ChemicalBurn/) by Mike Ash. Originally a screensaver for OS X, it fascinated me when I was younger. I thought reimplimenting it in the browser would be a fun excercise. Thanks Mike for open sourcing your code!