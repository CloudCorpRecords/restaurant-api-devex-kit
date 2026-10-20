// Independent prototype. Not affiliated with Toast. Simulated API only.
import test from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { createApp } from "../src/server.ts";

const AUTHORIZED = "4111111111111111";
const DECLINED = "4000000000000002";

interface ApiResponse {
  status: number;
  headers: Record<string, string | undefined>;
  body: Record<string, any>;
}

let base = "";
let app: ReturnType<typeof createApp> | undefined;

test.before(async () => {
  app = createApp();
  await new Promise<void>((resolve) => app!.listen(0, "127.0.0.1", resolve));
  const port = (app.address() as AddressInfo).port;
  base = `http://127.0.0.1:${port}`;
});

test.after(() => {
  if (app) return new Promise<void>((resolve) => app!.close(() => resolve()));
});

async function call(method: string, path: string, body?: unknown, rawBody?: string): Promise<ApiResponse> {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  const headers: Record<string, string | undefined> = {};
  res.headers.forEach((v, k) => (headers[k] = v));
  const json = (await res.json()) as Record<string, any>;
  return { status: res.status, headers, body: json };
}

function errorShape(t: ApiResponse): void {
  assert.ok(t.body.error, "response carries an error object");
  assert.equal(typeof t.body.error.code, "string");
  assert.equal(typeof t.body.error.message, "string");
  assert.equal(typeof t.body.requestId, "string");
  assert.equal(t.headers["x-request-id"], t.body.requestId);
}

test("health check", async () => {
  const r = await call("GET", "/health");
  assert.equal(r.status, 200);
  assert.equal(r.body.status, "ok");
});

test("lists restaurants", async () => {
  const r = await call("GET", "/v1/restaurants");
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.body.restaurants));
  assert.equal(r.body.restaurants.length, 2);
});

test("serves a restaurant menu", async () => {
  const r = await call("GET", "/v1/restaurants/r001/menu");
  assert.equal(r.status, 200);
  assert.equal(r.body.restaurantId, "r001");
  assert.ok(r.body.menu.length >= 4);
});

test("menu for unknown restaurant is 404 with the standard error shape", async () => {
  const r = await call("GET", "/v1/restaurants/nope/menu");
  assert.equal(r.status, 404);
  assert.equal(r.body.error.code, "restaurant_not_found");
  errorShape(r);
});

test("creates an order and computes totals", async () => {
  const r = await call("POST", "/v1/orders", {
    restaurantId: "r001",
    items: [{ itemId: "m001", qty: 1 }],
  });
  assert.equal(r.status, 201);
  const order = r.body.order;
  assert.equal(order.status, "pending_payment");
  assert.equal(order.subtotalCents, 1400);
  assert.equal(order.taxCents, Math.round(1400 * 0.0875));
  assert.equal(order.totalCents, order.subtotalCents + order.taxCents);
  assert.equal(typeof r.body.requestId, "string");
});

test("order creation validates input with the standard error shape", async () => {
  const missing = await call("POST", "/v1/orders", { items: [] });
  assert.equal(missing.status, 400);
  assert.equal(missing.body.error.code, "missing_field");
  errorShape(missing);

  const badItem = await call("POST", "/v1/orders", {
    restaurantId: "r001",
    items: [{ itemId: "not-an-item", qty: 1 }],
  });
  assert.equal(badItem.status, 400);
  assert.equal(badItem.body.error.code, "item_not_found");
  errorShape(badItem);

  const badJson = await call("POST", "/v1/orders", undefined, "{oops");
  assert.equal(badJson.status, 400);
  assert.equal(badJson.body.error.code, "invalid_json");
  errorShape(badJson);
});

test("unknown routes return the standard error shape", async () => {
  const r = await call("GET", "/v1/nothing-here");
  assert.equal(r.status, 404);
  assert.equal(r.body.error.code, "not_found");
  errorShape(r);
});

test("full order and payment flow", async () => {
  const created = await call("POST", "/v1/orders", {
    restaurantId: "r002",
    items: [
      { itemId: "t001", qty: 2 },
      { itemId: "t004", qty: 1 },
    ],
  });
  assert.equal(created.status, 201);
  const id = created.body.order.id as string;

  const paid = await call("POST", `/v1/orders/${id}/pay`, { cardNumber: AUTHORIZED });
  assert.equal(paid.status, 200);
  assert.equal(paid.body.order.status, "paid");
  assert.equal(paid.body.order.payment.chargedCents, paid.body.order.totalCents);
  assert.equal(paid.body.order.payment.last4, "1111");

  const fetched = await call("GET", `/v1/orders/${id}`);
  assert.equal(fetched.status, 200);
  assert.equal(fetched.body.order.status, "paid");

  const again = await call("POST", `/v1/orders/${id}/pay`, { cardNumber: AUTHORIZED });
  assert.equal(again.status, 409);
  assert.equal(again.body.error.code, "order_not_payable");
  errorShape(again);
});

test("declined test card marks the order failed with the standard error shape", async () => {
  const created = await call("POST", "/v1/orders", {
    restaurantId: "r001",
    items: [{ itemId: "m002", qty: 1 }],
  });
  const id = created.body.order.id as string;

  const r = await call("POST", `/v1/orders/${id}/pay`, { cardNumber: DECLINED });
  assert.equal(r.status, 402);
  assert.equal(r.body.error.code, "card_declined");
  assert.ok(r.body.error.hint.includes("authorized test card"));
  errorShape(r);

  const fetched = await call("GET", `/v1/orders/${id}`);
  assert.equal(fetched.body.order.status, "failed");
});

test("payment validates the card number with the standard error shape", async () => {
  const created = await call("POST", "/v1/orders", {
    restaurantId: "r001",
    items: [{ itemId: "m003", qty: 1 }],
  });
  const id = created.body.order.id as string;

  const short = await call("POST", `/v1/orders/${id}/pay`, { cardNumber: "123" });
  assert.equal(short.status, 400);
  assert.equal(short.body.error.code, "invalid_card");
  errorShape(short);

  const unknown = await call("POST", `/v1/orders/${id}/pay`, { cardNumber: "4242424242424242" });
  assert.equal(unknown.status, 400);
  assert.equal(unknown.body.error.code, "unknown_card");
  assert.ok(unknown.body.error.hint.includes(AUTHORIZED));
  errorShape(unknown);
});
