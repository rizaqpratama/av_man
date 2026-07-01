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

// Right-clicks the pin on the map and reads coordinates from the context menu.
// The pin lands at the full-viewport center (960, 540) in a 1920x1080 window.
// useFirstResult: if the address didn't auto-resolve to a /place/, click the
// first result in the list. When false, returns null for unresolved searches.
async function extractCoordsFromContextMenu(page, { useFirstResult = false } = {}) {
  // If still on a /search/ URL (not auto-resolved to a /place/)
  if (!page.url().includes('/place/')) {
    if (!useFirstResult) return null;

    const firstResult = page.locator('[role="feed"] a[href*="/maps/place/"], a[href*="/maps/place/"]').first();
    if (await firstResult.count() === 0) return null;

    await firstResult.click();
    await page.waitForFunction(
      () => window.location.href.includes('/place/'),
      { timeout: 10000 }
    ).catch(() => {});
    await page.waitForTimeout(1500);
  }

  // With a 1920x1080 viewport the pin lands at (960, 540) — far from the
  // "Ciutkan panel samping" collapse button at ~(480, 336) and its label.
  await page.mouse.move(960, 540);
  await page.mouse.down({ button: 'right' });
  await page.mouse.up({ button: 'right' });

  // Wait for the context menu to appear
  await page.waitForSelector('[role="menu"]', { timeout: 6000 }).catch(() => {});

  // First menuitemradio always contains "lat, lng"
  const coordText = await page.evaluate(() => {
    return document.querySelector('[role="menuitemradio"]')?.textContent?.trim() ?? '';
  });

  // Dismiss the menu
  await page.keyboard.press('Escape');

  const match = coordText.match(/^(-?\d+\.\d+),\s*(-?\d+\.\d+)$/);
  if (match) return { lat: match[1], lng: match[2] };
  return null;
}

async function main() {
  const useFirstResult = process.argv.includes('--use-first-result');
  if (useFirstResult) console.log('Mode: use first result for unresolved addresses');

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

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  const results = [];

  // Open Google Maps once; subsequent searches reuse the same page via the search box
  await page.goto('https://www.google.com/maps', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('input[name="q"]', { timeout: 10000 });

  let idx = 0;
  for (const [waypointId, address] of waypointMap) {
    idx++;
    console.log(`\n[${idx}/${waypointMap.size}] waypoint_id=${waypointId}`);
    console.log(`  ${address.substring(0, 90)}`);

    try {
      // Type into the search box so Google Maps applies full geocoding normalization
      const searchInput = page.locator('input[name="q"]');
      await searchInput.click({ clickCount: 3 }); // select all existing text
      await searchInput.fill(address);
      await page.keyboard.press('Enter');

      // Wait for map to resolve (coordinates appear in URL)
      await page.waitForFunction(
        () => window.location.href.includes('@'),
        { timeout: 15000 }
      ).catch(() => {});

      // Let the map finish rendering
      await page.waitForTimeout(2000);

      const coords = await extractCoordsFromContextMenu(page, { useFirstResult });
      if (coords) {
        console.log(`  -> lat=${coords.lat}, lng=${coords.lng}`);
        results.push({ waypoint_id: waypointId, latitude: coords.lat, longitude: coords.lng });
      } else {
        console.log(`  -> no coordinates found`);
        results.push({ waypoint_id: waypointId, latitude: '', longitude: '' });
      }
    } catch (err) {
      console.error(`  -> error: ${err.message}`);
      results.push({ waypoint_id: waypointId, latitude: '', longitude: '' });
    }
  }

  await browser.close();

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
