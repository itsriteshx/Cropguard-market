# MandiRate ETL Pipeline

## 1. Overview

The MandiRate ETL pipeline imports agricultural market price records from CSV files into the CropGuard Market MongoDB database.

ETL stands for:

- **Extract:** Read records from a CSV file.
- **Transform:** Clean, normalize, and validate the extracted records.
- **Load:** Insert new records or update existing records in MongoDB.

The pipeline uses Node.js, `csv-parser`, Mongoose, and MongoDB Atlas.

## 2. Architecture

```text
CSV File
   |
   v
EXTRACT
Read CSV records using csv-parser
   |
   v
TRANSFORM
Clean and normalize fields
Validate categories, prices, units and dates
   |
   +------ Invalid records --> Rejection report
   |
   v
LOAD
Connect to MongoDB Atlas
   |
   v
Bulk upsert using Mongoose
   |
   v
MandiRate Collection
```

## 3. Project Structure

```text
backend/
├── data/
│   └── mandi_rates_sample.csv
│
└── scripts/
    └── mandiETL/
        ├── extract.js
        ├── transform.js
        ├── load.js
        ├── testTransform.js
        ├── checkDuplicates.js
        └── README.md
```

## 4. CSV Input Format

The CSV file must contain these columns:

| Field | Description |
|---|---|
| commodity | Crop or commodity name |
| category | Commodity category |
| state | State name |
| district | District name |
| marketCenter | APMC market center |
| minPrice | Minimum price |
| maxPrice | Maximum price |
| modalPrice | Modal market price |
| unit | Price unit |
| arrivalQuantity | Quantity arriving at the market |
| priceDate | Market price date in YYYY-MM-DD format |

**Important:** `mandi_rates_sample.csv` currently contains synthetic test records. These are used to test the ETL pipeline and are not verified live mandi prices.

## 5. Transformation and Validation Rules

Before loading, records undergo the following checks:

1. Required string fields are trimmed and normalized.
2. Commodity, category, state, and district values are converted to uppercase.
3. Category must match the MandiRate schema's supported categories.
4. Minimum, maximum, and modal prices must be non-negative.
5. Minimum price must not exceed maximum price.
6. Modal price must fall between minimum and maximum prices.
7. Arrival quantity must be non-negative.
8. Unit must be `QUINTAL`.
9. Date must be a valid calendar date in `YYYY-MM-DD` format.

Invalid records are rejected with their CSV row number and rejection reason. Valid records continue to the loading stage.

## 6. Duplicate Prevention

The pipeline uses a compound natural key to identify a market price record:

- Commodity
- State
- District
- Market center
- Unit
- Price date

A unique compound MongoDB index named `uniq_mandi_rate_per_market_date` enforces this constraint at the database level.

The loader uses MongoDB `bulkWrite()` with `updateOne` and `upsert: true`.

This means:
- A new market record is inserted if no matching record exists.
- An existing record is updated if the natural key matches.
- Re-importing the same CSV does not create duplicate documents.

The price date is normalized to UTC midnight to ensure consistent date matching.

## 7. Running the Pipeline

Run these commands from the `backend/` directory.

### Extract CSV records

```bash
node scripts/mandiETL/extract.js
```

### Run transformation tests

```bash
node scripts/mandiETL/testTransform.js
```

### Execute the complete ETL pipeline

```bash
node scripts/mandiETL/load.js
```

### Audit duplicate records

```bash
node scripts/mandiETL/checkDuplicates.js
```

The duplicate audit checks for duplicate natural keys and records whose dates are not normalized to UTC midnight.

## 8. Environment Configuration

The backend requires a valid MongoDB connection string in `backend/.env`.

```env
MONGO_URI=your_mongodb_connection_string
```

Never commit `.env` files or expose database credentials.

## 9. Test Results

The current implementation has passed:

- 12 existing backend tests.
- 6 ETL transformation tests.
- Extraction of 8 synthetic CSV records.
- Validation of all 8 records.
- Successful MongoDB loading.
- Repeat-import verification without duplicate insertion.
- Duplicate audit with zero duplicate groups.
- UTC date normalization audit with zero invalid records.

## 10. Limitations and Future Improvements

- Replace synthetic CSV records with verified market data from an authorized source.
- Add support for scheduled imports.
- Add import history and detailed rejection reports.
- Improve loading efficiency for larger datasets.
- Support additional price units only after updating downstream price calculations.
