# TODO (Orders admin performance)

- [ ] Backend: add MongoDB indexes for orders list query patterns
- [ ] Backend: change GET /api/v1/orders to return summary fields only (exclude orderDetails.items)
- [ ] Frontend: update AdminOrders.jsx table to rely on summary fields only
- [ ] Frontend: on "View" click, fetch full order via GET /api/v1/orders/:id
- [ ] Testing: load admin orders page with pagination/search/status
- [x] Testing: open modal and verify product list is shown
- [x] Testing: update status + delete order flows work


