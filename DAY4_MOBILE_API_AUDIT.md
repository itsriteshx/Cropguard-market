# DAY 4 — MOBILE API INTEGRATION AUDIT

**Project:** CropGuard Market
**Branch:** `feat/asd-isd`
**Date:** 2026-11-12
**Scope:** Mobile application architecture review and backend endpoint mapping

---

## 1. MOBILE PROJECT STRUCTURE

```
frontend/mobile/
├── App.js                          # Main app — AuthProvider → SocketProvider → tab navigation
├── index.js                        # Expo entry point
├── package.json                    # Dependencies (no test script)
├── src/
│   ├── auth/
│   │   ├── languageSync.js         # syncLanguagePreference() helper
│   │   └── sessionManager.js       # createSessionManager() — token-based session restore
│   ├── config/
│   │   ├── api.js                  # apiRequest(), API_BASE_URL, SOCKET_URL, resolveMediaUrl()
│   │   └── apiOrigin.js            # selectApiOrigin() — env/Metro/platform detection
│   ├── context/
│   │   ├── AuthContext.js          # AuthProvider — user, token, role, language, authenticate, logout
│   │   └── SocketContext.js        # SocketProvider — socket lifecycle, room join/leave
│   ├── i18n/
│   │   └── translations.js        # 8-language translation bundle (en, hi, kn, mr, te, ta, gu, pa)
│   ├── screens/
│   │   ├── AuthScreen.js           # Login / Register form
│   │   ├── MarketplaceScreen.js    # Listing browser + offer modal + mandi ticker
│   │   ├── SellProduceScreen.js    # Farmer listing creation + image upload
│   │   ├── NegotiationsScreen.js   # Active negotiations + real-time socket events
│   │   ├── OrdersScreen.js         # Order list + status transitions + receipt modal
│   │   ├── LedgerScreen.js         # Farmer ledger KPIs + transaction history
│   │   ├── MandiRatesScreen.js     # APMC mandi rates browser + weather
│   │   └── ProfileScreen.js        # User profile + language switcher + health check
│   ├── services/
│   │   └── socketService.js        # Socket.IO singleton — /negotiation namespace
│   └── utils/
│       └── typingController.js     # Typing debounce controller (references missing socket methods)
├── test/
│   ├── apiOrigin.test.cjs          # 2 tests — API origin selection
│   └── sessionManager.test.cjs     # 2 tests — session restore/storage errors
```

### Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| expo | ~58.0.20 | Framework |
| react-native | 0.88.0 | UI runtime |
| react | 19.3.0 | Core |
| socket.io-client | ^4.8.4 | Real-time negotiation |
| expo-secure-store | ~58.0.2 | Token storage (native) |
| expo-image-picker | ~58.0.10 | Photo selection |
| react-native-safe-area-context | ^5.11.1 | Safe area |

**No test script in package.json.** Tests run via `node --test test/*.test.cjs`.

---

## 2. API CLIENT ARCHITECTURE

### Current Implementation: `src/config/api.js`

| Feature | Status | Notes |
|---------|--------|-------|
| Centralized base URL | ✅ Integrated | `selectApiOrigin()` with env/Metro/platform fallback |
| JSON Content-Type | ✅ Integrated | Auto-sets unless FormData |
| Bearer token attachment | ✅ Integrated | Passed as 3rd argument to `apiRequest()` |
| Timeout with AbortController | ✅ Integrated | Default 8s, configurable `timeoutMs` |
| JSON response parsing | ✅ Integrated | Checks `content-type` header |
| Non-JSON fallback | ✅ Integrated | Returns `{ success: false, message: text }` |
| HTTP status forwarding | ✅ Integrated | Appends `httpStatus` to response |
| Network error handling | ✅ Integrated | Returns `{ success: false, networkError: true }` |
| Socket URL export | ✅ Integrated | `SOCKET_URL` / `getSocketUrl()` |
| Media URL resolution | ✅ Integrated | `resolveMediaUrl()` prepends origin for `/uploads/` paths |

**Note:** `apiClient.js` does not exist. The user has an empty IDE tab for it. All API logic is in `api.js`.

### Session Management: `src/auth/sessionManager.js`

