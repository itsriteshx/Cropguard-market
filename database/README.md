# CropGuard Market — Database Architecture & Schemas

## 1. Database Overview

**Database:** MongoDB Atlas (M0 Free Cluster)
**Region:** Mumbai (`ap-south-1`)  
**ODM:** Mongoose (Node.js)

CropGuard Market uses MongoDB's document-oriented architecture to manage farmer profiles, produce listings, negotiations, orders, mandi market rates, and audit records.

The database contains six main collections.

## 2. Collections Overview

### 2.1 Users (`users`)

Stores user accounts and profile information.

- Name, phone number, email and password
- Roles: `FARMER`, `BUYER_RETAIL`, `BUYER_WHOLESALE`, `ADMIN`
- Language preferences
- GeoJSON location and address information
- Verification status and avatar

**Important constraints:**
- Phone number is unique.
- Email uses a sparse index, not a unique constraint.
- Passwords are hashed using bcrypt before saving.
- Location supports geospatial queries through a `2dsphere` index.

### 2.2 Produce Listings (`producelistings`)

Stores agricultural produce listed by farmers.

- Farmer reference (`farmer`)
- Crop name and category
- Quantity and unit (`KG`, `QUINTAL`, `TON`)
- Price per unit
- Quality grade and harvest date
- Description and image URLs
- Produce location
- Listing status: `AVAILABLE`, `UNDER_NEGOTIATION`, `SOLD`, `EXPIRED`

**Indexes:**
- Geospatial index on `location.coordinates`
- Compound index on `{ category: 1, status: 1 }`
- Compound index on `{ farmer: 1, status: 1 }`
- Text index on `{ cropName: 'text', description: 'text' }`

### 2.3 Negotiations (`negotiations`)

Stores buyer-farmer price negotiation records.

- Listing reference (`listing`)
- Buyer and farmer references
- Negotiated quantity
- Original listing price
- Current offered price
- Current negotiation turn
- Agreed price and total amount
- Optional order reference
- Expiration date

**Negotiation statuses:**
- `OPEN`
- `COUNTER_OFFERED`
- `ACCEPTED`
- `REJECTED`
- `EXPIRED`

**Embedded data:**

`bidHistory` stores the history of offers and counteroffers within the negotiation document.

**Indexes:**
- `{ listing: 1, buyer: 1 }`
- `{ farmer: 1, status: 1 }`
- `{ buyer: 1, status: 1 }`

### 2.4 Orders (`orders`)

Stores transaction and order lifecycle information.

- Unique order number
- Negotiation, listing, buyer and farmer references
- Crop name, quantity and unit
- Unit price and total amount
- Middleman fee saved
- Stock reservation status
- Payment details and delivery address

**Order statuses:**
- `PLACED`
- `ESCROW_HELD`
- `DISPATCHED`
- `DELIVERED`
- `SETTLED`
- `CANCELLED`

**Payment statuses:**
- `PENDING`
- `ESCROW_SECURED`
- `PAID_TO_FARMER`
- `REFUNDED`

**Embedded data:**

`timeline` stores the sequence of order status updates.

**Indexes:**
- `{ buyer: 1, orderStatus: 1 }`
- `{ farmer: 1, orderStatus: 1 }`
- `{ createdAt: -1 }`

### 2.5 Mandi Rates (`mandirates`)

Stores agricultural market benchmark rates.

- Commodity and category
- State and district
- Market center
- Minimum, maximum and modal prices
- Price unit
- Arrival quantity
- Price date

**Indexes:**
- Individual indexes on commodity, state, district and price date
- Compound index on `{ commodity: 1, district: 1, priceDate: -1 }`

Note: Seeded mandi records are demonstration data. They should not be represented as verified live APMC or Agmarknet data.

### 2.6 Audit Logs (`auditlogs`)

Stores records of important system actions for traceability.

- Action and actor reference
- Actor role
- Target entity and target document ID
- Title and description
- Financial snapshot
- Compliance authority
- Verification status
- IP address

**Indexes:**
- `{ targetEntity: 1, targetId: 1 }`
- `{ actor: 1, createdAt: -1 }`
- `{ action: 1, createdAt: -1 }`

`targetId` is polymorphic: `targetEntity` identifies which collection contains the referenced document.

## 3. Indexing Strategy

CropGuard Market uses indexing to improve query performance.

| Collection | Index | Purpose |
|---|---|---|
| User | `phone` unique | Prevent duplicate phone numbers |
| User | `location.coordinates` 2dsphere | Geospatial user queries |
| ProduceListing | `location.coordinates` 2dsphere | Nearby produce discovery |
| ProduceListing | `category + status` | Filter available listings |
| ProduceListing | `farmer + status` | Retrieve farmer listings |
| Negotiation | `listing + buyer` | Find negotiations for a listing and buyer |
| Negotiation | `farmer + status` | Retrieve farmer negotiation records |
| Order | `buyer + orderStatus` | Retrieve buyer orders |
| Order | `farmer + orderStatus` | Retrieve farmer orders |
| MandiRate | `commodity + district + priceDate` | Retrieve district-wise historical prices |
| AuditLog | `targetEntity + targetId` | Retrieve audit history for a target |

## 4. Data Relationships

The database uses Mongoose ObjectId references to connect documents.

See [ER Diagram](./ER_DIAGRAM.md) for the complete entity relationship diagram.

Important design details:

- A user can create multiple produce listings.
- A produce listing can have multiple negotiations.
- Buyers and farmers can participate in multiple negotiations and orders.
- Negotiation bid history and order timelines are embedded subdocuments.
- Mandi rates are stored independently.
- Audit logs use polymorphic target references.

MongoDB references are logical relationships and are not automatically enforced as SQL foreign keys.

## 5. Data Engineering Scope

The Data Engineering track focuses on:

1. Structured storage of mandi market rates.
2. Data ingestion from external or supplied market datasets.
3. Data cleaning and validation.
4. Duplicate detection and prevention.
5. Historical mandi price analytics.
6. Efficient indexing and aggregation pipelines.

Future ingestion pipelines should preserve source information and ingestion timestamps so that data provenance can be tracked.
