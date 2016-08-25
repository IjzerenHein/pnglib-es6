# pnglib-es6

Modern & fast version of the original javascript pnglib library.

This version uses typed-arrays and is roughly 3-4 x as fast as the original library.

# [View Demo Here](https://rawgit.com/IjzerenHein/pnglib-es6/master/demo/index.html)

# Install

	npm install pnglib-es6

# Usage

```javascript
import PNGImage from 'pnglib-es6';

// Create new PNG image, parameters (only indexed 8-bit pngs are supported at the moment):
// width (number)
// height (number)
// depth (number of palette entries)
// [backgroundColor] (optional background color, when omitted 'transparent' is used)
const image = new PNGImage(100, 100, 8);

// Add colors to the palette (uses tinycolor for converting the color)
const redColor = image.createColor('#FF0000');
const blueColor = image.createColor('blue');
const greenColor = image.createColor('rgba(0, 255, 0, 1)');

// Do some pixel drawing
image.setPixel(50, 50, redColor);
...

// Convert image to base-64
const base64 = image.getBase64();

// Or get the data-url which can be passed directly to an <img src>
const dataUri = image.getDataURL(); // data:image/png;base64,...
```
