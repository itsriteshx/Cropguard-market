# CropGuard Market — Data Engineering Architecture & Technical Reference

## 1. Overview & Objective

The Data Engineering track in CropGuard Market establishes a resilient data pipeline and analytics layer for agricultural market benchmark data (Mandi rates).

The primary objectives are:
- Ingesting, cleaning, and validating market price observations from CSV datasets.
- Storing normalized observations in MongoDB with idempotent upserts and a unique compound index for duplicate prevention. The ETL loader retries connection attempts when MongoDB is unavailable in development; in production, the shared database helper exits the process on connection failure.
- Serving analytical aggregates for price distribution, district arrival depth, historical trends, and inter-mandi comparisons.
- Powering the frontend Mandi Intelligence Dashboard to provide farmers and wholesale buyers with market transparency.

---

## 2. System Architecture

```text
+-------------------------------------------------------------+
|                      DATA INGESTION                         |
|                                                             |
|   CSV Source Dataset                                        |
|   (backend/data/mandi_rates_sample.csv)                     |
|           |                                                 |
|           v (extract.js - csv-parser streaming)             |
|   Raw Ingestion Records                                     |
|           |                                                 |
|           v (transform.js - normalization & rejection gate) |
|   +-----------------------+------------------------+        |
|   | Valid Clean Records   | Rejected Bad Records   |        |
|   +-----------------------+------------------------+        |
|           |                           |                     |
|           |                           v                     |
|           |                   Rejection Audit Log           |
+-----------|-------------------------------------------------+
            |
            v (load.js - Mongoose bulkWrite with upsert)
+-------------------------------------------------------------+
|                      DATABASE LAYER                         |
|                                                             |
|   MongoDB Collection: `mandirates`                          |
|   Natural Key:                                              |
|   { commodity, state, district, marketCenter,               |
|     unit, priceDate }                                       |
|                                                             |
|   Schema-declared indexes (DB creation not verified):                                              |
|   - uniq_mandi_rate_per_market_date (unique compound)       |
|   - commodity_1_district_1_priceDate_-1 (compound query)    |
|   - Single-field indexes: commodity, state, district, date  |
+-------------------------------------------------------------+
            |
            v (mandiController.js - Aggregation Pipelines)
+-------------------------------------------------------------+
|                      ANALYTICS APIs                         |
|                                                             |
|   GET /api/mandi-rates/analytics                            |
|   GET /api/mandi-rates/analytics/trends                     |
|   GET /api/mandi-rates/analytics/markets                    |
|   GET /api/mandi-rates/benchmark                            |
|   GET /api/mandi-rates                                      |
+-------------------------------------------------------------+
            |
            v (Axios Service Layer - api.js)
+-------------------------------------------------------------+
|                      WEB DASHBOARD                          |
|                                                             |
|   Frontend Web (React 19 + Vite + Recharts)                 |
|   MandiAnalyticsPage.jsx                                    |
|   - KPI Cards (Arrivals, Mandis, Commodities, Districts)    |
|   - Price Spread Chart (Min / Modal / Max)                  |
|   - Historical Price Trend Chart (Area series)              |
|   - District-wise Arrival Depth Chart (Bar series)          |
|   - Market Center Comparison Cards                          |
|   - Illustrative Farmer Offer Corridor Simulator            |
+-------------------------------------------------------------+
```

---

## 3. Database Model & Indexes

### Schema: `MandiRate` (`backend/src/models/MandiRate.js`)

