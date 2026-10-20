# Toast DevEx Sample Kit (Independent Prototype)

**Independent prototype. Not affiliated with Toast. The API in this repo is simulated and is not Toast's real API.**

This is a Developer Experience sample kit: the kind of thing a DevEx team ships so a new developer reaches their first successful order in minutes, not hours. It contains a small simulated restaurant ordering and payments API, a sample client app that completes an order end to end against it, a quickstart, and an error handling guide.

Nothing here calls Toast or any external service. There are no API keys. Payments are simulated test cards; no money moves.

## Quickstart: your first order in under 5 minutes

Terminal 1, start the simulated API:

```bash
npm start
# Simulated restaurant API listening on http://localhost:4242
```

Terminal 2, run the end to end sample client (every curl below was verified against the running server):

```bash
npm run demo
```

Or do it by hand with curl:

```bash
# 1. Health check
curl http://localhost:4242/health

# 2. List restaurants
curl http://localhost:4242/v1/restaurants

# 3. Get a menu
curl http://localhost:4242/v1/restaurants/r001/menu

# 4. Create an order
curl -X POST http://localhost:4242/v1/orders \
  -H 'content-type: application/json' \
  -d '{"restaurantId":"r001","items":[{"itemId":"m001","qty":1},{"itemId":"m003","qty":2}]}'

# 5. Pay with the authorized test card (replace <orderId> with the id from step 4)
curl -X POST http://localhost:4242/v1/orders/<orderId>/pay \
  -H 'content-type: application/json' \
  -d '{"cardNumber":"4111111111111111"}'

# 6. Read the order back
curl http://localhost:4242/v1/orders/<orderId>
```

Test cards (simulated):

| Card | Behavior |
|---|---|
| `4111111111111111` | Always authorizes |
| `4000000000000002` | Always declines (HTTP 402) |

To see the decline path, create a second order and pay with the declined card.

## Architecture

```
client/order-flow.ts   sample client: restaurants -> menu -> order -> pay -> read back
src/server.ts          the simulated API (node:http, zero dependencies)
src/store.ts           in-memory restaurants, menus, test card numbers
src/errors.ts          error body builder, request id helpers
src/types.ts           shared types, including the single ApiErrorBody shape
tests/api.test.ts      10 tests: endpoints, error shapes, full order/payment flow
```

Data is in memory and resets when the server restarts. That is intentional for a sample kit: no database setup stands between the developer and their first success.

## Error handling guide

Every failure returns HTTP 4xx with the same body shape and an `x-request-id` header that echoes the body's `requestId`:

```json
{
  "error": { "code": "item_not_found", "message": "Item m999 is not on this restaurant's menu.", "hint": "Pick itemIds from GET /v1/restaurants/{id}/menu." },
  "requestId": "5c1e36fb-df34-43a1-8900-3c0b44e0f363"
}
```

Error codes you can see in practice:

| Code | HTTP | When | Recovery hint |
|---|---|---|---|
| `invalid_json` | 400 | Malformed request body | Send `Content-Type: application/json` with valid JSON |
| `missing_field` | 400 | `restaurantId` absent | List restaurants first |
| `invalid_items` | 400 | Empty items, bad qty, or missing itemId | `qty` is an integer of at least 1 |
| `item_not_found` | 400 | itemId not on that restaurant's menu | Re-read that restaurant's menu |
| `restaurant_not_found` | 404 | Bad restaurant id | `GET /v1/restaurants` |
| `order_not_found` | 404 | Bad order id | Create one with `POST /v1/orders` |
| `invalid_card` | 400 | Card number not 13 to 19 digits | Use one of the two test cards |
| `unknown_card` | 400 | Any other card number | The simulator only recognizes its two test cards |
| `card_declined` | 402 | The declined test card | Create a new order and use the authorized test card |
| `order_not_payable` | 409 | Paying an already paid or failed order | Only `pending_payment` orders can be paid |
| `not_found` | 404 | Unknown route | See the quickstart for available routes |

## DevEx principles applied

1. **Time to first success is the metric.** Two commands (`npm start`, `npm run demo`) and under 5 minutes to a completed, paid order. No database, no keys, no config.
2. **One error shape, always.** Client code never has to guess where the message lives or which id to quote to support. `x-request-id` and `requestId` in the body are identical.
3. **Errors teach.** Every error carries a `hint` that names the exact next call to make. The declined card error tells you the exact recovery path.
4. **Examples are tested.** Every curl in the quickstart was run against the live server before shipping, and the automated tests exercise the same paths, so the docs cannot drift from the code.
5. **Failure paths are first class.** The declined card, double payment, bad card number, and unknown item flows are all documented, tested, and reachable in under a minute each.

## Tests

```bash
npm test   # node --test tests/*.test.ts
```

Result on 2026-10-19: **10 tests, 10 pass, 0 fail** (health, restaurants, menu, menu 404 shape, order creation with tax math, input validation shapes, unknown route shape, full order/pay/read-back flow with double-payment 409, declined card flow, card validation). Also verified: all quickstart curl examples, the authorized and declined payment paths, and `npm run demo` end to end against `npm start`.