| Feature | Status |
|---------|--------|
| Token-first restoration | ✅ Server-validated via `/auth/me` |
| 401 auto-cleanup | ✅ Removes stale token |
| Network unavailable state | ✅ Returns `{ state: 'unavailable' }` |
| Storage error propagation | ✅ Throws — caller handles |

### Language Sync: `src/auth/languageSync.js`

| Feature | Status |
|---------|--------|
| Backend sync via PATCH `/auth/language` | ✅ Integrated |
| Response success verification | ✅ Checks `res.success === false` |
| Unauthenticated fallback | ✅ Returns `synced: false` |
| Error handling | ✅ Returns structured error |

---

## 3. SCREEN-TO-ENDPOINT INTEGRATION MAP

### 3.1 AuthScreen

| # | Feature | Endpoint | Method | Auth | Integration Status | Notes |
|---|---------|----------|--------|------|-------------------|-------|
| 1 | Register | `/api/auth/register` | POST | No | ✅ **Integrated** | Uses `authenticate('register', fields)` |
| 2 | Login | `/api/auth/login` | POST | No | ✅ **Integrated** | Uses `authenticate('login', fields)` |
| 3 | Session restore | `/api/auth/me` | GET | Yes | ✅ **Integrated** | Via `sessionManager.restore()` |
| 4 | Token storage | SecureStore/sessionStorage | — | — | ✅ **Integrated** | Platform-aware |
| 5 | Error display | — | — | — | ✅ **Integrated** | Shows API message |
| 6 | Loading state | — | — | — | ✅ **Integrated** | Spinner + disabled button |

**Assessment: ✅ Statically Integrated (Pending live end-to-end verification)**

### 3.2 MarketplaceScreen

| # | Feature | Endpoint | Method | Auth | Integration Status | Notes |
|---|---------|----------|--------|------|-------------------|-------|
| 1 | Fetch listings | `/api/listings` | GET | Optional | ✅ **Integrated** | Passes token, handles pagination |
| 2 | Search/filter | `/api/listings?search=&category=` | GET | Optional | ✅ **Integrated** | Debounced search + category chips |
| 3 | Pagination | `?page=N&limit=10` | GET | Optional | ✅ **Integrated** | Load more + deduplication |
| 4 | Pull-to-refresh | — | — | — | ✅ **Integrated** | RefreshControl |
| 5 | Mandi ticker | `/api/mandi-rates?state=ALL&limit=10` | GET | No | ✅ **Integrated** | Top corridor bar |
| 6 | Live mandi search | `/api/mandi-rates/live?...` | GET | No | ✅ **Integrated** | Shown when no listings match |
| 7 | Listing detail modal | Local data | — | — | ✅ **Integrated** | Uses fetched listing fields |
| 8 | Make offer → negotiation | `/api/negotiations` | POST | Yes | ✅ **Integrated** | `listingId, offeredPrice, quantity, note` |
| 9 | Image display | `resolveMediaUrl()` | — | — | ✅ **Integrated** | Handles relative/absolute URLs |
| 10 | Empty state | — | — | — | ✅ **Integrated** | Shows message + mandi fallback |
| 11 | Error state | — | — | — | ✅ **Integrated** | Shows loadError, retry button |
| 12 | Loading state | — | — | — | ✅ **Integrated** | ActivityIndicator |
| 13 | Stale request guard | — | — | — | ✅ **Integrated** | `requestId.current` counter |

**Field mapping:** Uses `pricePerUnit` (correct backend field). Also checks `expectedPrice` as fallback — this is acceptable as a display fallback.

**Assessment: ✅ Statically Integrated (Pending live end-to-end verification)**

### 3.3 SellProduceScreen