| Field | Type | Required | Constraints / Default | Description |
|---|---|---|---|---|
| `commodity` | String | Yes | Trimmed, Uppercase, Indexed | Crop or produce name (e.g., `TOMATO`, `ONION`) |
| `category` | String | Yes | Enum: `VEGETABLES`, `GRAINS`, `PULSES`, `FRUITS`, `OILSEEDS`, `SPICES`, `FIBRES` | Commodity category |
| `state` | String | Yes | Trimmed, Uppercase, Indexed | State (e.g., `MAHARASHTRA`, `KARNATAKA`) |
| `district` | String | Yes | Trimmed, Uppercase, Indexed | District (e.g., `PUNE`, `NASHIK`, `DHARWAD`) |
| `marketCenter` | String | Yes | Trimmed | APMC mandi yard (e.g., `Pune APMC`) |
| `minPrice` | Number | Yes | Min: 0 | Minimum recorded market price per unit |
| `maxPrice` | Number | Yes | Min: 0 | Maximum recorded market price per unit |
| `modalPrice` | Number | Yes | Min: 0 | Most frequent / modal price per unit |
| `unit` | String | No | Optional, default: `QUINTAL` | Measurement unit (standard APMC unit = 100 kg) |
| `arrivalQuantity` | Number | No | Default: 0, Min: 0 | Volume arriving at mandi (in Quintals) |
| `priceDate` | Date | No (Schema) / Yes (ETL) | Mongoose schema defines a default of current UTC midnight (`now.getUTCFullYear()`, `now.getUTCMonth()`, `now.getUTCDate()`) and a setter normalizing to UTC midnight; this default applies at the Mongoose document creation layer, not as an ETL transform fallback. In the ETL pipeline, `priceDate` is required for a valid transformed record; missing, empty, malformed, and invalid calendar dates are rejected. Indexed | Date of price observation |
| `createdAt` | Date | Auto | Timestamps enabled | Document creation timestamp |
| `updatedAt` | Date | Auto | Timestamps enabled | Document update timestamp |

### Indexes

1. **Natural Key Unique Index (`uniq_mandi_rate_per_market_date`):**
   ```javascript
   {
     commodity: 1,
     state: 1,
     district: 1,
     marketCenter: 1,
     unit: 1,
     priceDate: 1
   }
   ```
   Enforces uniqueness for the combination of commodity, state, district, market center, unit, and price date when this index has been successfully created in the MongoDB database. The schema declares this index, but its creation in the target database must be verified separately.

2. **Query Optimization Index:**
   ```javascript
   { commodity: 1, district: 1, priceDate: -1 }
   ```
   Optimizes lookups for latest district-level commodity rates.

3. **Single-Field Indexes:**
   `commodity: 1`, `state: 1`, `district: 1`, `priceDate: 1`.

---

## 4. ETL Pipeline Workflow

The ETL pipeline resides in `backend/scripts/mandiETL/`:

```text
backend/scripts/mandiETL/
├── extract.js          # Reads and extracts CSV records using a streaming pipeline
├── transform.js        # Validates, normalizes, and partitions records into valid/rejected sets (in-memory; no DB writes)
├── load.js             # Handles database persistence via Mongoose bulkWrite with idempotent upserts
├── checkDuplicates.js  # Read-only diagnostic audit of natural-key duplicate groups (by UTC day) and index inspection
├── testTransform.js    # Unit test harness verifying transformation and validation rules
└── README.md           # Pipeline execution and operating manual
```

> [!IMPORTANT]
> **Stage Responsibility Separation:** Running `transform.js` executes extraction, sanitization, and validation in memory, printing diagnostic summaries. Running `transform.js` alone does **NOT** insert, update, or write records to MongoDB. Database persistence is exclusively performed by `load.js`.

### 4.1 CSV Input Specification & Supported Headers

Path: `backend/data/mandi_rates_sample.csv`

Format:
```csv
commodity,category,state,district,marketCenter,minPrice,maxPrice,modalPrice,unit,arrivalQuantity,priceDate
Tomato,VEGETABLES,Maharashtra,Pune,Pune APMC,1800,2400,2100,QUINTAL,120,2026-11-08
```

**Supported Header Aliases:** `transform.js` extracts row values using its `getField(row, ...keys)` helper, which looks for specific exact key aliases per field rather than performing arbitrary case-insensitive matching. The supported header aliases are:
- **`commodity`:** `'commodity'`, `'Commodity'`, `'cropName'`, `'CropName'`
- **`category`:** `'category'`, `'Category'`
- **`state`:** `'state'`, `'State'`
- **`district`:** `'district'`, `'District'`
- **`marketCenter`:** `'marketCenter'`, `'MarketCenter'`, `'market'`, `'Market'`
- **`minPrice`:** `'minPrice'`, `'MinPrice'`, `'min_price'`
- **`maxPrice`:** `'maxPrice'`, `'MaxPrice'`, `'max_price'`
- **`modalPrice`:** `'modalPrice'`, `'ModalPrice'`, `'modal_price'`
- **`arrivalQuantity`:** `'arrivalQuantity'`, `'ArrivalQuantity'`, `'arrivals'`, `'Arrivals'`
- **`unit`:** `'unit'`, `'Unit'`
- **`priceDate`:** `'priceDate'`, `'PriceDate'`, `'arrivalDate'`, `'ArrivalDate'`

