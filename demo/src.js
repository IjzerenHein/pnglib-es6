import 'file?name=index.html!./index.html';
import PNGImage from '../src/pnglib-es6';

console.time('Create image');
const image = new PNGImage(300, 300, 4, 'transparent');

// Add colors to the palette (uses tinycolor for converting the color)
const redColor = image.createColor('#FF0000');
const blueColor = image.createColor('blue');
const greenColor = image.createColor('rgba(0, 255, 0, 1)');
console.timeEnd('Create image');

console.time('Draw to image');
// Draw red line
for (let i = 0; i < 290; i++) {
	image.setPixel(i, i, redColor);
	image.setPixel(i + 1, i, redColor);
	image.setPixel(i + 2, i, redColor);
}

// Draw blue line
for (let i = 0; i < 145; i++) {
	image.setPixel(i, i + 150, blueColor);
	image.setPixel(i + 1, i + 150, blueColor);
	image.setPixel(i + 2, i + 150, blueColor);
}

// Draw green line
for (let i = 0; i < 145; i++) {
	image.setPixel(i + 150, i, greenColor);
	image.setPixel(i + 1 + 150, i, greenColor);
	image.setPixel(i + 2 + 150, i, greenColor);
}
console.timeEnd('Draw to image');

// Or get the data-url which can be passed directly to an <Img>
console.time('Base64 encode to data-url');
const dataUri = image.getDataURL(); // data:image/png;base64,...
console.timeEnd('Base64 encode to data-url');

document.getElementById('img').src = dataUri;
