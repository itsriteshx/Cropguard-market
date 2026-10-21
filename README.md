# 🌾 CropGuard Market — Direct Market Access Platform for Farmers

[![Node.js](https://img.shields.io/badge/Node.js-v20+-green.svg?logo=node.js)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-v4+-black.svg?logo=express)](https://expressjs.com/)
[![React Native](https://img.shields.io/badge/React_Native-Expo-blue.svg?logo=react)](https://reactnative.dev/)
[![React](https://img.shields.io/badge/React-Vite-61DAFB.svg?logo=react)](https://react.dev/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248.svg?logo=mongodb)](https://www.mongodb.com/)
[![Socket.io](https://img.shields.io/badge/Socket.io-Real--Time-010101.svg?logo=socket.io)](https://socket.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC.svg?logo=tailwind-css)](https://tailwindcss.com/)

> **Empowering farmers through direct market linkages, live APMC price intelligence, real-time bargaining, and transparent digital transactions — eliminating middlemen exploitation.**

---

## 📌 Problem Statement Overview

* **Title:** Mobile App for Direct Market Access for Farmers
* **Sponsoring Body:** Ministry of Agriculture and Farmers Welfare, Govt. of India
* **Department:** University of Agricultural Sciences, Dharwad (UASD) & The Indian Council of Agricultural Research (ICAR)
* **Domain:** Agriculture, FoodTech & Rural Development
* **Category:** Software / Mobile & Distributed Web System
* **Shared Repository:** [github.com/Itsriteshx/Cropguard-market](https://github.com/Itsriteshx/Cropguard-market)

### The Challenge
Indian farmers frequently face extreme barriers accessing open consumer and retail markets. Traditional agricultural supply chains rely heavily on multiple layers of intermediaries (commission agents and middlemen), leading to price distortion where farmers receive only 20–30% of final consumer prices. Furthermore, lack of real-time mandi rate visibility forces farmers into distress sales.

### The Solution: CropGuard Market
A dual-platform digital marketplace connecting farmers directly with local consumers, retail shops, and bulk institutional buyers. The platform features an interactive real-time price negotiation engine, live APMC mandi price benchmarks, multilingual voice-assisted mobile workflows, and secure order lifecycle tracking.

---

## 👥 Team & Individual Evaluation Tracks

| Team Role | Track | Tech Stack | Core Responsibilities & Viva Domain |
|:---|:---|:---|:---|
| **Backend & Systems Lead** | `Track: ISD` | Node.js, Express.js, Socket.io, Mongoose, JWT, Cloudinary | • Modular RESTful API Design & Server Architecture<br>• Real-time WebSocket Negotiation Engine<br>• JWT Authentication & Role-Based Access Control (RBAC)<br>• Order State Machine & Transaction Ledger Backend |
| **Mobile Experience Lead** | `Track: ASD` | React Native (Expo), NativeWind (Tailwind), Vector Icons | • Farmer-Centric Mobile App (High-contrast, simple UX)<br>• 3-Step Camera Produce Listing & Media upload<br>• Real-Time Interactive Bidding Screen on Mobile<br>• Multilingual Localization (Kannada, Hindi, English) |
| **Web Portal & Data Lead** | `Track: DE / Web` | React.js (Vite), Tailwind CSS, MongoDB Aggregations | • Bulk Wholesaler Procurement Web Portal<br>• UASD & ICAR Market Oversight Analytics Dashboard<br>• APMC Mandi Rate Benchmark pipeline & seed scripts<br>• Geospatial search queries & database indexing |

---

## 🏛️ System Architecture

```text
                                  +-------------------------------------------------+
                                  |                 CLIENT INTERFACES               |
                                  |                                                 |
                                  |  [Farmer & Retail Mobile App]    [Wholesale Web] |
                                  |      (React Native / Expo)      (React.js / Vite)|
                                  +-----------------------+-------------------------+
                                                          |
                                         HTTPS (REST)     |     WSS (Socket.io)
                                                          v
                                  +-------------------------------------------------+
                                  |           CROPGUARD API GATEWAY                 |
                                  |         (Node.js / Express Server)              |
                                  +-----------------------+-------------------------+
                                                          |
                      +-------------------+---------------+-------------------+
                      |                   |                                   |
                      v                   v                                   v
             [ Auth & RBAC ]    [ Produce Engine ]                [ Negotiation Room ]
             JWT & Role Guards  CRUD & GeoNear Search             Real-time Bidding (WSS)
                      |                   |                                   |
                      +-------------------+---------------+-------------------+
                                                          |
                                                          v
                                  +-------------------------------------------------+
                                  |                DATABASE & STORAGE               |
                                  |  • MongoDB Atlas (Geospatial & Timeseries)      |
                                  |  • Cloudinary (Produce Imagery CDN)             |
                                  +-------------------------------------------------+
```

---

## ✨ Key Platform Features

### 1. 🌾 Farmer-Friendly Produce Listing
* **Effortless 3-Step Flow:** Crop category, estimated harvest weight (Quintals/Kg), expected base rate, and farm location.
* **Visual Quality Showcase:** High-resolution produce photography uploaded directly via mobile camera to Cloudinary.
* **Geospatial Discovery:** Automatically tags listings with GPS coordinates and pincode for hyper-local buyer discovery.

### 2. 🤝 Real-Time Price Negotiation Engine (WebSocket)
* **Interactive Bidding Room:** Buyers can submit purchase bids; farmers receive instant push alerts without page refresh.
* **Counter-Offer Negotiation:** Farmers can instantly counter-offer (e.g., Buyer offers ₹24/kg ➔ Farmer counters at ₹27/kg).
* **Deal Finalization:** Once agreed, the negotiated price is locked into a legally binding digital contract.

### 3. 📊 APMC Mandi Price Benchmark (Anti-Exploitation)
* Displays live benchmark rates from local APMC Agricultural Markets (Agmarknet data standard).
* Provides farmers with an automated fair-price corridor so they are never forced to accept below-market offers.

### 4. 📦 Order State Machine & Digital Ledger
* End-to-end transparent order tracking:
  $$\text{Draft} \longrightarrow \text{Negotiated} \longrightarrow \text{Secured Escrow} \longrightarrow \text{Dispatched} \longrightarrow \text{Delivered} \longrightarrow \text{Settled}$$
* **Digital Ledger:** Simple financial record book for farmers showing total sales, pending payments, and downloadable receipt slips.

### 5. 🌐 Vernacular & Accessible UI
* First-class support for **Kannada (UASD Dharwad local region)**, **Hindi**, and **English**.
* Big tactile buttons and color-coded statuses designed specifically for rural low-literacy users.

---

## 📂 Project Repository Structure

```text
cropguard-market/
├── backend/                    # Node.js + Express API & Socket.io (ISD Track)
│   ├── src/
│   │   ├── config/             # DB & Cloudinary configuration
│   │   ├── controllers/        # Auth, Listing, Negotiation, Order controllers
│   │   ├── middleware/         # JWT auth, RBAC, Error handlers
│   │   ├── models/             # Mongoose Schemas (User, Listing, Bid, Order)
│   │   ├── routes/             # RESTful API Route definitions
│   │   ├── sockets/            # Socket.io Real-Time Negotiation handlers
│   │   └── utils/              # Helper functions, Mandi price seeders
│   ├── .env
│   ├── .env.example
│   └── package.json
│
├── frontend/                   # Client applications (ASD & DE Tracks)
│   ├── mobile/                 # React Native / Expo App (Farmer & Buyer App)
│   │   ├── App.js              # Expo Mobile entry
│   │   ├── app.json            # Expo configuration
│   │   └── package.json
│   └── web/                    # React.js Admin & Wholesale Portal
│       └── README.md
│
└── database/                   # Database Architecture, Schemas & Seeds
    └── README.md
```

---

## 🚀 40-Day Sprint Roadmap Summary

| Sprint | Days | Milestones & Deliverables |
|:---|:---|:---|
| **Sprint 1** | Days 1–7 | Monorepo setup, Database Schemas, JWT Auth & RBAC Security |
| **Sprint 2** | Days 8–14 | Produce Listing CRUD, Cloudinary media upload, Mandi price benchmark |
| **Sprint 3** | Days 15–21 | Socket.io Real-Time Negotiation & Bidding Engine |
| **Sprint 4** | Days 22–28 | Order State Machine, Escrow simulation, Farmer Digital Ledger |
| **Sprint 5** | Days 29–35 | Full Cross-Platform Integration, UASD Dashboard, **Mid-November Viva Rehearsal** |
| **Sprint 6** | Days 36–40 | Cloud Deployment (Render/Vercel), Dockerization, Final Documentation |

---

## 🛠️ Local Development Setup

### Prerequisites
* **Node.js:** v18.0.0 or higher
* **npm:** v9.0.0 or higher
* **MongoDB:** Local instance or MongoDB Atlas Connection URI
* **Expo Go App:** Installed on physical Android/iOS device for mobile testing

### 1. Clone Repository
```bash
git clone https://github.com/Itsriteshx/Cropguard-market.git
cd Cropguard-market
```

### 2. Backend Server Setup
```bash
cd server
npm install
cp .env.example .env     # Configure PORT, MONGO_URI, JWT_SECRET
npm run dev             # Starts server at http://localhost:5000
```

### 3. Mobile App Setup (Expo)
```bash
cd ../mobile
npm install
npx expo start          # Scan QR code using Expo Go app on phone
```

### 4. Web Portal Setup (Vite)
```bash
cd ../web
npm install
npm run dev             # Starts Vite dev server at http://localhost:5173
```

---

## 🌿 Contribution & Git Etiquette

To maintain clean repository hygiene and continuous commit activity on the ADCMS academic portal:
1. Always branch out from `dev`:
   ```bash
   git checkout dev
   git pull origin dev
   git checkout -b feat/your-feature-name
   ```
2. Commit with conventional prefixes:
   - `feat:` New feature implementation
   - `fix:` Bug fix
   - `docs:` Documentation updates
   - `refactor:` Code cleanup
3. Make atomic, daily commits to reflect regular progress on the grading dashboard.

---

## 📄 License & Institutional Credits

Developed as part of the Major Capstone Project 2026.  
**Affiliation:** Ajeenkya DY Patil University (ADYPU) / Newton School of Technology (NST).  
**Mentored under:** Ministry of Agriculture & UASD Dharwad Problem Statement guidelines.
