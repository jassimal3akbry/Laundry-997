export type Lang = "ar" | "en";
export type Slot = "morning" | "noon" | "evening" | "night";
export interface Customer { id: string; name: string; phone: string; area?: string; address?: string }
export interface OrderItem { ar: string; en: string; serviceAr: string; serviceEn: string; qty: number; total: number; fromPackage: boolean; value: number; urgent: boolean }
export interface Order {
  id: string; number: string; status: "received" | "ready" | "delivered" | "cancelled"; createdAt: string; readyAt: string; deliveredAt: string;
  urgent: boolean; pieces: number; total: number; discount?: number; owed: number; paid: boolean; payLater: boolean; fromPackage: boolean;
  before?: number; paidSoFar?: number;
  delivery: { pickup: boolean; drop: boolean; address: string; date: string; slot: string; status: string } | null; receipt: string;
  items?: OrderItem[]; extras?: { label: string; total: number; free: boolean }[]; subtotal?: number; urgentFee?: number;
  history?: { status: string; at: string }[]; packageValue?: number;
}
export interface Pkg { id: string; name: string; service: string; total: number; left: number; expiresAt: string; expired: boolean; trips: number; tripsPeriod: "total" | "month"; purchasedAt: string }
export interface Req { id: string; kind: "pickup" | "dropreq"; date: string; slot: string; address: string; status: string; confirmed: boolean; orderNumber: string }
export interface Loyalty { cardNo: string; points: number; value: number; tier: "bronze" | "silver" | "gold" | "platinum" | string; tierAr: string; tierEn: string; commitment: number; spent90: number; next: { ar: string; en: string; need: number } | null; redeemPoints: number; redeemValue: number; perBD: number }
export interface Home { customer: Customer; balance: number; debt: number; credit: number; active: Order[]; recent: Order[]; packages: Pkg[]; requests: Req[]; owedTotal: number; loyalty?: Loyalty | null }
export interface CatalogItem { id: string; ar: string; en: string; cat: string; prices: Record<string, number> }
export interface CatalogPkg { id: string; name: string; service: string; pieces: number; price: number; perPiece: number; validDays: number; trips: number; tripsPeriod: string; bonus: string; itemsLimited: boolean }
export interface Catalog {
  shop: { nameAr: string; nameEn: string; area: string; address: string; phone: string; hours: string };
  services: { id: string; ar: string; en: string }[]; items: CatalogItem[]; packages: CatalogPkg[];
  delivery: { on: boolean; fee: number; pkgFree: number; pkgFee: number; freeOver: number; slots: Slot[] };
  urgent: { hours: number; normalHours: number };
}
