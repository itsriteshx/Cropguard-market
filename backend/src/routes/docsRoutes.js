const express = require('express');
const router = express.Router();

const apiCatalog = {
  project: 'CropGuard Market API Gateway',
  version: '1.0.0',
  description: 'Direct Market Access Platform for Farmers — Ministry of Agriculture & UASD Dharwad Guidelines',
  baseUrl: '/api',
  websocketGateway: 'ws://<host>:<port>/negotiation',
  modules: [
    {
      name: 'Authentication & Profile (ISD Track)',
      endpoints: [
        { method: 'POST', path: '/api/auth/register', access: 'Public', desc: 'Register farmer, consumer, or retailer account' },
        { method: 'POST', path: '/api/auth/login', access: 'Public', desc: 'Authenticate with phone/email and password, returns JWT token' },
        { method: 'GET', path: '/api/auth/me', access: 'Private (Bearer)', desc: 'Fetch authenticated user profile details' }
      ]
    },
    {
      name: 'Produce Listing Engine',
      endpoints: [
        { method: 'GET', path: '/api/listings', access: 'Public', desc: 'Browse produce with $nearSphere radius search, category, and price filters' },
        { method: 'POST', path: '/api/listings', access: 'Private (FARMER)', desc: 'Create new produce listing with farm location & pricing' },
        { method: 'GET', path: '/api/listings/my-listings', access: 'Private (FARMER)', desc: 'Get all listings created by logged-in farmer' },
        { method: 'GET', path: '/api/listings/:id', access: 'Public', desc: 'Get single produce listing with populated farmer details' },
        { method: 'PUT', path: '/api/listings/:id', access: 'Private (FARMER)', desc: 'Update produce price, quantity, or description' },
        { method: 'DELETE', path: '/api/listings/:id', access: 'Private (FARMER)', desc: 'Remove / close produce listing' }
      ]
    },
    {
      name: 'APMC Mandi Rate Benchmark (Anti-Exploitation)',
      endpoints: [
        { method: 'GET', path: '/api/mandi-rates', access: 'Public', desc: 'Filter APMC rates by commodity, state, and district' },
        { method: 'GET', path: '/api/mandi-rates/benchmark?commodity=TOMATO&district=DHARWAD', access: 'Public', desc: 'Get per-kg fair price corridor & anti-exploitation price guidance' }
      ]
    },
    {
      name: 'Bargaining & Price Negotiation (REST + WebSockets)',
      endpoints: [
        { method: 'POST', path: '/api/negotiations', access: 'Private (BUYER)', desc: 'Submit opening bid/offer on farmer listing' },
        { method: 'POST', path: '/api/negotiations/:id/counter', access: 'Private (Participants)', desc: 'Submit counter-offer (alternates turn between buyer and farmer)' },
        { method: 'POST', path: '/api/negotiations/:id/accept', access: 'Private (Participants)', desc: 'Lock agreed price and finalize digital agreement' },
        { method: 'POST', path: '/api/negotiations/:id/reject', access: 'Private (Participants)', desc: 'Reject negotiation offer and close session' },
        { method: 'GET', path: '/api/negotiations/my', access: 'Private', desc: 'List active and past negotiation sessions for current user' }
      ]
    },
    {
      name: 'Order Lifecycle & Digital Ledger (Escrow Machine)',
      endpoints: [
        { method: 'POST', path: '/api/orders', access: 'Private', desc: 'Create confirmed order from accepted negotiation' },
        { method: 'PUT', path: '/api/orders/:id/status', access: 'Private', desc: 'Advance order state: PLACED -> ESCROW_HELD -> DISPATCHED -> DELIVERED -> SETTLED' },
        { method: 'GET', path: '/api/orders/my-orders', access: 'Private', desc: 'Get purchases (Buyer) or sales (Farmer)' },
        { method: 'GET', path: '/api/orders/farmer-ledger', access: 'Private (FARMER)', desc: 'Farmer Digital Khata: sales metrics, pending escrow, 10% direct savings' },
        { method: 'GET', path: '/api/orders/:id/receipt', access: 'Private', desc: 'Downloadable digital receipt slip with zero-commission declaration' }
      ]
    },
    {
      name: 'Media Upload (Cloudinary CDN)',
      endpoints: [
        { method: 'POST', path: '/api/upload', access: 'Private (FARMER)', desc: 'Upload up to 5 produce photos (auto-optimized via Cloudinary CDN or local fallback)' }
      ]
    },
    {
      name: 'Real-Time WebSockets (/negotiation namespace)',
      endpoints: [
        { method: 'WS', path: 'join_room', access: 'Public', desc: 'Join room_${negotiationId} for live session' },
        { method: 'WS', path: 'send_counter_offer', access: 'Participants', desc: 'Emit real-time counter offer broadcasted to both parties' },
        { method: 'WS', path: 'accept_deal', access: 'Participants', desc: 'Emit deal acceptance and receive live deal_locked broadcast' }
      ]
    }
  ]
};

