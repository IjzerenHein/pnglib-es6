import tinycolor from 'tinycolor2';
import base64 from 'base64-js';

const HEADER = '\x89PNG\r\n\x1A\n';

/* Create crc32 lookup table */
const _crc32 = new Array();
for (let i = 0; i < 256; i++) {
	let c = i;
	for (let j = 0; j < 8; j++) {
		if (c & 1) {
			c = -306674912 ^ ((c >> 1) & 0x7fffffff);
		} else {
			c = (c >> 1) & 0x7fffffff;
		}
	}
	_crc32[i] = c;
}

// compute crc32 of the PNG chunks
function crc32(buffer, offset, size) {
	let crc = -1;
	for (var i = 4; i < size - 4; i++) {
		crc = _crc32[(crc ^ buffer[offset + i]) & 0xff] ^ ((crc >> 8) & 0x00ffffff);
	}
	write4(buffer, offset + size - 4, crc ^ -1);
}

function write4(buffer, offset, value) {
	buffer[offset++] = (value >> 24) & 255;
	buffer[offset++] = (value >> 16) & 255;
	buffer[offset++] = (value >> 8) & 255;
	buffer[offset++] = value & 255;
	return offset;
}

function write2(buffer, offset, value) {
	buffer[offset++] = (value >> 8) & 255;
	buffer[offset++] = value & 255;
	return offset;
}

function write2lsb(buffer, offset, value) {
	buffer[offset++] = value & 255;
	buffer[offset++] = (value >> 8) & 255;
	return offset;
}

function writeString(buffer, offset, string) {
	for (let i = 0, n = string.length; i < n; i++) {
		buffer[offset++] = string.charCodeAt(i);
	}
	return offset;
}

export default class PNGImage {

	constructor(width, height, depth, backgroundColor = 'transparent') {
		this.width = width;
		this.height = height;
		this.depth = depth;

		// pixel data and row filter identifier size
		this.bit_depth = 8;
		this.pix_format = 3; // indexed
		this.pix_size = height * (width + 1);

		// deflate header, pix_size, block headers, adler32 checksum
		this.data_size = 2 + this.pix_size + 5 * Math.floor((0xfffe + this.pix_size) / 0xffff) + 4;

		// offsets and sizes of Png chunks
		this.ihdr_offs = 0;                                 // IHDR offset and size
		this.ihdr_size = 4 + 4 + 13 + 4;
		this.plte_offs = this.ihdr_offs + this.ihdr_size;   // PLTE offset and size
		this.plte_size = 4 + 4 + 3 * depth + 4;
		this.trns_offs = this.plte_offs + this.plte_size;   // tRNS offset and size
		this.trns_size = 4 + 4 + depth + 4;
		this.idat_offs = this.trns_offs + this.trns_size;   // IDAT offset and size
		this.idat_size = 4 + 4 + this.data_size + 4;
		this.iend_offs = this.idat_offs + this.idat_size;   // IEND offset and size
		this.iend_size = 4 + 4 + 4;
		this.buffer_size  = this.iend_offs + this.iend_size;    // total PNG size

		// allocate buffers
		const rawBuffer = new ArrayBuffer(HEADER.length + this.buffer_size);
		writeString(new Uint8Array(rawBuffer), 0, HEADER);
		const buffer = new Uint8Array(rawBuffer, HEADER.length, this.buffer_size);
		this.buffer = buffer;
		this.palette = new Object();
		this.pindex = 0;

		// initialize non-zero elements
		let off = write4(buffer, this.ihdr_offs, this.ihdr_size - 12);
		off = writeString(buffer, off, 'IHDR');
		off = write4(buffer, off, width);
		off = write4(buffer, off, height);
		buffer[off++] = this.bit_depth;
		buffer[off++] = this.pix_format;
		off = write4(buffer, this.plte_offs, this.plte_size - 12);
		writeString(buffer, off, 'PLTE');
		off = write4(buffer, this.trns_offs, this.trns_size - 12);
		writeString(buffer, off, 'tRNS');
		off = write4(buffer, this.idat_offs, this.idat_size - 12);
		writeString(buffer, off, 'IDAT');
		off = write4(buffer, this.iend_offs, this.iend_size - 12);
		writeString(buffer, off, 'IEND')

		// initialize deflate header
		let header = ((8 + (7 << 4)) << 8) | (3 << 6);
		header += 31 - (header % 31);
		write2(buffer, this.idat_offs + 8, header);

		// initialize deflate block headers
		for (let i = 0; (i << 16) - 1 < this.pix_size; i++) {
			let size, bits;
			if (i + 0xffff < this.pix_size) {
				size = 0xffff;
				bits = 0;
			} else {
				size = this.pix_size - (i << 16) - i;
				bits = 1;
			}
			let off = this.idat_offs + 8 + 2 + (i << 16) + (i << 2);
			buffer[off++] = bits;
			off = write2lsb(buffer, off, size);
			write2lsb(buffer, off, ~size);
		}

		this.backgroundColor = this.createColor(backgroundColor);
	}

