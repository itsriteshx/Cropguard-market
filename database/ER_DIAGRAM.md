# CropGuard Market — Entity Relationship Diagram

## 1. Overview

CropGuard Market uses MongoDB with Mongoose for data storage.

The database contains six main collections:

- User
- ProduceListing
- Negotiation
- Order
- MandiRate
- AuditLog

The relationships shown below represent logical references between MongoDB documents. Unlike a relational SQL database, MongoDB does not automatically enforce foreign-key constraints.

## 2. ER Diagram

```mermaid
erDiagram
    USER {
        ObjectId _id PK
        string name
        string phone UK
        string email
        string password
        string role
        string languagePreference
        object location
        boolean isVerified
        string avatar
    }

    PRODUCE_LISTING {
        ObjectId _id PK
        ObjectId farmer FK
        string cropName
        string category
        number quantity
        string unit
        number pricePerUnit
        string qualityGrade
        date harvestDate
        string description
        array images
        object location
        string status
    }

    NEGOTIATION {
        ObjectId _id PK
        ObjectId listing FK
        ObjectId buyer FK
        ObjectId farmer FK
        number quantity
        number originalListingPrice
        number currentOfferedPrice
        string currentTurn
        string status
        ObjectId order FK
        number agreedPrice
        number agreedTotalAmount
        array bidHistory
        date expiresAt
    }

    ORDER {
        ObjectId _id PK
        string orderNumber UK
        ObjectId negotiation FK
        ObjectId listing FK
        ObjectId buyer FK
        ObjectId farmer FK
        string cropName
        number quantity
        string unit
        number unitPrice
        number totalAmount
        number middlemanFeeSaved
        boolean stockReserved
        string orderStatus
        string paymentStatus
        object paymentDetails
        object deliveryAddress
        array timeline
    }

    MANDI_RATE {
        ObjectId _id PK
        string commodity
        string category
        string state
        string district
        string marketCenter
        number minPrice
        number maxPrice
        number modalPrice
        string unit
        number arrivalQuantity
        date priceDate
    }

    AUDIT_LOG {
        ObjectId _id PK
        string action
        ObjectId actor FK
        string actorRole
        string targetEntity
        ObjectId targetId
        string title
        string description
        object financialSnapshot
        string complianceAuthority
        boolean isVerified
        string ipAddress
    }

    USER ||--o{ PRODUCE_LISTING : "creates as farmer"
    USER ||--o{ NEGOTIATION : "participates as buyer"
    USER ||--o{ NEGOTIATION : "participates as farmer"
    PRODUCE_LISTING ||--o{ NEGOTIATION : "has negotiations"

    USER ||--o{ ORDER : "places as buyer"
    USER ||--o{ ORDER : "receives as farmer"
    PRODUCE_LISTING ||--o{ ORDER : "is purchased through"

    USER ||--o{ AUDIT_LOG : "performs actions"
```

## 3. Relationship Explanation

| Relationship | Cardinality | Explanation |
|---|---|---|
| User → ProduceListing | One-to-many | A farmer can create multiple listings. |
| User → Negotiation (buyer) | One-to-many | A buyer can participate in multiple negotiations. |
| User → Negotiation (farmer) | One-to-many | A farmer can receive multiple negotiations. |
| ProduceListing → Negotiation | One-to-many | A listing can have multiple negotiations. |
| User → Order (buyer) | One-to-many | A buyer can place multiple orders. |
| User → Order (farmer) | One-to-many | A farmer can receive multiple orders. |
| ProduceListing → Order | One-to-many | A listing can be associated with multiple orders. |
| User → AuditLog | One-to-many | A user can generate multiple audit logs. |

## 4. Important Database Design Notes

### Embedded documents

- `Negotiation.bidHistory` stores offers and counteroffers.
- `Order.timeline` stores order status updates.

These are embedded subdocuments, not separate collections.

### Negotiation and Order

Both models contain optional references to each other:

- `Negotiation.order`
- `Order.negotiation`

These references do not establish a database-enforced one-to-one relationship.

### AuditLog polymorphic reference

`AuditLog.targetId` identifies the affected document. `targetEntity` indicates its collection.

This is a polymorphic reference, not a conventional foreign key.

### MandiRate

`MandiRate` stores market-price information independently and has no direct reference to the other five collections.

## 5. Database Technology

| Property | Implementation |
|---|---|
| Database | MongoDB |
| ODM | Mongoose |
| Data model | Document-oriented |
| Primary identifier | ObjectId (`_id`) |
| Relationships | Mongoose references |
| Embedded data | Bid history and order timeline |
| Geospatial support | GeoJSON and 2dsphere indexes |