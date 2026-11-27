// Unit tests for src/finance.js — run with: node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const F = require("../src/finance.js");

// Fixed Bahrain times; the suite must pass in any machine time zone
const at = (day, hh = "10:00") => new Date(`${day}T${hh}:00+03:00`).toISOString(); // Bahrain time, whatever the machine zone
const D1 = "2026-10-20", D2 = "2026-10-21";

function order(o) {
  return {
    id: o.id, number: o.id, customerId: o.customerId || "c1", status: o.status || "ready",
    items: o.items || [{ clothingId: "shirt", serviceId: "washiron", qty: 1, total: o.total }],
    createdAt: o.createdAt || at(D1, "09:00"), readyAt: o.readyAt || null, paidAt: o.paidAt || null,
    debtRecorded: !!o.debt, refund: o.refund,
    payment: { method: o.method || "cash", total: o.total, paid: o.paid ?? o.total, outstanding: o.outstanding || 0, vat: o.vat || 0, discount: o.discount || 0, urgentFee: 0 },
  };
}

test("local day is not shifted to UTC after midnight", () => {
  // 01:30 in Bahrain is still the previous day in UTC — must report the local day
  assert.equal(F.localDay(new Date(`${D2}T01:30:00+03:00`)), D2);
});

test("the business day is Bahrain's, whatever time zone the device is set to", () => {
  // 23:30 Bahrain on the 20th = 20:30 UTC = 02:00 next day in India = 16:30 in New York
  assert.equal(F.localDay("2026-10-20T20:30:00Z"), "2026-10-20");
  assert.equal(F.localDay("2026-10-20T21:00:00Z"), "2026-10-21"); // 00:00 Bahrain
  assert.equal(F.addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(F.addDays("2024-03-01", -1), "2024-02-29");
  assert.deepEqual(F.monthBounds("2026-02-10"), { from: "2026-02-01", to: "2026-02-28", key: "2026-02" });
  assert.ok(F.inRange("2026-10-20T20:59:59Z", "2026-10-20", "2026-10-20"));
  assert.ok(!F.inRange("2026-10-20T21:00:00Z", "2026-10-20", "2026-10-20"));
});

test("sales are dated by payment confirmation, not order creation", () => {
  const o = order({ id: "a", total: 1, createdAt: at(D1), paidAt: at(D2) });
  assert.equal(F.summarize({ orders: [o] }, D1, D1).salesTotal, 0);
  assert.equal(F.summarize({ orders: [o] }, D2, D2).salesTotal, 1);
  assert.equal(F.summarize({ orders: [o] }, D2, D2).collectedBy.cash, 1);
});

test("unpaid received orders are not sales; cancelled orders are excluded", () => {
  const s = F.summarize({ orders: [
    order({ id: "a", total: 2, status: "received", method: "unpaid", paid: 0 }),
    order({ id: "b", total: 3, status: "cancelled", paidAt: at(D1) }),
  ] }, D1, D1);
  assert.equal(s.salesTotal, 0);
  assert.equal(s.collected, 0);
  assert.equal(s.ordersCreated, 1);
});

test("order paid from customer balance is a sale but not new cash", () => {
  const s = F.summarize({ orders: [order({ id: "a", total: 1.5, method: "balance", paid: 0, paidAt: at(D1) })] }, D1, D1);
  assert.equal(s.salesTotal, 1.5);
  assert.equal(s.paidFromBalance, 1.5);
  assert.equal(s.collected, 0);
});

test("partial payment + later debt settlement: revenue once, cash counted when received", () => {
  const data = {
    orders: [order({ id: "a", total: 0.8, paid: 0.5, outstanding: 0.3, debt: true, paidAt: at(D1) })],
    ledger: [
      { type: "order_charge", amount: -0.3, method: "unpaid", orderId: "a", customerId: "c1", at: at(D1) },
      { type: "credit", amount: 0.3, method: "cash", customerId: "c1", at: at(D2) },
    ],
  };
  const d1 = F.summarize(data, D1, D1), d2 = F.summarize(data, D2, D2);
  assert.equal(d1.salesTotal, 0.8);
  assert.equal(d1.collected, 0.5);
  assert.equal(d1.creditGiven, 0.3);
  assert.equal(d2.salesTotal, 0);
  assert.equal(d2.collected, 0.3);
  assert.equal(d2.expectedCash, 0.3);
});

test("balance deposits are cash in but not revenue", () => {
  const s = F.summarize({ ledger: [{ type: "credit", amount: 10, method: "benefitpay", at: at(D1) }] }, D1, D1);
  assert.equal(s.salesTotal, 0);
  assert.equal(s.collected, 10);
  assert.equal(s.collectedBy.benefitpay, 10);
  assert.equal(s.expectedCash, 0); // not cash in the drawer
});

test("package sale counts as sales and cash, including old records without a stored price", () => {
  const data = {
    customerPackages: [{ customerId: "c1", purchasedAt: at(D1), price: 12 }],
    ledger: [{ type: "package_purchase", amount: 0, method: "cash", customerId: "c1", at: at(D1) }],
  };
  const s = F.summarize(data, D1, D1);
  assert.equal(s.packageSales, 12);
  assert.equal(s.salesTotal, 12);
  assert.equal(s.expectedCash, 12);
});

test("VAT is separated from net revenue; profit uses net revenue", () => {
  const s = F.summarize({
    orders: [order({ id: "a", total: 1.1, vat: 0.1, paidAt: at(D1) })],
    expenses: [{ amount: 0.2, method: "cash", category: "rent", date: at(D1) }],
    payroll: [{ type: "bonus", amount: 0.1, net: 0.1, date: at(D1) }, { type: "advance", amount: 5, net: -5, date: at(D1) }],
  }, D1, D1);
  assert.equal(s.netRevenue, 1);
  assert.equal(s.profit, 0.8); // 1.000 − 0.200 expenses; bonuses are paid inside the salary expense, not a second cost
  assert.equal(s.advances, 5);
  assert.equal(s.expectedCash, 0.9);
});

test("cash refund on cancellation reduces collected cash on the refund day", () => {
  const o = order({ id: "a", total: 2, status: "cancelled", paidAt: at(D1), refund: { mode: "cash", method: "cash", amount: 2, at: at(D2) } });
  assert.equal(F.summarize({ orders: [o] }, D1, D1).collected, 2);
  assert.equal(F.summarize({ orders: [o] }, D2, D2).collected, -2);
  assert.equal(F.summarize({ orders: [o] }, D1, D2).collected, 0);
  assert.equal(F.summarize({ orders: [o] }, D1, D2).salesTotal, 0);
});

test("snapshot receivables come from customer balances", () => {
  const s = F.snapshot({ customers: [{ balance: -0.3 }, { balance: 2 }, { balance: 0 }], orders: [order({ id: "a", total: 4, status: "received" })] });
  assert.equal(s.receivables, 0.3);
  assert.equal(s.prepaid, 2);
  assert.equal(s.openValue, 4);
});

test("debt allocation: oldest credit order is settled first", () => {
  const orders = [
    order({ id: "old", total: 1, paid: 0, outstanding: 1, debt: true, paidAt: at(D1) }),
    order({ id: "new", total: 2, paid: 0, outstanding: 2, debt: true, paidAt: at(D2) }),
  ];
  assert.deepEqual(F.allocateDebts([{ id: "c1", balance: -2.5 }], orders), { new: 2, old: 0.5 });
  assert.deepEqual(F.allocateDebts([{ id: "c1", balance: 0 }], orders), { new: 0, old: 0 });
});

test("rounding stays at 3 decimals (BHD fils)", () => {
  const orders = Array.from({ length: 10 }, (_, i) => order({ id: "o" + i, total: 0.1, paidAt: at(D1) }));
  assert.equal(F.summarize({ orders }, D1, D1).salesTotal, 1);
});

test("month bounds and day arithmetic", () => {
  assert.deepEqual(F.monthBounds("2026-02-14"), { from: "2026-02-01", to: "2026-02-28", key: "2026-02" });
  assert.equal(F.addDays("2026-03-01", -1), "2026-02-28");
});

test("pay later: ready-but-unpaid order is not a sale until paid at pickup", () => {
  const o = order({ id: "a", total: 1, method: "unpaid", paid: 0, readyAt: at(D1) });
  o.paymentConfirmed = false; o.payLater = true;
  const s1 = F.summarize({ orders: [o] }, D1, D2);
  assert.equal(s1.salesTotal, 0);
  assert.equal(s1.collected, 0);
  assert.equal(F.snapshot({ orders: [o] }).openValue, 1);
  // paid in cash on pickup the next day → sale + cash dated D2
  Object.assign(o, { paymentConfirmed: true, paidAt: at(D2), status: "delivered" });
  Object.assign(o.payment, { method: "cash", paid: 1 });
  assert.equal(F.summarize({ orders: [o] }, D1, D1).salesTotal, 0);
  assert.equal(F.summarize({ orders: [o] }, D2, D2).salesTotal, 1);
  assert.equal(F.summarize({ orders: [o] }, D2, D2).expectedCash, 1);
  assert.equal(F.snapshot({ orders: [o] }).openValue, 0);
});

test("customer file: paid, remaining and total owed per customer", () => {
  const cust = { id: "c1", balance: -0.3 };
  const o1 = order({ id: "o1", total: 0.8, paid: 0.5, outstanding: 0.3, debt: true, paidAt: at(D1), status: "delivered" });
  const o2 = order({ id: "o2", total: 1, method: "unpaid", paid: 0, status: "ready" }); o2.paymentConfirmed = false; o2.payLater = true;
  const o3 = order({ id: "o3", total: 2, method: "unpaid", paid: 0, status: "received" }); o3.paymentConfirmed = false;
  const o4 = order({ id: "o4", total: 0.4, paidAt: at(D1), status: "delivered" });
  const o5 = order({ id: "o5", total: 9, status: "cancelled" });
  const s = F.customerSummary(cust, [o1, o2, o3, o4, o5, order({ id: "x", customerId: "other", total: 5 })]);
  const byId = Object.fromEntries(s.rows.map((r) => [r.order.id, r]));
  assert.equal(s.rows.length, 5);
  assert.deepEqual([byId.o1.paid, byId.o1.remaining, byId.o1.state], [0.5, 0.3, "partial"]);
  assert.deepEqual([byId.o2.remaining, byId.o2.state], [1, "due_now"]);
  assert.deepEqual([byId.o3.remaining, byId.o3.state], [2, "in_progress"]);
  assert.deepEqual([byId.o4.paid, byId.o4.remaining], [0.4, 0]);
  assert.equal(s.ordersCount, 4);
  assert.equal(s.totalSpent, 1.2);
  assert.equal(s.totalPaid, 0.9);
  assert.equal(s.debt, 0.3);
  assert.equal(s.dueNow, 1);
  assert.equal(s.totalOwed, 1.3);
  // after the customer settles the debt, the old order shows fully paid
  const s2 = F.customerSummary({ id: "c1", balance: 0 }, [o1]);
  assert.deepEqual([s2.rows[0].paid, s2.rows[0].remaining, s2.rows[0].state], [0.8, 0, "paid"]);
});

test("arrears: 4 orders (10/10, 8/3, 6/0, 4/2) = 13.000; 5.000 paid on order 2 → order 2 settled, 8.000 left", () => {
  const D = (d) => `2026-10-0${d}T10:00:00.000Z`;
  const mk = (id, total, paid, day) => { const o = order({ id, total, paid, outstanding: F.r3(total - paid), debt: total > paid, paidAt: D(day), status: "delivered", method: paid > 0 ? "cash" : "unpaid" }); o.createdAt = D(day); return o; };
  const os = [mk("o1", 10, 10, 1), mk("o2", 8, 3, 2), mk("o3", 6, 0, 3), mk("o4", 4, 2, 4)];
  const ledger = [];
  let cust = { id: "c1", balance: -13 };
  let s = F.customerSummary(cust, os, ledger);
  const rem = (sum) => Object.fromEntries(sum.rows.map((r) => [r.order.id, r.remaining]));
  assert.equal(s.debt, 13);
  assert.deepEqual(rem(s), { o1: 0, o2: 5, o3: 6, o4: 2 });
  assert.equal(s.totalSpent, 28); assert.equal(s.totalPaid, 15);
  // targeted payment to order 2
  ledger.push({ id: "t1", customerId: "c1", type: "credit", amount: 5, orderId: "o2", settles: true });
  cust = { id: "c1", balance: -8 };
  s = F.customerSummary(cust, os, ledger);
  assert.deepEqual(rem(s), { o1: 0, o2: 0, o3: 6, o4: 2 });
  assert.equal(s.debt, 8);
  assert.equal(F.r3(s.rows.reduce((a, r) => a + r.remaining, 0)), 8, "sum of order remainders equals the customer's debt");
  // untargeted 1.000 settles the oldest open debt first (order 3), never counted twice
  cust = { id: "c1", balance: -7 };
  s = F.customerSummary(cust, os, ledger);
  assert.deepEqual(rem(s), { o1: 0, o2: 0, o3: 5, o4: 2 });
  // a targeted payment to the newest order moves the debt to the older one, total unchanged
  ledger.push({ id: "t2", customerId: "c1", type: "credit", amount: 2, orderId: "o4", settles: true });
  cust = { id: "c1", balance: -5 };
  s = F.customerSummary(cust, os, ledger);
  assert.deepEqual(rem(s), { o1: 0, o2: 0, o3: 5, o4: 0 });
  // reversing a targeted payment restores it
  ledger[1].reversedBy = "r1"; cust = { id: "c1", balance: -7 };
  s = F.customerSummary(cust, os, ledger);
  assert.deepEqual(rem(s), { o1: 0, o2: 0, o3: 5, o4: 2 });
  assert.deepEqual(s.counts, { open: 0, ready: 0, delivered: 4, cancelled: 0 });
});

test("package usage: used pieces come from real orders; cancelled orders give pieces back", () => {
  const cp = { id: "p1", customerId: "c1", name: "Iron 50", totalPieces: 50, remainingPieces: 42, purchasedAt: at(D1) };
  const pkgItem = (qty) => [{ clothingId: "shirt", serviceId: "iron", qty, total: 0, fromPackageId: "p1" }, { clothingId: "thob_cotton", serviceId: "wash", qty: 3, total: 1.2 }];
  const orders = [
    order({ id: "a", total: 1.2, items: pkgItem(5) }),
    order({ id: "b", total: 1.2, items: pkgItem(3), createdAt: at(D2) }),
    order({ id: "c", total: 1.2, items: pkgItem(10), status: "cancelled" }),
  ];
  const [u] = F.packageUsage([cp], orders, "c1");
  assert.equal(u.used, 8);
  assert.equal(u.remaining, 42);
  assert.equal(u.consistent, true);
  assert.deepEqual(u.uses.map((x) => [x.orderId, x.qty]), [["b", 3], ["a", 5]]);
  // stored balance out of sync → flagged
  assert.equal(F.packageUsage([{ ...cp, remainingPieces: 40 }], orders, "c1")[0].consistent, false);
  assert.equal(F.packageUsage([cp], orders, "other").length, 0);
});

test("voided expenses are excluded from expenses, profit and drawer", () => {
  const s = F.summarize({ expenses: [
    { amount: 5, method: "cash", category: "x", date: at(D1) },
    { amount: 50, method: "cash", category: "typo", date: at(D1), voided: true },
  ] }, D1, D1);
  assert.equal(s.expenses, 5);
  assert.equal(s.expectedCash, -5);
});

test("expense categories: groups for operating, salaries, government; old free-text expenses mapped", () => {
  const s = F.summarize({ expenses: [
    { amount: 300, catId: "rent", category: "إيجار المحل", date: at(D1) },
    { amount: 40, category: "كهرباء شهر 9", date: at(D1) },
    { amount: 25, catId: "lmra", category: "هيئة تنظيم سوق العمل (LMRA)", date: at(D1) },
    { amount: 200, catId: "salary", category: "رواتب — Ali", employeeId: "e1", date: at(D1) },
    { amount: 50, catId: "advance", category: "سلفة راتب — Ali", employeeId: "e1", date: at(D1) },
    { amount: 20, category: "مشتريات مخزون", purchaseId: "p1", date: at(D1) },
    { amount: 7, category: "شي غريب", date: at(D1) },
  ] }, D1, D1);
  assert.deepEqual(s.expensesByGroup, { operating: 340, government: 25, salaries: 250, inventory: 20, other: 7 });
  assert.equal(s.expensesByGroupCat.operating.ewa, 40);
  assert.equal(s.salariesByEmployee.e1, 250);
  assert.equal(s.expenses, 642);
});

test("salary due for the month = salary + commission + bonuses − deductions − advances", () => {
  const emp = { id: "e1", salary: 300, commission: 20 };
  const m = "2026-10";
  const payroll = [
    { employeeId: "e1", type: "bonus", amount: 15, date: at(D1) },
    { employeeId: "e1", type: "deduction", amount: 10, date: at(D1) },
    { employeeId: "e1", type: "advance", amount: 50, date: at(D1) },
    { employeeId: "e1", type: "bonus", amount: 99, date: at("2026-09-15") }, // other month
  ];
  const d = F.salaryDue(emp, payroll, [], m);
  assert.deepEqual([d.net, d.gross, d.bonuses, d.advances, d.paid], [275, 325, 15, 50, null]);
  const paidExp = [{ catId: "salary", employeeId: "e1", period: m, amount: 275 }];
  assert.ok(F.salaryDue(emp, payroll, paidExp, m).paid);
});

test("unclosed days: days with activity and no daily closure", () => {
  const data = {
    orders: [order({ id: "a", total: 1, paidAt: at(D1) })],
    expenses: [{ amount: 1, date: at(D2) }, { amount: 5, date: at("2026-10-19"), voided: true }],
  };
  assert.deepEqual(F.unclosedDays(data, [], "2026-10-01", D2), [D1, D2]);
  assert.deepEqual(F.unclosedDays(data, [{ type: "daily", forDate: D1 }], "2026-10-01", D2), [D2]);
});

test("shift summary: only this employee's money inside the shift window", () => {
  const shift = { employeeId: "u1", startAt: at(D1, "08:00"), endAt: at(D1, "16:00"), openingCash: 20 };
  const o1 = order({ id: "a", total: 3, paidAt: at(D1, "09:00") }); o1.paymentById = "u1";
  const o2 = order({ id: "b", total: 2, method: "card", paidAt: at(D1, "10:00") }); o2.paymentById = "u1";
  const o3 = order({ id: "c", total: 9, paidAt: at(D1, "11:00") }); o3.paymentById = "u2"; // other employee
  const o4 = order({ id: "d", total: 4, paidAt: at(D1, "17:00") }); o4.paymentById = "u1"; // after shift
  const o5 = order({ id: "e", total: 1, status: "cancelled", paidAt: at(D1, "09:30"), refund: { mode: "cash", method: "cash", amount: 1, at: at(D1, "12:00"), byId: "u1" } }); o5.paymentById = "u1";
  const data = {
    orders: [o1, o2, o3, o4, o5],
    ledger: [{ type: "credit", amount: 5, method: "cash", byId: "u1", at: at(D1, "13:00") }, { type: "credit", amount: 7, method: "cash", byId: "u2", at: at(D1, "13:00") }],
    expenses: [{ amount: 1.5, method: "cash", byId: "u1", date: at(D1, "14:00") }, { amount: 9, method: "cash", byId: "u1", date: at(D1, "14:00"), voided: true }],
  };
  const s = F.shiftSummary(data, shift);
  assert.equal(s.orders, 2); // a, b (e is cancelled → not a sale)
  assert.equal(s.sales, 5);
  assert.equal(s.inBy.cash, 3 + 1 + 5); // a + e's original payment + deposit
  assert.equal(s.inBy.card, 2);
  assert.equal(s.refunds, 1);
  // drawer: 20 opening + 9 cash in − 1 refund − 1.5 expense = 26.5
  assert.equal(s.expectedCash, 26.5);
  assert.equal(s.hours, 8);
});

test("auto-translation: phrases translated, unknown sentences never half-translated", () => {
  const T = require("../src/translate.js");
  T._force(true);
  assert.equal(T.tr("📦 تسليم الطلب #00005"), "📦 Deliver order #00005");
  assert.equal(T.tr("آجل (دين على العميل)"), "Credit (customer debt)");
  assert.equal(T.tr("لاحقاً"), "Later");
  // a sentence not in the dictionary stays fully Arabic (no mixed words)
  assert.equal(T.tr("جملة غير معروفة فيها العميل"), "جملة غير معروفة فيها العميل");
  // a customer name is not translated
  assert.equal(T.tr("مالك أحمد"), "مالك أحمد");
  // Urdu UI text is never touched
  assert.equal(T.tr("کسٹمر"), "کسٹمر");
  T._force(false);
  assert.equal(T.tr("لاحقاً"), "لاحقاً");
});

// ---------- BHD precision (3 decimals = fils): totals must be exact, never 0.30000000000000004 ----------
test("fils precision: tiny amounts add up exactly", () => {
  const orders = [];
  for (let i = 0; i < 1000; i++) orders.push(order({ id: "f" + i, total: 0.001, paidAt: at(D1, "11:00") }));
  const s = F.summarize({ orders }, D1, D1);
  assert.equal(s.salesTotal, 1);
  assert.equal(s.collectedBy.cash, 1);
});

test("fils precision: typical BHD amounts (0.005, 0.010, 0.125, 1.000, 10.375)", () => {
  const amts = [0.005, 0.01, 0.125, 1, 10.375, 0.1, 0.2];
  const orders = amts.map((t, i) => order({ id: "p" + i, total: t, paidAt: at(D1, "12:00") }));
  const s = F.summarize({ orders }, D1, D1);
  assert.equal(s.salesTotal, 11.815); // 0.005+0.010+0.125+1+10.375+0.1+0.2
  assert.equal(F.r3(0.1 + 0.2), 0.3);
  assert.equal(F.r3(1.0005), 1.001); // half-up at the fils
  assert.equal(F.r3(-1.0005), -1.001); // symmetric for refunds
});

test("fils precision: large monthly totals stay exact", () => {
  const orders = [];
  for (let i = 0; i < 3000; i++) orders.push(order({ id: "m" + i, total: 3.375, paidAt: at(D1, "13:00") }));
  assert.equal(F.summarize({ orders }, D1, D1).salesTotal, 10125); // 3000 × 3.375
});

test("package usage is derived from non-cancelled orders and never exceeds the package", () => {
  const cp = { id: "pk", customerId: "c1", totalPieces: 5, remainingPieces: 1, purchasedAt: at(D1) };
  const used = (q, st) => ({ id: "u" + q + (st || ""), status: st || "received", createdAt: at(D1), items: [{ fromPackageId: "pk", qty: q }] });
  let u = F.packageUsage([cp], [used(2), used(2)], "c1")[0];
  assert.equal(u.remaining, 1); assert.equal(u.consistent, true);
  u = F.packageUsage([cp], [used(2), used(2, "cancelled")], "c1")[0];
  assert.equal(u.remaining, 3); // cancelling returns the pieces
  u = F.packageUsage([cp], [used(4), used(3)], "c1")[0];
  assert.equal(u.remaining, 0); // over-use never shows negative pieces
});

test("loyalty: points on money actually paid (debt earns nothing until settled), redemptions deducted, tier by last-90-day spend", () => {
  const day = "2026-11-20", A = (d) => at(d, "10:00");
  const cs = [{ id: "c1", phone: "97333111111", balance: 0 }, { id: "c2", phone: "97333222222", balance: -6 }];
  const os = [
    order({ id: "1", customerId: "c1", total: 30, paidAt: A("2026-11-01"), createdAt: A("2026-11-01") }),
    order({ id: "2", customerId: "c1", total: 12.5, paidAt: A("2026-10-25"), createdAt: A("2026-10-25") }),
    order({ id: "3", customerId: "c1", total: 50, paidAt: A("2026-06-01"), createdAt: A("2026-06-01") }), // older than 90 days: not in the tier spend
    order({ id: "4", customerId: "c2", total: 10, paid: 4, outstanding: 6, debt: true, paidAt: A("2026-10-20"), createdAt: A("2026-10-20") }),
    order({ id: "5", customerId: "c1", total: 9, status: "cancelled", createdAt: A("2026-11-10") }),
  ];
  const ledger = [
    { id: "t1", customerId: "c1", type: "package_purchase", amount: 0, price: 16.9, at: A("2026-11-05") },
    { id: "t2", customerId: "c1", type: "adjustment", method: "loyalty", amount: 1, loyaltyPoints: 500, at: A("2026-11-06") },
    { id: "t3", customerId: "c2", type: "order_charge", amount: -6, orderId: "4", at: A("2026-10-20") },
  ];
  const st = F.customerStats(cs, os, ledger, [], {}, day);
  // c1: paid 30 + 12.5 + 50 + package 16.9 = 109.4 BD → 1094 points − 500 redeemed
  assert.equal(st.c1.pointsEarned, 1094); assert.equal(st.c1.points, 594); assert.equal(st.c1.pointsValue, 1);
  assert.equal(st.c1.spent90, 59.4); assert.equal(st.c1.tier, "silver"); assert.equal(st.c1.nextTier.id, "gold"); assert.equal(st.c1.nextTier.need, 0.6);
  assert.equal(st.c1.orders, 3, "cancelled orders do not count"); assert.equal(st.c1.commitment, 100); assert.equal(st.c1.cardNo, "997-111111");
  // c2: only the 4 BD actually paid earns points; 6 BD debt for 31 days → weak commitment
  assert.equal(st.c2.pointsEarned, 40); assert.equal(st.c2.owed, 6); assert.equal(st.c2.overdueDays, 31);
  assert.ok(st.c2.commitment < 60, String(st.c2.commitment)); assert.equal(st.c2.commitmentLabel, "late");
  // settings change the rules (points per BD, tiers)
  const st2 = F.customerStats(cs, os, ledger, [], { loyalty: { perBD: 1, tiers: [{ id: "a", ar: "أ", min: 0 }, { id: "b", ar: "ب", min: 50 }] } }, day);
  assert.equal(st2.c1.pointsEarned, 109); assert.equal(st2.c1.tier, "b");
});

test("a late payer drops one tier", () => {
  const day = "2026-11-20", A = (d) => at(d, "10:00");
  const cs = [{ id: "c1", balance: -30 }];
  const os = [order({ id: "1", customerId: "c1", total: 100, paid: 70, outstanding: 30, debt: true, paidAt: A("2026-10-01"), createdAt: A("2026-10-01") })];
  const st = F.customerStats(cs, os, [{ id: "t", customerId: "c1", type: "order_charge", amount: -30, orderId: "1", at: A("2026-10-01") }], [], {}, day);
  assert.equal(st.c1.spent90, 100); assert.equal(st.c1.tier, "silver", "would be gold by spend, but 50 days of debt drop it one tier");
});

test("Bahrain day, seven-day window, and month reconcile cash, card and transfers", () => {
  const daily = "2026-10-21";
  const startOfWeek = F.addDays(daily, -6);
  const month = F.monthBounds(daily);
  const data = {
    orders: [
      order({ id: "cash", total: 12, vat: 1, paidAt: at(daily, "00:30") }),
      order({ id: "card", total: 8, paidAt: at(startOfWeek), method: "card" }),
      order({ id: "transfer", total: 20, paidAt: at(month.from), method: "bank_transfer" }),
    ],
    expenses: [
      { date: at(daily), amount: 2, method: "cash" },
      { date: at(startOfWeek), amount: 3, method: "card" },
      { date: at(month.from), amount: 4, method: "bank_transfer" },
    ],
    ledger: [
      { type: "credit", amount: 4, method: "bank_transfer", at: at(daily) },
      { type: "cash_refund", amount: -1, method: "card", at: at(daily) },
    ],
  };
  const totals = (from, to) => {
    const { salesTotal, expenses, profit, collected, expectedCash } = F.summarize(data, from, to);
    return { salesTotal, expenses, profit, collected, expectedCash };
  };
  assert.deepEqual(totals(daily, daily), { salesTotal: 12, expenses: 2, profit: 9, collected: 15, expectedCash: 10 });
  assert.deepEqual(totals(startOfWeek, daily), { salesTotal: 20, expenses: 5, profit: 14, collected: 23, expectedCash: 10 });
  assert.deepEqual(totals(month.from, month.to), { salesTotal: 40, expenses: 9, profit: 30, collected: 43, expectedCash: 10 });
  const summary = F.summarize(data, month.from, month.to);
  assert.deepEqual(summary.collectedBy, { cash: 12, card: 8, bank_transfer: 24 });
  assert.deepEqual(summary.refundsBy, { card: 1 });
});