| # | Feature | Endpoint | Method | Auth | Integration Status | Notes |
|---|---------|----------|--------|------|-------------------|-------|
| 1 | Image picker | expo-image-picker | — | — | ✅ **Integrated** | 5MB limit, preview, remove |
| 2 | Image upload | `/api/upload` | POST | Yes | ✅ **Integrated** | Multipart `photos` field |
| 3 | Create listing | `/api/listings` | POST | Yes | ✅ **Integrated** | Correct fields: cropName, category, quantity, unit, pricePerUnit, qualityGrade, description, images, location |
| 4 | Mandi benchmark | `/api/mandi-rates/benchmark?commodity=&district=` | GET | No | ✅ **Integrated** | Auto-suggest price |
| 5 | Live crop catalog | `/api/mandi-rates?state=ALL&limit=150` | GET | No | ✅ **Integrated** | Crop suggestion chips |
| 6 | Field validation | — | — | — | ✅ **Integrated** | Name, qty, price, desc length |
| 7 | Duplicate submit guard | — | — | — | ✅ **Integrated** | `submitting` flag |
| 8 | Upload failure handling | — | — | — | ✅ **Integrated** | Shows alert, preserves form |
| 9 | Role restriction | — | — | — | ✅ **Integrated** | Only FARMER can publish |
| 10 | Form reset after success | — | — | — | ✅ **Integrated** | Clears all fields |

**Assessment: ✅ Statically Integrated (Pending live end-to-end verification)**

### 3.4 NegotiationsScreen

| # | Feature | Endpoint | Method | Auth | Integration Status | Notes |
|---|---------|----------|--------|------|-------------------|-------|
| 1 | Fetch negotiations | `/api/negotiations/my` | GET | Yes | ✅ **Integrated** | Pull-to-refresh |
| 2 | Counter offer | `/api/negotiations/:id/counter` | POST | Yes | ✅ **Integrated** | `counterPrice, note` |
| 3 | Accept deal | `/api/negotiations/:id/accept` | POST | Yes | ✅ **Integrated** | Confirmation dialog |
| 4 | Reject deal | `/api/negotiations/:id/reject` | POST | Yes | ✅ **Integrated** | Destructive confirmation |
| 5 | Send message | `/api/negotiations/:id/message` | POST | Yes | ✅ **Integrated** | Quick chat input |
| 6 | Place order from deal | `/api/orders` | POST | Yes | ✅ **Integrated** | `{ negotiationId }` |
| 7 | Socket: negotiation_created | — | — | — | ✅ **Integrated** | Refetches list |
| 8 | Socket: counter_offer_received | — | — | — | ✅ **Integrated** | Live UI update + toast |
| 9 | Socket: deal_locked | — | — | — | ✅ **Integrated** | Celebratory modal |
| 10 | Socket: deal_rejected | — | — | — | ✅ **Integrated** | Status update + toast |
| 11 | Socket: participant_status | — | — | — | ✅ **Integrated** | Online presence dots |
| 12 | Socket: chat_message_received | — | — | — | ✅ **Integrated** | Live message update |
| 13 | Socket room join/leave | — | — | — | ✅ **Integrated** | Auto-join on load, cleanup on unmount |
| 14 | Typing indicator display | — | — | — | ✅ **Integrated** | Shows "X is typing..." |
| 15 | Typing emit on input | — | — | — | ✅ **Integrated** | `typingController.handleTextChange()` |
| 16 | Typing stop on send | — | — | — | ✅ **Integrated** | `typingController.handleMessageSent()` |
| 17 | Turn-based UI | — | — | — | ✅ **Integrated** | Disables buttons when not your turn |
| 18 | Loading/empty/error states | — | — | — | ✅ **Integrated** | All three handled |
| 19 | Duplicate order guard | — | — | — | ✅ **Integrated** | `creatingOrder` flag |
| 20 | Listener cleanup | — | — | — | ✅ **Integrated** | Unsub functions in useEffect return |

**Known issue:** `socketService` does NOT implement `startTyping()`, `stopTyping()`, or `onParticipantTyping()` methods. The `typingController` guards with `typeof socketService.startTyping === 'function'` checks, so it won't crash, but typing events are **silently not emitted**. The `participant_typing` socket event subscription (via `onParticipantTyping`) also silently no-ops. These methods need to be added to socketService.js.

**Assessment: ⚠️ Partially Integrated — socket typing methods missing in socketService (Pending live end-to-end verification)**

### 3.5 OrdersScreen

