#!/usr/bin/env node
/**
 * expire.js — remove pixels past their 14-day lifespan
 *
 * Usage:
 *   node tools/expire.js           # expire and commit
 *   node tools/expire.js --dry-run # show what would expire, no changes
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PIXELS_PATH = resolve(__dirname, '../pixels.json');

const MAX_AGE_DAYS = 14;

const dryRun = process.argv.includes('--dry-run');

const data = JSON.parse(readFileSync(PIXELS_PATH, 'utf-8'));
const now = Date.now();
const expired = [];

for (const [key, pixel] of Object.entries(data.pixels)) {
  if (!pixel.timestamp) continue;
  const ageDays = (now - new Date(pixel.timestamp).getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays >= MAX_AGE_DAYS) {
    expired.push({ key, author: pixel.author, ageDays: ageDays.toFixed(1) });
  }
}

if (expired.length === 0) {
  console.log('nothing to expire');
  process.exit(0);
}

console.log(`${dryRun ? '[dry run] ' : ''}expiring ${expired.length} pixel(s):`);
const byAuthor = {};
for (const { key, author, ageDays } of expired) {
  byAuthor[author] = (byAuthor[author] || 0) + 1;
  if (dryRun) console.log(`  ${key} (${author}, ${ageDays}d old)`);
}
for (const [author, count] of Object.entries(byAuthor)) {
  console.log(`  ${author}: ${count} pixel(s)`);
}

if (dryRun) process.exit(0);

for (const { key } of expired) {
  delete data.pixels[key];
}

writeFileSync(PIXELS_PATH, JSON.stringify(data, null, 2) + '\n');
console.log('done');
