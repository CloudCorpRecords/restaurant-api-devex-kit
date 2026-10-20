// Independent prototype. Not affiliated with Toast. The API served here is
// simulated and is not Toast's real API. Zero dependencies: node:http only.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomBytes, randomUUID } from "node:crypto";
import { errorBody, newRequestId } from "./errors.ts";
import { RESTAURANTS, TEST_CARDS, findRestaurant } from "./store.ts";
import type { Order, OrderItemInput, OrderLine } from "./types.ts";

const TAX_RATE = 0.0875;
const orders = new Map<string, Order>();

function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c as Buffer));
    req.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8");
      if (text.trim() === "") return resolve(undefined);
      try {
        resolve(JSON.parse(text));
      } catch {
        reject(new Error("invalid_json"));
      }
    });
    req.on("error", reject);
  });
}

function send(res: ServerResponse, status: number, requestId: string, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-length": Buffer.byteLength(payload),
    "content-type": "application/json",
    "x-request-id": requestId,
  });
  res.end(payload);
}

function sendError(
  res: ServerResponse,
  status: number,
  code: string,
  message: string,
  requestId: string,
  hint?: string,
): void {
  send(res, status, requestId, errorBody(code, message, requestId, hint));
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function createApp() {
  return createServer(async (req, res) => {
    const requestId = newRequestId();
    const url = new URL(req.url ?? "/", "http://localhost");
    const method = req.method ?? "GET";

    try {
      if (method === "GET" && url.pathname === "/health") {
        send(res, 200, requestId, { status: "ok", requestId });
        return;
      }

      if (method === "GET" && url.pathname === "/v1/restaurants") {
        send(res, 200, requestId, {
          restaurants: RESTAURANTS.map((r) => ({ id: r.id, name: r.name, cuisine: r.cuisine })),
          requestId,
        });
        return;
      }

      const menuMatch = url.pathname.match(/^\/v1\/restaurants\/([A-Za-z0-9_-]+)\/menu$/);
      if (method === "GET" && menuMatch) {
        const restaurant = findRestaurant(menuMatch[1]!);
        if (!restaurant) {
          sendError(res, 404, "restaurant_not_found", "No restaurant with that id.", requestId, "List restaurants with GET /v1/restaurants.");
          return;
        }
        send(res, 200, requestId, { restaurantId: restaurant.id, menu: restaurant.menu, requestId });
        return;
      }

      if (method === "POST" && url.pathname === "/v1/orders") {
        const body = await readJson(req);
        if (!isRecord(body)) {
          sendError(res, 400, "invalid_json", "Request body must be JSON.", requestId, "Send Content-Type: application/json with a JSON body.");
          return;
        }
        const restaurantId = body.restaurantId;
        const items = body.items;
        if (typeof restaurantId !== "string" || restaurantId === "") {
          sendError(res, 400, "missing_field", "restaurantId is required.", requestId, "Get a restaurant id from GET /v1/restaurants.");
          return;
        }
        const restaurant = findRestaurant(restaurantId);
        if (!restaurant) {
          sendError(res, 404, "restaurant_not_found", "No restaurant with that id.", requestId);
          return;
        }
        if (!Array.isArray(items) || items.length === 0) {
          sendError(res, 400, "invalid_items", "items must be a non-empty array of {itemId, qty}.", requestId, "Pick itemIds from GET /v1/restaurants/{id}/menu.");
          return;
        }
        const lines: OrderLine[] = [];
        for (const raw of items) {
          const entry = raw as OrderItemInput;
          if (!isRecord(raw) || typeof entry.itemId !== "string" || !Number.isInteger(entry.qty) || entry.qty < 1) {
            sendError(res, 400, "invalid_items", "Each item needs itemId (string) and qty (integer >= 1).", requestId);
            return;
          }
          const menuItem = restaurant.menu.find((m) => m.id === entry.itemId);
          if (!menuItem) {
            sendError(res, 400, "item_not_found", `Item ${entry.itemId} is not on this restaurant's menu.`, requestId);
            return;
          }
          lines.push({
            itemId: menuItem.id,
            name: menuItem.name,
            qty: entry.qty,
            unitPriceCents: menuItem.priceCents,
            lineTotalCents: menuItem.priceCents * entry.qty,
          });
        }
        const subtotalCents = lines.reduce((s, l) => s + l.lineTotalCents, 0);
        const taxCents = Math.round(subtotalCents * TAX_RATE);
        const order: Order = {
          id: `ord_${randomBytes(6).toString("hex")}`,
          restaurantId: restaurant.id,
          lines,
          subtotalCents,
          taxCents,
          totalCents: subtotalCents + taxCents,
          status: "pending_payment",
          createdAt: new Date().toISOString(),
        };
        orders.set(order.id, order);
        send(res, 201, requestId, { order, requestId });
        return;
      }

      const orderMatch = url.pathname.match(/^\/v1\/orders\/([A-Za-z0-9_-]+)$/);
      if (method === "GET" && orderMatch) {
        const order = orders.get(orderMatch[1]!);
        if (!order) {
          sendError(res, 404, "order_not_found", "No order with that id.", requestId, "Create one with POST /v1/orders.");
          return;
        }
        send(res, 200, requestId, { order, requestId });
        return;
      }

      const payMatch = url.pathname.match(/^\/v1\/orders\/([A-Za-z0-9_-]+)\/pay$/);
      if (method === "POST" && payMatch) {
        const order = orders.get(payMatch[1]!);
        if (!order) {
          sendError(res, 404, "order_not_found", "No order with that id.", requestId);
          return;
        }
        if (order.status !== "pending_payment") {
          sendError(res, 409, "order_not_payable", `Order is already ${order.status}.`, requestId, "Only pending_payment orders can be paid.");
          return;
        }
        const body = await readJson(req);
        if (!isRecord(body) || typeof body.cardNumber !== "string" || !/^\d{13,19}$/.test(body.cardNumber)) {
          sendError(res, 400, "invalid_card", "cardNumber must be a 13-19 digit test card number.", requestId, `Use ${TEST_CARDS.AUTHORIZED} to authorize or ${TEST_CARDS.DECLINED} to see a decline.`);
          return;
        }
        const cardNumber = body.cardNumber;
        if (cardNumber !== TEST_CARDS.AUTHORIZED && cardNumber !== TEST_CARDS.DECLINED) {
          sendError(res, 400, "unknown_card", "This simulator only recognizes its two test card numbers.", requestId, `Use ${TEST_CARDS.AUTHORIZED} to authorize or ${TEST_CARDS.DECLINED} to see a decline.`);
          return;
        }
        if (cardNumber === TEST_CARDS.DECLINED) {
          order.status = "failed";
          sendError(res, 402, "card_declined", "The test card was declined. No money moved.", requestId, "Create a new order and pay with the authorized test card.");
          return;
        }
        order.status = "paid";
        order.payment = {
          authorizationCode: `auth_${randomBytes(4).toString("hex")}`,
          chargedCents: order.totalCents,
          last4: cardNumber.slice(-4),
        };
        send(res, 200, requestId, { order, requestId });
        return;
      }

      sendError(res, 404, "not_found", "No route matches this method and path.", requestId, "See the README quickstart for the available routes.");
    } catch (err) {
      if (err instanceof Error && err.message === "invalid_json") {
        sendError(res, 400, "invalid_json", "Request body must be valid JSON.", requestId);
        return;
      }
      sendError(res, 500, "internal_error", "Something went wrong.", requestId);
    }
  });
}

const PORT = Number(process.env.PORT ?? 4242);
if (process.argv[1]?.endsWith("server.ts")) {
  createApp().listen(PORT, () => {
    console.log(`Simulated restaurant API listening on http://localhost:${PORT}`);
  });
}

export { orders };