| # | Feature | Endpoint | Method | Auth | Integration Status | Notes |
|---|---------|----------|--------|------|-------------------|-------|
| 1 | Fetch orders | `/api/orders/my-orders` | GET | Yes | ✅ **Integrated** | Pull-to-refresh |
| 2 | Status transitions | `/api/orders/:id/status` | PATCH | Yes | ✅ **Integrated** | `{ nextStatus }` |
| 3 | Receipt retrieval | `/api/orders/:id/receipt` | GET | Yes | ✅ **Integrated** | Modal display |
| 4 | Share receipt | Native Share API | — | — | ✅ **Integrated** | Text-based share |
| 5 | Simulated payment labels | — | — | — | ✅ **Integrated** | Clear "Simulated" labels |
| 6 | Loading/empty/error states | — | — | — | ✅ **Integrated** | All three handled |
| 7 | Role-based actions | — | — | — | ✅ **Integrated** | Buyer/farmer-appropriate buttons |

**Assessment: ✅ Statically Integrated (Pending live end-to-end verification)**

### 3.6 LedgerScreen

| # | Feature | Endpoint | Method | Auth | Integration Status | Notes |
|---|---------|----------|--------|------|-------------------|-------|
| 1 | Fetch ledger | `/api/orders/farmer-ledger` | GET | Yes (FARMER) | ✅ **Integrated** | KPI summary |
| 2 | Fallback to orders | `/api/orders/my-orders` | GET | Yes | ✅ **Integrated** | Client-side calculation |
| 3 | Receipt retrieval | `/api/orders/:id/receipt` | GET | Yes | ✅ **Integrated** | Modal |
| 4 | Share receipt | Native Share API | — | — | ✅ **Integrated** | Text share |
| 5 | Pull-to-refresh | — | — | — | ✅ **Integrated** | RefreshControl |
| 6 | Simulated labels | — | — | — | ✅ **Integrated** | "Demo" / "Simulated" |
| 7 | Loading/empty states | — | — | — | ✅ **Integrated** | ActivityIndicator + empty msg |

**Assessment: ✅ Statically Integrated (Pending live end-to-end verification)**

### 3.7 MandiRatesScreen

| # | Feature | Endpoint | Method | Auth | Integration Status | Notes |
|---|---------|----------|--------|------|-------------------|-------|
| 1 | Live mandi feed | `/api/mandi-rates/live?state=&limit=&offset=&commodity=` | GET | No | ✅ **Integrated** | Pagination, state/crop filters |
| 2 | Weather data | `/api/mandi-rates/weather?district=Dharwad` | GET | No | ✅ **Integrated** | Displayed in header banner |
| 3 | Search by crop | — | — | — | ✅ **Integrated** | Search input + submit |
| 4 | State filter | — | — | — | ✅ **Integrated** | Horizontal chip selector |
| 5 | Crop filter | — | — | — | ✅ **Integrated** | Quick crop chips |
| 6 | Load more pagination | — | — | — | ✅ **Integrated** | `hasMore` + `nextOffset` |
| 7 | Pull-to-refresh | — | — | — | ✅ **Integrated** | RefreshControl |
| 8 | Stale request guard | — | — | — | ✅ **Integrated** | `requestId.current` counter |
| 9 | Loading/empty/error states | — | — | — | ✅ **Integrated** | All three handled |
| 10 | Image display | — | — | — | ✅ **Integrated** | `item.imageUrl` with fallback emoji |

**Assessment: ✅ Statically Integrated (Pending live end-to-end verification)**

### 3.8 ProfileScreen

| # | Feature | Endpoint | Method | Auth | Integration Status | Notes |
|---|---------|----------|--------|------|-------------------|-------|
| 1 | Display user profile | Local `user` object | — | — | ✅ **Integrated** | Name, phone, role, location, ID |
| 2 | Language switching | PATCH `/api/auth/language` | PATCH | Yes | ✅ **Integrated** | Via `setLanguage()` in AuthContext |
| 3 | Logout | — | — | — | ✅ **Integrated** | Clears token, resets state |
| 4 | Health check | `/api/health` | GET | No | ✅ **Integrated** | Backend + DB + Socket status |
| 5 | Backend URL display | — | — | — | ✅ **Integrated** | Shows `API_BASE_URL` |

**Assessment: ✅ Statically Integrated (Pending live end-to-end verification)**

