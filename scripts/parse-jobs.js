#!/usr/bin/env node
/**
 * parse-jobs.js
 * Extracts job definitions from the STFX data snapshot into src/data/jobs.json
 *
 * Source: scripts/raw/stfx-data.json (jobs object keyed by ID string)
 * Output: src/data/jobs.json (array of job objects)
 *
 * Usage: node scripts/parse-jobs.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const rawPath = path.resolve(__dirname, 'raw', 'stfx-data.json');
const outPath = path.resolve(__dirname, '..', 'src', 'data', 'jobs.json');

if (!fs.existsSync(rawPath)) {
  console.error(`Error: raw data file not found at ${rawPath}`);
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));

// Rename 'shipops' → 'shipOps' to match the app's convention for ship skills
function normalizeSkillName(name) {
  if (name === 'shipops') return 'shipOps';
  return name;
}

const jobs = Object.values(raw.jobs)
  .map(j => ({
    id: j._id,
    name: j.name,
    skills: j.skills.map(normalizeSkillName),
    levels: j.levels,
  }))
  .sort((a, b) => a.id - b.id);

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(jobs, null, 2));
console.log(`Wrote ${jobs.length} jobs → ${path.relative(process.cwd(), outPath)}`);
