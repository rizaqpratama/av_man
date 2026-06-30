// scrape_maps_latlong.mjs
// Reads 50orderrs.csv, searches each unique waypoint address on Google Maps,
// extracts lat/long from the map URL, and writes waypoint_latlong.csv

import { chromium } from '@playwright/test';
import fs from 'fs';

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCSV(content) {
  const lines = content.replace(/\r\n/g, '\n').trim().split('\n');
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const values = parseCSVLine(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = values[i] ?? ''; });
    return obj;
  });
}

async function extractCoordsFromUrl(page) {
  const url = page.url();
  const match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (match) return { lat: match[1], lng: match[2] };
  return null;
}

async function main() {
  const csvContent = fs.readFileSync('addresses.csv', 'utf-8');
  const records = parseCSV(csvContent);

  // Deduplicate by waypoint_id — keep first occurrence
  const waypointMap = new Map();
  for (const r of records) {
    if (!waypointMap.has(r.waypoint_id)) {
      waypointMap.set(r.waypoint_id, r.full_address);
    }
  }

  console.log(`Unique waypoints: ${waypointMap.size}`);

  const CHROMIUM_PATH = 'C:\\Users\\Rizaq\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe';
  const browser = await chromium.launch({
    headless: false,
    executablePath: CHROMIUM_PATH,
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  const results = [];

  let idx = 0;
  for (const [waypointId, address] of waypointMap) {
    idx++;
    console.log(`\n[${idx}/${waypointMap.size}] waypoint_id=${waypointId}`);
    console.log(`  ${address.substring(0, 90)}`);

    try {
      const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(address)}`;
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });

      // Wait until the URL contains coordinates (@lat,lng)
      await page.waitForFunction(
        () => window.location.href.includes('@'),
        { timeout: 12000 }
      ).catch(() => {});

      // Extra wait for the map to settle
      await page.waitForTimeout(1500);

      const coords = await extractCoordsFromUrl(page);
      if (coords) {
        console.log(`  -> lat=${coords.lat}, lng=${coords.lng}`);
        results.push({ waypoint_id: waypointId, latitude: coords.lat, longitude: coords.lng });
      } else {
        console.log(`  -> no coordinates found in URL`);
        results.push({ waypoint_id: waypointId, latitude: '', longitude: '' });
      }
    } catch (err) {
      console.error(`  -> error: ${err.message}`);
      results.push({ waypoint_id: waypointId, latitude: '', longitude: '' });
    }
  }

  await browser.close();

  // Write output CSV
  const outputLines = ['waypoint_id,latitude,longitude'];
  for (const r of results) {
    outputLines.push(`${r.waypoint_id},${r.latitude},${r.longitude}`);
  }
  fs.writeFileSync('waypoint_latlong.csv', outputLines.join('\n'), 'utf-8');
  console.log('\nDone! Saved to waypoint_latlong.csv');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