---

## 4. SOCKET.IO INTEGRATION STATUS

### SocketContext (`src/context/SocketContext.js`)

| Feature | Status |
|---------|--------|
| Token-based connection | ✅ Connects when token available |
| Disconnect on token removal | ✅ Disconnects on logout |
| Connection state tracking | ✅ `isConnected` state |
| Room join/leave | ✅ Via `socketService.joinRoom/leaveRoom` |
| Connection error handling | ✅ Soft handling without uncaught emitter errors |
| Listener cleanup | ✅ On token change / unmount |

### SocketService (`src/services/socketService.js`)

| Feature | Status | Notes |
|---------|--------|-------|
| Namespace `/negotiation` | ✅ | Correct namespace |
| WebSocket + polling transports | ✅ | Fallback supported |
| Reconnection (10 attempts) | ✅ | Auto-rejoin rooms on reconnect |
| Room management | ✅ | `activeRooms` Set |
| Event listeners with unsub | ✅ | All return cleanup functions |
| `startTyping(negotiationId)` | ❌ **Missing** | Referenced by typingController but not implemented |
| `stopTyping(negotiationId)` | ❌ **Missing** | Referenced by typingController but not implemented |
| `onParticipantTyping(callback)` | ❌ **Missing** | Referenced by typingController but not implemented |

### TypingController (`src/utils/typingController.js`)

| Feature | Status | Notes |
|---------|--------|-------|
| Debounced typing start/stop | ✅ | 2s debounce default |
| Per-room timer management | ✅ | Map-based |
| Message-sent typing stop | ✅ | Immediate stop on send |
| Cleanup on unmount | ✅ | Stops all rooms, clears timers |
| Socket method guards | ✅ | `typeof === 'function'` checks prevent crashes |

---

## 5. FINDINGS SUMMARY

### ✅ Statically Integrated (Pending Live End-to-End Verification)

| Screen/Module | Endpoints Used | Status |
|---------------|---------------|--------|
| AuthScreen | POST `/auth/register`, POST `/auth/login` | Statically integrated; wire contracts match |
| AuthContext | GET `/auth/me`, PATCH `/auth/language` | Statically integrated; wire contracts match |
| MarketplaceScreen | GET `/listings`, POST `/negotiations`, GET `/mandi-rates`, GET `/mandi-rates/live` | Statically integrated; wire contracts match |
| SellProduceScreen | POST `/upload`, POST `/listings`, GET `/mandi-rates`, GET `/mandi-rates/benchmark` | Statically integrated; wire contracts match (see data-integrity note on location) |
| NegotiationsScreen | GET `/negotiations/my`, POST `/:id/counter`, POST `/:id/accept`, POST `/:id/reject`, POST `/:id/message`, POST `/orders` | Statically integrated for REST; socket typing methods missing |
| OrdersScreen | GET `/orders/my-orders`, PATCH `/:id/status`, GET `/:id/receipt` | Statically integrated; wire contracts match |
| LedgerScreen | GET `/orders/farmer-ledger`, GET `/orders/my-orders`, GET `/:id/receipt` | Statically integrated; wire contracts match |
| MandiRatesScreen | GET `/mandi-rates/live`, GET `/mandi-rates/weather` | Statically integrated; wire contracts match |
| ProfileScreen | GET `/health`, PATCH `/auth/language` | Statically integrated; wire contracts match |

### ⚠️ Requires Implementation

| Issue | Files | Priority |
|-------|-------|----------|
| **Socket typing methods missing** — `startTyping()`, `stopTyping()`, `onParticipantTyping()` not implemented in socketService.js | `frontend/mobile/src/services/socketService.js` | Medium |

### Details of Missing Typing Methods

The `typingController.js` correctly uses these methods but guards against their absence with `typeof === 'function'` checks. This means:

1. **No crash** — the app works fine without them.
2. **No typing indicator emissions** — other participants won't see "X is typing...".
3. **No incoming typing indicators** — the user won't see counterpart typing status.

These methods need to emit/listen for the backend's `typing_start`, `typing_stop`, and `participant_typing` socket events.

---

## 6. BACKEND CONTRACT VERIFICATION