	index(x, y) {
		const i = y * (this.width + 1) + x + 1;
		return this.idat_offs + 8 + 2 + 5 * Math.floor((i / 0xffff) + 1) + i;
	}

	color(red, green, blue, alpha) {

		alpha = alpha >= 0 ? alpha : 255;
		const color = (((((alpha << 8) | red) << 8) | green) << 8) | blue;

		if (this.palette[color] === undefined) {
			if (this.pindex == this.depth) return 0;

			const ndx = this.plte_offs + 8 + 3 * this.pindex;

			this.buffer[ndx + 0] = red;
			this.buffer[ndx + 1] = green;
			this.buffer[ndx + 2] = blue;
			this.buffer[this.trns_offs + 8 + this.pindex] = alpha;

			this.palette[color] = this.pindex++;
		}
		return this.palette[color];
	}

	getBase64() {
		this.deflate();
		return base64.fromByteArray(new Uint8Array(this.buffer.buffer));
	}

	deflate() {
		const {width, height, buffer} = this;

		// compute adler32 of output pixels + row filter bytes
		const BASE = 65521; // largest prime smaller than 65536
		const NMAX = 5552;  // NMAX is the largest n such that 255n(n+1)/2 + (n+1)(BASE-1) <= 2^32-1
		let s1 = 1;
		let s2 = 0;
		let n = NMAX;

		const baseOffset = this.idat_offs + 8 + 2 + 5;
		for (let y = 0; y < height; y++) {
			for (let x = -1; x < width; x++) {
				const i = y * (width + 1) + x + 1;
				s1 += buffer[baseOffset * Math.floor((i / 0xffff) + 1) + i];
				s2 += s1;
				if ((n-= 1) == 0) {
					s1 %= BASE;
					s2 %= BASE;
					n = NMAX;
				}
			}
		}
		s1 %= BASE;
		s2 %= BASE;
		write4(buffer, this.idat_offs + this.idat_size - 8, (s2 << 16) | s1);

		crc32(buffer, this.ihdr_offs, this.ihdr_size);
		crc32(buffer, this.plte_offs, this.plte_size);
		crc32(buffer, this.trns_offs, this.trns_size);
		crc32(buffer, this.idat_offs, this.idat_size);
		crc32(buffer, this.iend_offs, this.iend_size);
	}

	getDataURL() {
		return 'data:image/png;base64,' + this.getBase64();
	}

	createColor(color) {
		color = tinycolor(color);
		const rgb = color.toRgb();
		return this.color(rgb.r, rgb.g, rgb.b, Math.round(rgb.a * 255));
	}

	setPixel(x, y, color) {
		const i = y * (this.width + 1) + x + 1;
		this.buffer[this.idat_offs + 8 + 2 + 5 * Math.floor((i / 0xffff) + 1) + i] = color;
	}

	getPixel(x, y) {
		const i = y * (this.width + 1) + x + 1;
		return this.buffer[this.idat_offs + 8 + 2 + 5 * Math.floor((i / 0xffff) + 1) + i];
	}
}
