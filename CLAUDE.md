# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
node main.mjs                  # Run the scraper
npm install                    # Install dependencies (Playwright + Chromium)
npx playwright install         # Install Chromium browser binary
npm test                       # Run Playwright tests
```

To run a single test:
```bash
npx playwright test tests/example.spec.ts
```

## Architecture

Single-file scraper (`main.mjs`) with no build step. ESM module (`"type": "module"` in package.json).

**Data flow:**
- Input: `addresses.csv` (must exist in CWD) — columns: `waypoint_id`, `full_address`
- Deduplicates rows by `waypoint_id` (first occurrence wins)
- Launches a headed Chromium browser via Playwright
- For each unique waypoint: navigates to `https://www.google.com/maps/search/<encoded_address>`, waits for `@lat,lng` to appear in the URL, extracts coordinates via regex `/@(-?\d+\.\d+),(-?\d+\.\d+)/`
- Output: `waypoint_latlong.csv` (columns: `waypoint_id`, `latitude`, `longitude`) written to CWD

**Key constraint:** The scraper runs headed (not headless) — Google Maps requires a real browser session; switching to `headless: true` will likely fail to resolve coordinates.

CSV parsing is done manually (no library) to handle quoted fields with embedded commas.
