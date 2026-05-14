#!/usr/bin/env node
/**
 * budget.js — read and update round budgets
 *
 * Usage:
 *   node tools/budget.js show                        # show all balances
 *   node tools/budget.js show <author>               # show one author's balance
 *   node tools/budget.js spend <author> <amount>     # deduct pixels from balance
 *   node tools/budget.js reset                       # issue new round allocations
 *
 * Budget file: budget.json
 * {
 *   "round": 4,
 *   "balances": { "nic": 200, "jack": 150 },
 *   "isAgent": ["claude"]
 * }
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUDGET_PATH = resolve(__dirname, '../budget.json');
const PIXELS_PATH = resolve(__dirname, '../pixels.json');

const BASE_HUMAN = 200;
const BASE_AGENT = 100;
const BONUS_RATE = 0.25;
const BONUS_CAP = 100;

function loadBudget() {
  if (!existsSync(BUDGET_PATH)) {
    return { round: 0, balances: {}, isAgent: ['claude'] };
  }
  return JSON.parse(readFileSync(BUDGET_PATH, 'utf-8'));
}

function saveBudget(data) {
  writeFileSync(BUDGET_PATH, JSON.stringify(data, null, 2) + '\n');
}

function loadPixels() {
  return JSON.parse(readFileSync(PIXELS_PATH, 'utf-8'));
}

function countPixelsByAuthor(pixels) {
  const counts = {};
  for (const px of Object.values(pixels)) {
    counts[px.author] = (counts[px.author] || 0) + 1;
  }
  return counts;
}

function calcAllocation(author, pixelCount, isAgent) {
  const base = isAgent ? BASE_AGENT : BASE_HUMAN;
  const bonus = Math.min(Math.floor(pixelCount * BONUS_RATE), BONUS_CAP);
  return base + bonus;
}

const [,, cmd, ...args] = process.argv;

if (cmd === 'show') {
  const budget = loadBudget();
  const author = args[0];

  if (author) {
    const balance = budget.balances[author] ?? '(no balance — not in this round yet)';
    console.log(`${author}: ${balance}`);
  } else {
    if (Object.keys(budget.balances).length === 0) {
      console.log('No balances yet — run reset to start a round.');
    } else {
      console.log(`Round ${budget.round}`);
      for (const [a, b] of Object.entries(budget.balances)) {
        console.log(`  ${a.padEnd(12)} ${b}`);
      }
    }
  }

} else if (cmd === 'spend') {
  const [author, amountStr] = args;
  const amount = parseInt(amountStr, 10);

  if (!author || isNaN(amount) || amount <= 0) {
    console.error('Usage: budget.js spend <author> <amount>');
    process.exit(1);
  }

  const budget = loadBudget();

  if (!(author in budget.balances)) {
    console.error(`Unknown author: ${author}. Run reset first.`);
    process.exit(1);
  }

  if (budget.balances[author] < amount) {
    console.error(`Insufficient budget: ${author} has ${budget.balances[author]}, needs ${amount}`);
    process.exit(1);
  }

  budget.balances[author] -= amount;
  saveBudget(budget);
  console.log(`${author} spent ${amount} — ${budget.balances[author]} remaining`);

} else if (cmd === 'reset') {
  const budget = loadBudget();
  const pixels = loadPixels();
  const pixelCounts = countPixelsByAuthor(pixels.pixels);

  // Carry over known authors, add any new ones from pixels
  const allAuthors = new Set([
    ...Object.keys(budget.balances),
    ...Object.keys(pixelCounts),
  ]);

  budget.round += 1;
  budget.balances = {};

  for (const author of allAuthors) {
    const isAgent = (budget.isAgent || []).includes(author);
    const owned = pixelCounts[author] || 0;
    budget.balances[author] = calcAllocation(author, owned, isAgent);
  }

  saveBudget(budget);

  console.log(`Round ${budget.round} allocations:`);
  for (const [a, b] of Object.entries(budget.balances)) {
    const owned = pixelCounts[a] || 0;
    const base = (budget.isAgent || []).includes(a) ? BASE_AGENT : BASE_HUMAN;
    const bonus = b - base;
    console.log(`  ${a.padEnd(12)} ${b}  (${base} base + ${bonus} territory)`);
  }

} else {
  console.error('Usage: budget.js show [author] | spend <author> <amount> | reset');
  process.exit(1);
}
