# Backend/Frontend Performance Optimization TODO

## Backend (Express + MongoDB)
- [ ] Add compression middleware in `server.js`.

- [x] Harden per-request timeouts + ensure JSON/body limits are sane in `server.js`.
- [ ] Add MongoDB indexes in `models/product.model.js` (index `id`, add `collection` index).
- [ ] Reduce duplicate DB calls in `controller/cart.controller.js` (single populate query; normalize productId once).
- [ ] Optimize checkout path `controller/checkout.controller.js` (avoid extra loops where possible; populate once).
- [ ] Optimize paystack verify path in `router/payment.routes.js` (avoid extra queries; minor CPU reductions).
- [ ] Ensure request always responds (no hanging) by keeping centralized error handling.

## Frontend (React)
- [ ] Reduce recomputation/re-renders in `Aviaire/src/pages/Checkout.jsx` (narrow `paystackConfig` deps; stable handlers).
- [ ] Make API logging conditional in `Aviaire/src/services/apiClient.js`.
- [ ] Ensure no duplicate payment triggering during submit.

## Deployment (Render/Vercel)
- [ ] Confirm production env vars are compatible.
- [ ] Validate builds: `npm run build` (frontend) and `npm run start` (backend if available).