### 4.2 Transformation & Validation Rules (`transform.js`)

Each row undergoes strict field-level validation before loading:

1. **Required vs. Optional Fields:**
   - **Required:** `commodity`, `category`, `state`, `district`, `marketCenter`, `minPrice`, `maxPrice`, `modalPrice`. Missing required fields trigger row rejection.
   - **Optional:**
     - `arrivalQuantity`: Defaults to `0` if blank, empty string, `null`, or omitted. Negative numbers are rejected.
     - `unit`: Defaults to `QUINTAL`. Non-quintal units are rejected.
   - **Required:**
     - `priceDate`: Must be provided in `YYYY-MM-DD` format for a valid ETL-transformed record. Missing, empty, malformed, and invalid calendar dates (such as `2026-02-30`) are rejected. Valid dates are normalized to UTC midnight (`00:00:00.000Z`). The Mongoose schema has a separate default for documents created without a date; the ETL transformation does not use that default.
2. **Text Normalization:** `commodity`, `category`, `state`, and `district` are trimmed and converted to uppercase.
3. **Category Validation:** Must match the approved enum list: `['VEGETABLES', 'GRAINS', 'PULSES', 'FRUITS', 'OILSEEDS', 'SPICES', 'FIBRES']`.
4. **Numeric Price Validation:**
   - `minPrice`, `maxPrice`, and `modalPrice` must be valid, finite numbers.
   - Prices cannot be negative (`price >= 0`).
   - `minPrice <= maxPrice` is strictly enforced; inverted prices are rejected.
   - `modalPrice` must fall within the range `[minPrice, maxPrice]`.
5. **Arrival Volume Validation:**
   - Must be non-negative (`arrivalQuantity >= 0`).
   - Blank, null, or omitted values safely default to `0`.
6. **Unit Verification:**
   - Pipeline strictly accepts `QUINTAL` (100 kg APMC standard). Non-quintal units are rejected.
7. **Date Validation:**
   - Must strictly match `YYYY-MM-DD` regex.
   - Rejects non-existent calendar dates (e.g., `2026-02-30`).
   - Normalized to UTC midnight (`00:00:00.000Z`).

**Rejection Diagnostics & Immutability:**
Rejected rows are separated from the valid set and captured with diagnostic metadata:
- `rowNumber`: 1-indexed source row number.
- `reason`: Specific descriptive failure message.
- `originalData`: Unaltered original record.
Source input rows are never mutated during transformation.

### 4.3 Duplicate Prevention Strategy (`load.js`)

The pipeline implements idempotent loading using MongoDB `bulkWrite`:

```javascript
const operations = records.map((record) => ({
  updateOne: {
    filter: {
      commodity: record.commodity,
      state: record.state,
      district: record.district,
      marketCenter: record.marketCenter,
      unit: record.unit,
      priceDate: record.priceDate
    },
    update: { $set: record },
    upsert: true
  }
}));
```

- If a record with the same natural key exists, its fields are updated (`matchedCount` / `modifiedCount`).
- If no matching record exists, it is inserted (`upsertedCount`).
- Re-running the pipeline with identical input uses the same natural-key filters and updates matching records rather than intentionally inserting duplicate observations. Database-level uniqueness enforcement depends on successful creation of the declared unique index.

### 4.4 Read-Only Duplicate & Index Diagnostics (`checkDuplicates.js`)

`checkDuplicates.js` performs read-only diagnostic audits without modifying the database:
- **Duplicate Aggregation:** Groups records by natural key using UTC calendar days (`$dateToString: '%Y-%m-%d'`). Note that duplicate aggregation groups by UTC calendar days, whereas the unique index evaluates the complete `priceDate` timestamp value.
- **Timestamp Integrity:** Audits all records to confirm that `priceDate` timestamps are normalized to UTC midnight.
- **Index Inspection:** Reads existing collection indexes using `collection.indexes()`. It verifies whether `uniq_mandi_rate_per_market_date` is present and matches the expected compound natural key and `unique: true` constraint.
- **Read-Only Operation:** It does **not** call `createIndex()`, `dropIndex()`, or any other database-mutating operation. Actual unique-index creation is a separate database deployment operation (e.g., via DBA migration or deployment pipeline).

---

