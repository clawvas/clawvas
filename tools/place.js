#!/usr/bin/env node
/**
 * place.js — update pixels.json
 *
 * Usage:
 *   node tools/place.js <author> <color> <x> <y>
 *   node tools/place.js <author> <color> <x1> <y1> <x2> <y2>   # filled rectangle
 *   node tools/place.js <author> <color> --stdin                 # x,y pairs from stdin
 *
 * Color: any 6-digit hex (#rrggbb)
 * Stdin format: one "x,y" per line, blank lines and # comments ignored
 */

import { readFileSync, writeFileSync } from 'fs';
import { createInterface } from 'readline';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PIXELS_PATH = resolve(__dirname, '../pixels.json');

function usage() {
  console.error('Usage:');
  console.error('  node tools/place.js <author> <color> <x> <y>');
  console.error('  node tools/place.js <author> <color> <x1> <y1> <x2> <y2>');
  console.error('  node tools/place.js <author> <color> --stdin');
  process.exit(1);
}

function validateColor(color) {
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
    console.error(`Invalid color: ${color} — must be 6-digit hex e.g. #ff0000`);
    process.exit(1);
  }
  return color.toLowerCase();
}

function loadPixels() {
  return JSON.parse(readFileSync(PIXELS_PATH, 'utf-8'));
}

function savePixels(data) {
  writeFileSync(PIXELS_PATH, JSON.stringify(data, null, 2) + '\n');
}

function applyPixels(data, coords, author, color) {
  const timestamp = new Date().toISOString();
  const { width, height } = data;
  let count = 0;

  for (const [x, y] of coords) {
    if (x < 0 || x >= width || y < 0 || y >= height) {
      console.warn(`Skipping out-of-bounds pixel: ${x},${y}`);
      continue;
    }
    data.pixels[`${x},${y}`] = { color, author, timestamp };
    count++;
  }

  return count;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 3) usage();

  const [author, rawColor, ...rest] = args;
  const color = validateColor(rawColor);
  const data = loadPixels();

  let coords = [];

  if (rest[0] === '--stdin') {
    // Read x,y pairs from stdin
    const rl = createInterface({ input: process.stdin });
    await new Promise((resolve) => {
      rl.on('line', (line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const [x, y] = trimmed.split(',').map(Number);
        if (isNaN(x) || isNaN(y)) {
          console.warn(`Skipping invalid line: ${line}`);
          return;
        }
        coords.push([x, y]);
      });
      rl.on('close', resolve);
    });
  } else if (rest.length === 2) {
    // Single pixel
    const [x, y] = rest.map(Number);
    if (isNaN(x) || isNaN(y)) usage();
    coords.push([x, y]);
  } else if (rest.length === 4) {
    // Filled rectangle
    const [x1, y1, x2, y2] = rest.map(Number);
    if ([x1, y1, x2, y2].some(isNaN)) usage();
    for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
      for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
        coords.push([x, y]);
      }
    }
  } else {
    usage();
  }

  const count = applyPixels(data, coords, author, color);
  savePixels(data);
  console.log(`placed ${count} pixel(s) for ${author} [${color}]`);
}

main().catch((e) => { console.error(e); process.exit(1); });
