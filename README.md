# av_man — Address Verification via Google Maps

Searches delivery addresses from `addresses.csv` on Google Maps using Playwright, extracts the resolved lat/long via the map's right-click context menu, and saves results to `waypoint_latlong.csv`.

## Prerequisites

- Node.js v18+

## Setup

```bash
npm install
```

> If `npm install` fails with an SSL certificate error, run:
> ```bash
> npm set strict-ssl false
> npm install
> ```

## Usage

```bash
node main.mjs [--use-first-result]
```

A Chromium browser window will open and type each address into the Google Maps search box automatically. Progress is logged to the console.

### Flags

| Flag | Description |
|---|---|
| `--use-first-result` | When an address doesn't auto-resolve to a specific place, click the first result from the search list and use its pin coordinates. Without this flag, unresolved addresses are written with empty lat/long. |

## Input

**`addresses.csv`** — required columns:

| Column | Description |
|---|---|
| `waypoint_id` | Unique delivery stop ID |
| `full_address` | Full address string to search on Google Maps |

Rows are deduplicated by `waypoint_id` before searching.

## Output

**`waypoint_latlong.csv`**

```
waypoint_id,latitude,longitude
4288735256,-6.2581885,106.4065187
4288735257,-6.3272512,106.900447
...
```

## How it works

1. Reads `addresses.csv` and builds a unique `waypoint_id → full_address` map
2. Opens Chromium via Playwright (1920×1080 viewport)
3. Navigates to `https://www.google.com/maps` once
4. For each address, types it into the search box and presses Enter — this applies Google Maps' full geocoding normalization
5. Waits for the map to resolve the location
6. If the address auto-resolves to a specific place, right-clicks the pin and reads the coordinates from the context menu
7. If the address only resolves to a search results list and `--use-first-result` is set, clicks the first result then reads its pin coordinates; otherwise records empty lat/long
8. Writes all results to `waypoint_latlong.csv`
