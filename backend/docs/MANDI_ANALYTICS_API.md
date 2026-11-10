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

## Date and Filter Validation

- Text filters are trimmed and normalized to uppercase.
- Dates must use `YYYY-MM-DD`.
- Invalid calendar dates are rejected.
- The `from` date cannot be after the `to` date.
- The `to` date is inclusive.

## Data Notes

The ETL sample CSV contains synthetic demonstration records. Its prices and arrival quantities must not be treated as verified live market data.

Arrival totals represent summed reported observations, not current inventory.

All prices are stored and returned in the record's declared unit, currently `QUINTAL` for the sample ETL data.