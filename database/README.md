# 🗄️ Database Architecture & Schemas (DE Track)

**Database Engine:** MongoDB Atlas (M0 Free Cloud Cluster)  
**Region:** Mumbai (`ap-south-1`)  
**ORM / ODM:** Mongoose (Node.js)

---

## 📂 Collections Overview

1. **`users`**
   - User profiles, phone numbers, roles (`FARMER`, `BUYER_RETAIL`, `BUYER_WHOLESALE`, `ADMIN`), language preferences (`kn`, `hi`, `en`), farm location coordinates.
2. **`producelistings`**
   - Farmer produce catalog: crop name, category, quantity (Kg/Quintal), expected base price, harvest date, Cloudinary image URLs, 2dsphere location index for hyper-local nearby discovery.
3. **`negotiations`**
   - Real-time bidding session history between buyer and farmer: offer price, counter-offer price, status (`OPEN`, `AGREED`, `REJECTED`), socket session IDs.
4. **`orders`**
   - Transaction lifecycle records: buyer ID, farmer ID, listing ID, locked price, total amount, escrow payment status, delivery status.
5. **`mandirates`**
   - APMC Agmarknet benchmark rates per district and commodity to prevent farmer distress selling.

---

## ⚡ Indexing Strategy
- **Geospatial Index:** `producelistings.location: "2dsphere"` for `$geoNear` radius queries (e.g. within 25 km of buyer).
- **Compound Index:** `negotiations: { listingId: 1, buyerId: 1 }` for sub-second socket lookup.
- **Unique Indexes:** `users.phone: 1`, `users.email: 1`.