// JSON Catalog
router.get('/', (req, res) => {
  if (req.headers.accept && req.headers.accept.includes('text/html')) {
    // Return HTML Documentation Viewer
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>CropGuard Market — API Documentation</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0F172A; color: #F8FAFC; margin: 0; padding: 30px; }
        .header { border-bottom: 1px solid #1E293B; padding-bottom: 20px; margin-bottom: 30px; }
        .title { color: #10B981; font-size: 28px; margin: 0 0 8px 0; font-weight: 700; }
        .badge { background: #1E293B; color: #34D399; padding: 4px 10px; border-radius: 12px; font-size: 13px; border: 1px solid #10B981; }
        .section { background: #1E293B; border-radius: 8px; padding: 20px; margin-bottom: 20px; border: 1px solid #334155; }
        .section-title { color: #38BDF8; margin-top: 0; font-size: 18px; }
        .endpoint { display: flex; align-items: center; padding: 10px 0; border-bottom: 1px solid #334155; }
        .endpoint:last-child { border-bottom: none; }
        .method { font-weight: 700; font-size: 12px; padding: 4px 8px; border-radius: 4px; min-width: 55px; text-align: center; margin-right: 15px; }
        .method-GET { background: #0284C7; color: white; }
        .method-POST { background: #16A34A; color: white; }
        .method-PUT { background: #D97706; color: white; }
        .method-DELETE { background: #DC2626; color: white; }
        .method-WS { background: #9333EA; color: white; }
        .path { font-family: monospace; font-size: 14px; color: #E2E8F0; min-width: 280px; }
        .access { font-size: 12px; color: #94A3B8; margin-right: 20px; min-width: 140px; }
        .desc { font-size: 13px; color: #CBD5E1; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1 class="title">🌾 CropGuard Market — API Gateway Specification</h1>
        <p style="color: #94A3B8; margin: 6px 0 12px 0;">Ministry of Agriculture & UASD Dharwad • 100% Backend Complete</p>
        <span class="badge">Node.js Express + MongoDB Atlas + Socket.io (ISD Track)</span>
      </div>
      ${apiCatalog.modules
        .map(
          (m) => `
        <div class="section">
          <h2 class="section-title">📂 ${m.name}</h2>
          ${m.endpoints
            .map(
              (e) => `
            <div class="endpoint">
              <span class="method method-${e.method}">${e.method}</span>
              <span class="path">${e.path}</span>
              <span class="access">🔒 ${e.access}</span>
              <span class="desc">${e.desc}</span>
            </div>
          `
            )
            .join('')}
        </div>
      `
        )
        .join('')}
    </body>
    </html>
    `;
    return res.send(html);
  }

  return res.status(200).json({
    success: true,
    catalog: apiCatalog
  });
});

module.exports = router;
