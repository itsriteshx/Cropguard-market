# Mandi Rate Analytics API

## Overview

The Mandi Rate Analytics API provides aggregated market insights using MandiRate records stored in MongoDB.

Base path: `/api/mandi-rates`

All analytics endpoints support validated filters for commodity, state, district, category, and date range.

## 1. Commodity and District Analytics

**Endpoint:** `GET /analytics`

Provides aggregated commodity price trends and district-level arrival statistics.

### Query parameters

| Parameter | Type | Description |
|---|---|---|
| commodity | String | Filter by commodity |
| state | String | Filter by state |
| district | String | Filter by district |
| category | String | Filter by commodity category |
| from | YYYY-MM-DD | Inclusive start date |
| to | YYYY-MM-DD | Inclusive end date |

### Response

Returns:
- `commodityTrends`: average modal price, observed price spread, total arrivals, and distinct market count.
- `districtArrivals`: total arrivals, distinct commodities, and distinct market count per district.

## 2. Historical Price Trends

**Endpoint:** `GET /analytics/trends`

Groups price observations by date and commodity.

### Query parameters

Uses the same filters as `/analytics`.

### Response fields

- `date`
- `commodity`
- `avgModalPrice`
- `minModalPrice`
- `maxModalPrice`
- `totalArrivals`
- `marketsCount`

Results are sorted chronologically, then by commodity.

## 3. Market Comparison

**Endpoint:** `GET /analytics/markets`

Compares market centers for a selected commodity.

### Query parameters

Uses the same filters as `/analytics`, but `commodity` is required.

### Response fields

- `commodity`
- `state`
- `district`
- `marketCenter`
- `unit`
- `avgModalPrice`
- `minModalPrice`
- `maxModalPrice`
- `totalArrivals`
- `observations`

Markets are grouped by state, district, market center, and unit, then sorted by average modal price in ascending order.

### Example request

`GET /api/mandi-rates/analytics/markets?commodity=ONION`

### Validation

Requests without a commodity return HTTP 400.

## 4. Crop Benchmark Guidance

**Endpoint:** `GET /benchmark`

Returns market price guidance for a market record selected using the geographic matching priority and per-kilogram price conversion for farmer anti-exploitation corridor evaluation. Market selection follows district and state matching with broader geographic fallbacks; it does not calculate physical distance to markets.

### Query parameters

| Parameter | Type | Description |
|---|---|---|
| commodity | String | Commodity name (alias: `cropName`) |
| district | String | Target district |
| state | String | Target state |

Either `commodity` or `cropName` is required. The endpoint uses `commodity` if both are provided.

### Geographic fallback

The endpoint selects a market record using the following geographic matching priority:

1. **Exact district + state:** Match the requested commodity, district, and state.
2. **Same state, any district:** If the exact match is unavailable, search other districts within the supplied state.
3. **Any market globally:** If no state-level match is available, search across all markets for the commodity.

**District-only behavior:** If a district is supplied without a state, the endpoint first searches for that district without a state restriction. If no record is found, it falls back to a global commodity search. The same-state fallback is only performed when both district and state are provided.

**State-only behavior:** If a state is supplied without a district, the endpoint searches for records within that state. If no record is found, it falls back to a global commodity search.

### Response fields

- `commodity`
- `marketCenter`
- `district`
- `state`
- `apmcRates`: `modalPricePerQuintal`, `minPricePerQuintal`, `maxPricePerQuintal`, `unit`, `priceDate`
- `farmerPriceGuidance`: `modalRatePerKg`, `minimumAcceptablePerKg`, `maximumMarketPerKg`, `recommendedAskingPrice`, `antiExploitationNotice`

### Example request

`GET /api/mandi-rates/benchmark?commodity=Tomato&district=Pune&state=Maharashtra`

### Validation

Requests without `commodity` or `cropName` return HTTP 400.
Returns HTTP 404 if no matching records are found.

## Date and Filter Validation

- Text filters are trimmed and normalized to uppercase.
- Dates must use `YYYY-MM-DD`.
- Invalid calendar dates are rejected.
- The `from` date cannot be after the `to` date.
- The `to` date is inclusive.

## Data Notes

The ETL sample CSV contains synthetic demonstration records. Its prices and arrival quantities must not be treated as verified live market data.

Arrival totals represent summed reported observations, not current inventory.

Duplicate grouping in analytical aggregates and diagnostic audits uses UTC calendar days; the unique index uses the complete `priceDate` value.

All prices are stored and returned in the record's declared unit, currently `QUINTAL` for the sample ETL data.