## 5. Analytics API Specifications

Base route: `/api/mandi-rates`

### 5.1 Overview Analytics (`GET /api/mandi-rates/analytics`)

Calculates commodity-level price distributions and district arrival depth across all observations matching optional query filters.

**Supported Query Filters:**
- `commodity` (string, case-insensitive)
- `category` (string, enum)
- `state` (string)
- `district` (string)
- `from` (`YYYY-MM-DD`, inclusive start date)
- `to` (`YYYY-MM-DD`, inclusive end date)

**Response Structure (HTTP 200):**
```json
{
  "success": true,
  "corridor": "UASD Dharwad - North Karnataka & Maharashtra Corridor",
  "commodityTrends": [
    {
      "commodity": "ONION",
      "category": "VEGETABLES",
      "avgModalPrice": 2425,
      "minObserved": 2000,
      "maxObserved": 2800,
      "priceSpread": 800,
      "totalArrivals": 850,
      "marketsCount": 2
    }
  ],
  "districtArrivals": [
    {
      "district": "PUNE",
      "totalArrivals": 980,
      "commoditiesCount": 5,
      "mandiCount": 1
    }
  ]
}
```

### 5.2 Historical Price Trends (`GET /api/mandi-rates/analytics/trends`)

Groups price observations by date and commodity, ordered chronologically.

**Response Structure (HTTP 200):**
```json
{
  "success": true,
  "trends": [
    {
      "date": "2026-11-08T00:00:00.000Z",
      "commodity": "ONION",
      "avgModalPrice": 2425,
      "minModalPrice": 2350,
      "maxModalPrice": 2500,
      "totalArrivals": 850,
      "marketsCount": 2
    }
  ]
}
```

### 5.3 Market-Center Comparison (`GET /api/mandi-rates/analytics/markets`)

Compares modal prices and arrival volume across distinct mandi yards for a selected crop.

**Requirements:**
- `commodity` query parameter is **required**. Returns HTTP 400 if missing or blank.

**Response Structure (HTTP 200):**
```json
{
  "success": true,
  "commodity": "ONION",
  "markets": [
    {
      "state": "MAHARASHTRA",
      "district": "NASHIK",
      "marketCenter": "Lasalgaon APMC",
      "unit": "QUINTAL",
      "avgModalPrice": 2350,
      "minModalPrice": 2350,
      "maxModalPrice": 2350,
      "totalArrivals": 500,
      "observations": 1
    },
    {
      "state": "MAHARASHTRA",
      "district": "PUNE",
      "marketCenter": "Pune APMC",
      "unit": "QUINTAL",
      "avgModalPrice": 2500,
      "minModalPrice": 2500,
      "maxModalPrice": 2500,
      "totalArrivals": 350,
      "observations": 1
    }
  ]
}
```

### 5.4 Crop Benchmark Guidance (`GET /api/mandi-rates/benchmark`)

Returns market price guidance for a market record selected using the geographic matching priority and per-kilogram price conversion for farmer anti-exploitation corridors. Market selection follows administrative district and state hierarchy rather than calculating physical distance to markets.

**Supported Query Parameters:**
- `commodity` (string) — Commodity name (alias: `cropName`). If both are provided, `commodity` takes precedence.
- `district` (string, optional) — Target district.
- `state` (string, optional) — Target state.

**Geographic Fallback Hierarchy:**
1. **Exact district + state:** Matches the specified commodity, district, and state.
2. **Same state, any district:** If an exact district match is not found and both district and state were supplied, falls back to other markets within the specified state.
3. **Any market globally:** If no match is found within the state (or if neither district nor state matched), falls back to any market globally for that commodity.

**District-Only & State-Only Handling:**
- When `district` is provided without `state`, the endpoint searches for that district across all states; if not found, it falls back to a global commodity search. The same-state fallback only executes when both district and state are specified.
- When `state` is provided without `district`, the endpoint searches for records in that state; if not found, it falls back to a global commodity search.

**Response Structure (HTTP 200):**
Includes commodity identity, market location (`marketCenter`, `district`, `state`), `apmcRates` (`modalPricePerQuintal`, `minPricePerQuintal`, `maxPricePerQuintal`, `unit`, `priceDate`), and `farmerPriceGuidance`:
- `modalRatePerKg`: modal price converted to per-kg rate.
- `minimumAcceptablePerKg`: min price converted to per-kg floor.
- `maximumMarketPerKg`: max price converted to per-kg ceiling.
- `recommendedAskingPrice`: suggested baseline asking rate.
- `antiExploitationNotice`: advisory message warning against bids below minimum acceptable rate.

