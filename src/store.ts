import type { MenuItem, Restaurant } from "./types.ts";

const MENU_A: MenuItem[] = [
  { id: "m001", name: "Margherita Pizza", priceCents: 1400, description: "Tomato, mozzarella, basil" },
  { id: "m002", name: "Pepperoni Pizza", priceCents: 1600, description: "Pepperoni, mozzarella, oregano" },
  { id: "m003", name: "Garlic Knots (4)", priceCents: 600, description: "House dough, garlic butter" },
  { id: "m004", name: "Caesar Salad", priceCents: 1100, description: "Romaine, parmesan, croutons" },
];

const MENU_B: MenuItem[] = [
  { id: "t001", name: "Smash Burger", priceCents: 1350, description: "Double patty, american cheese, pickles" },
  { id: "t002", name: "Chicken Sandwich", priceCents: 1200, description: "Crispy chicken, slaw, chipotle mayo" },
  { id: "t003", name: "Shoestring Fries", priceCents: 550, description: "Sea salt, house ketchup" },
  { id: "t004", name: "Vanilla Shake", priceCents: 700, description: "Vanilla bean, whipped cream" },
];

export const RESTAURANTS: Restaurant[] = [
  { id: "r001", name: "Slice Works", cuisine: "Pizza", menu: MENU_A },
  { id: "r002", name: "Patty Wagon", cuisine: "Burgers", menu: MENU_B },
];

export function findRestaurant(id: string): Restaurant | undefined {
  return RESTAURANTS.find((r) => r.id === id);
}

// Test card numbers for the simulated payment step. No real money moves.
export const TEST_CARDS = {
  AUTHORIZED: "4111111111111111", // always authorizes
  DECLINED: "4000000000000002", // always declines
} as const;