### Endpoint Contracts Verified Against Route Files

| Endpoint | Mobile Usage | Backend Route | Match |
|----------|-------------|---------------|-------|
| POST `/api/auth/register` | AuthContext.authenticate('register') | `authRoutes.js:14` | ✅ |
| POST `/api/auth/login` | AuthContext.authenticate('login') | `authRoutes.js:15` | ✅ |
| GET `/api/auth/me` | sessionManager.restore() | `authRoutes.js:18` (protect) | ✅ |
| PATCH `/api/auth/language` | languageSync.syncLanguagePreference() | `authRoutes.js:19` (protect) | ✅ |
| GET `/api/listings` | MarketplaceScreen.fetchListings() | `listingRoutes.js:18` (optionalProtect) | ✅ |
| POST `/api/listings` | SellProduceScreen.handleSubmitListing() | `listingRoutes.js:19` (protect, FARMER/ADMIN) | ✅ |
| POST `/api/upload` | SellProduceScreen (multipart photos) | `uploadRoutes.js:9` (protect) | ✅ |
| GET `/api/negotiations/my` | NegotiationsScreen.fetchNegotiations() | `negotiationRoutes.js:21` (protect) | ✅ |
| POST `/api/negotiations` | MarketplaceScreen.handleSubmitOffer() | `negotiationRoutes.js:20` (protect) | ✅ |
| POST `/api/negotiations/:id/counter` | NegotiationsScreen.handleSubmitCounter() | `negotiationRoutes.js:26` (protect) | ✅ |
| POST `/api/negotiations/:id/accept` | NegotiationsScreen.handleAcceptDeal() | `negotiationRoutes.js:28` (protect) | ✅ |
| POST `/api/negotiations/:id/reject` | NegotiationsScreen.handleRejectDeal() | `negotiationRoutes.js:29` (protect) | ✅ |
| POST `/api/negotiations/:id/message` | NegotiationsScreen.handleSendQuickChat() | `negotiationRoutes.js:27` (protect) | ✅ |
| GET `/api/orders/my-orders` | OrdersScreen.load() | `orderRoutes.js:24` (protect) | ✅ |
| POST `/api/orders` | NegotiationsScreen.placeOrder() | `orderRoutes.js:27` (protect) | ✅ |
| PATCH `/api/orders/:id/status` | OrdersScreen.transition() | `orderRoutes.js:34` (protect) | ✅ |
| GET `/api/orders/:id/receipt` | OrdersScreen/LedgerScreen | `orderRoutes.js:32` (protect) | ✅ |
| GET `/api/orders/farmer-ledger` | LedgerScreen.fetchLedgerData() | `orderRoutes.js:20` (protect, FARMER/ADMIN) | ✅ |
| GET `/api/mandi-rates` | MarketplaceScreen/SellProduceScreen | `mandiRoutes.js:29` | ✅ |
| GET `/api/mandi-rates/live` | MarketplaceScreen/MandiRatesScreen | `mandiRoutes.js:16` | ✅ |
| GET `/api/mandi-rates/weather` | MandiRatesScreen | `mandiRoutes.js:17` | ✅ |
| GET `/api/mandi-rates/benchmark` | SellProduceScreen | `mandiRoutes.js:26` | ✅ |
| GET `/api/health` | ProfileScreen.checkHealth() | `healthRoutes.js:11` | ✅ |

**All 23 mobile-to-backend endpoint mappings verified. No contract mismatches found.**

---

## 7. EXISTING TESTS

| Test File | Tests | Status |
|-----------|-------|--------|
| `test/apiOrigin.test.cjs` | 2 (explicit origin, Metro detection) | ✅ 2/2 pass |
| `test/sessionManager.test.cjs` | 2 (restore lifecycle, storage errors) | ✅ 2/2 pass |
| **Total** | **4** | **4/4 pass** |

> [!IMPORTANT]
> **Scope of Existing Test Suite:** The 4/4 passing tests cover *only* the two specific utility test files listed above (`apiOrigin.test.cjs` and `sessionManager.test.cjs`). They do **not** provide automated coverage for live mobile screens, request/response cycle execution (`apiRequest`), WebSocket event handling, user interactions, or complete end-to-end mobile workflows. Broad automated test coverage for mobile screens and integrations is a primary gap to be addressed in subsequent phases.