**Validation:**
- Returns HTTP 400 if neither `commodity` nor `cropName` is supplied.
- Returns HTTP 404 if no benchmark records exist for the commodity.

---

## 6. Frontend Dashboard Integration

Located at `frontend/web/src/pages/MandiAnalyticsPage.jsx`:
- **Resilient Data Loading:** Utilizes `Promise.allSettled()` across all 4 analytical requests (`getRates`, `getAnalytics`, `getPriceTrends`, `getMarketComparison`), ensuring partial outages display informative notices rather than breaking the UI.
- **Dynamic Crop Switching:** Crop selector automatically extracts monitored commodities from loaded data and queries market comparisons dynamically.
- **Empty & Error State Safety:** Charts and tables render clean explanatory fallbacks when no records match a filter, preventing `NaN`, `undefined`, or `₹null` visual defects.
- **Illustrative Simulator:** Interactive farmer offer evaluation compares simulated offers against a 90% corridor threshold, clearly designated as illustrative.

---

## 7. Operating Instructions

### 7.1 Running the Backend

```bash
cd backend
npm install
npm run dev
```

### 7.2 Running the Frontend Web Dashboard

```bash
cd frontend/web
npm install
npm run dev
```

### 7.3 Executing Tests

```bash
# Run backend analytical & unit test suite
cd backend
node --test test/mandi-analytics.test.js

# Run all backend unit tests
npm test

# Run ETL transformation unit test harness
node scripts/mandiETL/testTransform.js

# Build frontend production bundle
cd ../frontend/web
npm run build
```

### 7.4 Running the ETL Pipeline Safely

The ETL scripts reside under `backend/scripts/mandiETL/`. Execute them from the `backend/` directory so that environment variables (`backend/.env`) and relative paths are resolved consistently:

```bash
cd backend

# Step 1: Extract CSV records
# Reads and parses backend/data/mandi_rates_sample.csv via csv-parser stream without database access.
node scripts/mandiETL/extract.js

# Step 2: Validate & transform records in-memory
# Runs normalization, category validation, price boundary checks, and rejection logging in memory.
# NOTE: Running transform.js alone does NOT insert, update, or write records to MongoDB.
node scripts/mandiETL/transform.js

# Step 3: Run transformation test harness
# Executes the 24 automated unit tests for validation rules, headers, boundaries, and rejections.
node scripts/mandiETL/testTransform.js

# Step 4: Load validated records into MongoDB (Database write)
# Performs idempotent upserts using Mongoose bulkWrite on natural keys.
# Requires a running MongoDB instance and valid MONGO_URI in backend/.env.
node scripts/mandiETL/load.js

# Step 5: Read-only duplicate audit & index inspection
# Runs read-only diagnostics: inspects existing index configuration and aggregates duplicate observations (by UTC day).
# NOTE: checkDuplicates.js does NOT create or mutate indexes. Index creation is a separate database deployment operation.
node scripts/mandiETL/checkDuplicates.js
```

---

## 8. Known Limitations & Production Roadmap

1. **Batch CSV Ingestion:** The current ETL pipeline processes flat CSV files in batch mode. Future releases should integrate event-driven ingestion (e.g., Apache Kafka or AWS SQS) or automated Agmarknet API scrapers.
2. **Historical Depth:** The demonstration dataset spans limited days for North Karnataka and Maharashtra corridors. Production deployment requires ingestion of multi-year historical series for predictive seasonal forecasting.
3. **Data Provenance:** Future schema revisions should include `sourceSystem` (e.g., Agmarknet, eNAM) and `ingestionBatchId` for compliance tracking.

---

## 9. Synthetic Data Disclaimer

All data currently contained in `backend/data/mandi_rates_sample.csv` and seeded into local demonstration environments consists of **synthetic test records**.

- **Not Official Government Data:** These records must never be represented as live Agmarknet feeds, official APMC statutory gazettes, or verified real-time mandi prices.
- **Illustrative Use Only:** Thresholds calculated in the farmer offer simulator are demonstration rules and do not constitute legal Minimum Support Prices (MSP) or statutory arbitration decisions.
