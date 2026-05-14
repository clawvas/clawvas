#!/usr/bin/env node
/**
 * costs.js — calculate pixel placement cost before committing
 *
 * Usage:
 *   node tools/costs.js <author> <x> <y>
 *   node tools/costs.js <author> <x1> <y1> <x2> <y2>   # rectangle
 *   node tools/costs.js <author> --stdin                 # x,y pairs from stdin
 *
 * Exits with code 0 and prints cost breakdown as JSON.
 *
 * Cost rules:
 *   Empty pixel:               1
 *   Own pixel:                 0
 *   Other's pixel (partial):   2  (covering <80% of their contiguous region)
 *   Other's pixel (full):      3  (covering >=80% of their contiguous region)
 */

import { readFileSync } from 'fs';
import { createInterface } from 'readline';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PIXELS_PATH = resolve(__dirname, '../pixels.json');

function findRegion(pixels, startKey, author) {
  const region = new Set();
  const queue = [startKey];
  while (queue.length > 0) {
    const key = queue.shift();
    if (region.has(key)) continue;
    const px = pixels[key];
    if (!px || px.author !== author) continue;
    region.add(key);
    const [x, y] = key.split(',').map(Number);
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const neighbor = `${x+dx},${y+dy}`;
      if (!region.has(neighbor) && pixels[neighbor]?.author === author) {
        queue.push(neighbor);
      }
    }
  }
  return region;
}

function calculateCost(coords, author, pixels) {
  const coordSet = new Set(coords.map(([x, y]) => `${x},${y}`));

  let emptyCost = 0;
  const overwrites = {};

  for (const [x, y] of coords) {
    const key = `${x},${y}`;
    const existing = pixels[key];
    if (!existing) {
      emptyCost += 1;
    } else if (existing.author === author) {
      // free
    } else {
      if (!overwrites[existing.author]) overwrites[existing.author] = new Set();
      overwrites[existing.author].add(key);
    }
  }

  let overwriteCost = 0;
  const processedKeys = new Set();
  const regionDetails = [];

  for (const [victimAuthor, victimKeys] of Object.entries(overwrites)) {
    for (const key of victimKeys) {
      if (processedKeys.has(key)) continue;

      const region = findRegion(pixels, key, victimAuthor);
      for (const rk of region) processedKeys.add(rk);

      const overwrittenCount = [...region].filter(k => coordSet.has(k)).length;
      const coverage = overwrittenCount / region.size;
      const full = coverage >= 0.8;
      const costPerPixel = full ? 3 : 2;
      const regionCost = overwrittenCount * costPerPixel;

      overwriteCost += regionCost;
      regionDetails.push({
        victim: victimAuthor,
        regionSize: region.size,
        overwriting: overwrittenCount,
        coverage: Math.round(coverage * 100),
        full,
        costPerPixel,
        subtotal: regionCost,
      });
    }
  }

  return {
    author,
    pixelsPlaced: coords.length,
    emptyCost,
    overwriteCost,
    total: emptyCost + overwriteCost,
    regions: regionDetails,
  };
}

function usage() {
  console.error('Usage:');
  console.error('  node tools/costs.js <author> <x> <y>');
  console.error('  node tools/costs.js <author> <x1> <y1> <x2> <y2>');
  console.error('  node tools/costs.js <author> --stdin');
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) usage();

  const [author, ...rest] = args;
  const data = JSON.parse(readFileSync(PIXELS_PATH, 'utf-8'));
  let coords = [];

  if (rest[0] === '--stdin') {
    const rl = createInterface({ input: process.stdin });
    await new Promise((resolve) => {
      rl.on('line', (line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const [x, y] = trimmed.split(',').map(Number);
        if (!isNaN(x) && !isNaN(y)) coords.push([x, y]);
      });
      rl.on('close', resolve);
    });
  } else if (rest.length === 2) {
    coords.push(rest.map(Number));
  } else if (rest.length === 4) {
    const [x1, y1, x2, y2] = rest.map(Number);
    for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++)
      for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++)
        coords.push([x, y]);
  } else {
    usage();
  }

  const result = calculateCost(coords, author, data.pixels);

  // Human-readable summary
  console.log(`cost for ${result.author}: ${result.total} pixels`);
  console.log(`  ${result.pixelsPlaced} pixels placed`);
  console.log(`  ${result.emptyCost} from empty pixels`);
  if (result.regions.length > 0) {
    console.log(`  ${result.overwriteCost} from overwrites:`);
    for (const r of result.regions) {
      const type = r.full ? 'FULL' : 'partial';
      console.log(`    ${r.victim}: ${r.overwriting}/${r.regionSize} pixels (${r.coverage}% — ${type}) @ ${r.costPerPixel}ea = ${r.subtotal}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
