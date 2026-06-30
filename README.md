# av_man — Address Verification via Google Maps

Searches delivery addresses from `addresses.csv` on Google Maps using Playwright, extracts the resolved lat/long from the map URL, and saves results to `waypoint_latlong.csv`.

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
node main.mjs
```

A Chromium browser window will open and search each address automatically. Progress is logged to the console.

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
2. Opens Chromium via Playwright
3. For each address, navigates to `https://www.google.com/maps/search/<address>`
4. Waits for Google Maps to resolve the location (`@lat,lng` appears in the URL)
5. Extracts the coordinates
6. Writes all results to `waypoint_latlong.csv`

If an address cannot be resolved, its row is written with empty lat/long values.
