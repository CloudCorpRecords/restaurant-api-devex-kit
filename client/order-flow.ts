// Independent prototype. Not affiliated with Toast. Simulated API only.
// End to end demo: starts nothing by itself; run `npm start` first, then
// `npm run demo` in another terminal (or let the README quickstart do it).
const BASE = process.env.API_BASE ?? "http://localhost:4242";
const AUTHORIZED_TEST_CARD = "4111111111111111";

async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${(json.error as { code?: string })?.code ?? "unknown"}`);
  }
  return json;
}

async function main() {
  const step = (n: number, label: string) => console.log(`\n[${n}/5] ${label}`);

  step(1, "List restaurants");
  const restaurants = (await api("GET", "/v1/restaurants")) as {
    restaurants: Array<{ id: string; name: string; cuisine: string }>;
  };
  console.log("  found:", restaurants.restaurants.map((r) => r.name).join(", "));
  const restaurantId = restaurants.restaurants[0]!.id;

  step(2, "Get the menu");
  const menu = (await api("GET", `/v1/restaurants/${restaurantId}/menu`)) as {
    menu: Array<{ id: string; name: string; priceCents: number }>;
  };
  console.log("  first item:", menu.menu[0]!.name);

  step(3, "Create an order");
  const orderRes = (await api("POST", "/v1/orders", {
    restaurantId,
    items: [
      { itemId: menu.menu[0]!.id, qty: 1 },
      { itemId: menu.menu[2]!.id, qty: 2 },
    ],
  })) as { order: { id: string; totalCents: number; status: string } };
  const order = orderRes.order;
  console.log(`  order ${order.id}, total $${(order.totalCents / 100).toFixed(2)}, status ${order.status}`);

  step(4, "Pay (simulated test card)");
  const paid = (await api("POST", `/v1/orders/${order.id}/pay`, {
    cardNumber: AUTHORIZED_TEST_CARD,
  })) as { order: { status: string; payment: { authorizationCode: string } } };
  console.log(`  status ${paid.order.status}, auth ${paid.order.payment.authorizationCode}`);

  step(5, "Read the order back");
  const fetched = (await api("GET", `/v1/orders/${order.id}`)) as {
    order: { status: string };
  };
  console.log(`  final status: ${fetched.order.status}`);

  console.log("\nDone. Full order lifecycle completed against the simulated API.");
}

main().catch((err) => {
  console.error("Demo failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