### Test Gaps

| Area | Current Coverage | Gap |
|------|-----------------|-----|
| API client `apiRequest()` | None | Timeout, network error, non-JSON response, FormData headers |
| Language sync | None | Covered by Day 1 implementation but no mobile test file |
| Typing controller | None | Debounce, stop, cleanup, missing socket method guards |
| Socket service | None | Connect, disconnect, room management |
| Screen-level integration | None | Response parsing per screen |

---

## 8. MOCK/HARDCODED DATA CHECK

| Screen | Mock Data Found | Notes |
|--------|----------------|-------|
| AuthScreen | ❌ None | Real API calls |
| MarketplaceScreen | ❌ None | Real API calls |
| SellProduceScreen | ⚠️ Data Integrity Risk | Hardcoded fallback location `{ coordinates: [75.0084, 15.3647], village: 'Navalgund', district: 'Dharwad', state: 'Karnataka', pincode: '580029' }` injected when `user.location` is missing or undefined. This is a potential data-integrity issue rather than an approved development default: produce listings submitted by farmers without complete profile locations will silently persist with inaccurate geographic coordinates and district metadata. |
| NegotiationsScreen | ❌ None | Real API + socket calls |
| OrdersScreen | ❌ None | Real API calls |
| LedgerScreen | ⚠️ Partial | Client-side fallback calculation if `/farmer-ledger` fails. Not mock data — derived from real orders. |
| MandiRatesScreen | ❌ None | Real API calls |
| ProfileScreen | ❌ None | Real API + context data |

All screens are structured to connect to real backend endpoints. However, the hardcoded Navalgund fallback location in `SellProduceScreen.js` poses an active data-integrity risk and should be resolved or validated rather than assumed acceptable.

---

## 9. IMPLEMENTATION PLAN FOR REMAINING PHASES

### Phase 2 — API Client and Authentication
**Assessment: Already implemented.** The existing `api.js` client with `apiRequest()` fully handles:
- Environment-aware base URL
- JWT Bearer token attachment
- Timeout and abort handling
- Response parsing with httpStatus
- Network error detection
- FormData support

The AuthContext with sessionManager and languageSync is statically integrated with backend contracts (pending live E2E verification). Phase 2 will focus on:
- Adding missing API client tests
- Adding language sync tests
- Verifying edge cases

### Phase 3 — Marketplace
**Assessment: Already integrated.** The MarketplaceScreen already uses real `/listings` data with pagination, search, categories, offer creation, and mandi rates. Phase 3 will verify and add tests.

### Phase 4 — Farmer Listing and Image Upload
**Assessment: Already integrated.** SellProduceScreen handles image picker, multipart upload to `/upload`, and listing creation via `/listings`. Phase 4 will verify and add tests.

### Phase 5 — Negotiations and Socket.IO
**Assessment: Mostly integrated.** The only gap is 3 missing socket methods in socketService.js (`startTyping`, `stopTyping`, `onParticipantTyping`). Phase 5 will add these methods and related tests.

### Phase 6 — Orders and Ledger
**Assessment: Already integrated.** Both screens use real API data. Phase 6 will verify and add tests.

### Phase 7 — Mandi Rates and Profile
**Assessment: Already integrated.** Both screens use real API data. Phase 7 will verify and add tests.

### Phase 8 — End-to-End Verification
Full verification pass, test execution, and final report.

---

## 10. DEPENDENCIES AND BLOCKERS

| Item | Status | Impact |
|------|--------|--------|
| Backend running and accessible | Required for live testing | No mobile integration testing without it |
| MongoDB database available | Required | Backend endpoints need DB |
| Mandi rates external API | Optional | Backend has fallback responses |
| Cloudinary (image upload) | Optional | Backend may store locally |

**No blockers for Phase 2+ implementation.** The mobile app is already substantially integrated with the backend.

---

## 11. GIT STATUS

```
Working tree: clean (except untracked Day 3 report and this audit)
Branch: feat/asd-isd
HEAD: 9868948 feat: harden backend reliability and security
Stashes: 4 preserved
```
