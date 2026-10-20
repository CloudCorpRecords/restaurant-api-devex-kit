// Simulated restaurant ordering and payments API types.
export interface MenuItem {
  id: string;
  name: string;
  priceCents: number;
  description: string;
}

export interface Restaurant {
  id: string;
  name: string;
  cuisine: string;
  menu: MenuItem[];
}

export interface OrderItemInput {
  itemId: string;
  qty: number;
}

export interface OrderLine {
  itemId: string;
  name: string;
  qty: number;
  unitPriceCents: number;
  lineTotalCents: number;
}

export type OrderStatus = "pending_payment" | "paid" | "failed";

export interface Order {
  id: string;
  restaurantId: string;
  lines: OrderLine[];
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  status: OrderStatus;
  payment?: {
    authorizationCode: string;
    chargedCents: number;
    last4: string;
  };
  createdAt: string;
}

// Every error response has this shape. DevEx principle: one shape,
// always, so client code can pattern match instead of guessing.
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    hint?: string;
  };
  requestId: string;
}
