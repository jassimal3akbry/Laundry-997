// Arabic first (Bahraini tone), English second. One dictionary — screens call t("key").
import type { Lang, Slot } from "./types";

const ar = {
  appName: "مغسلة 997", tagline: "نظافة ترتاح لها 💙",
  loginTitle: "حياك الله في مغسلة 997", loginSub: "طلباتك، باقتك، وحجز الاستلام من البيت — كلها في مكان واحد.",
  loginHow1: "اضغط الزر — يفتح لك واتساب برسالة جاهزة", loginHow2: "أرسل الرسالة كما هي (فيها رمز دخولك)", loginHow3: "ارجع هنا — تدخل تلقائياً ✅",
  loginBtn: "الدخول عبر واتساب", loginWaiting: "ننتظر رسالتك على واتساب…", loginResend: "ما فتح واتساب؟ اضغط هنا", loginCode: "رمز الدخول",
  loginExpired: "انتهت صلاحية الرمز — اضغط الزر مرة ثانية", loginErr: "تعذّر الاتصال — تأكد من الإنترنت وحاول مرة ثانية", loginPrivacy: "رقمك يُستخدم فقط لعرض طلباتك. لا نشاركه مع أحد.",
  tabHome: "الرئيسية", tabOrders: "طلباتي", tabBook: "احجز", tabPrices: "الأسعار", tabAccount: "حسابي",
  hello: "هلا والله", morning: "صباح الخير", evening: "مساء الخير",
  debtBanner: "عليك مبلغ متبقي", creditBanner: "لك رصيد عندنا", activeOrders: "طلباتك الحالية", noActive: "ما عندك طلبات حالياً",
  bookPickup: "احجز استلام من البيت", bookSub: "نجي ناخذ ملابسك ونرجعها نظيفة لين بابك", prices: "الأسعار والباقات", chatUs: "كلمنا على واتساب",
  myPackage: "باقتي", piecesLeft: "قطعة متبقية", of: "من", expires: "تنتهي", noExpiry: "بدون تاريخ انتهاء", freeTrips: "توصيلات مجانية", forPackage: "للباقة", perMonth: "شهرياً",
  pending: "طلبات بانتظار التأكيد", pickupReq: "استلام من البيت", dropReq: "توصيل الطلب", awaiting: "بانتظار تأكيد المحل", confirmedReq: "تم التأكيد ✓",
  st_received: "قيد التنظيف", st_ready: "جاهز للاستلام", st_delivered: "تم التسليم", st_cancelled: "ملغي",
  step1: "استلمنا", step2: "نغسل ونكوي", step3: "جاهز", step4: "تم التسليم",
  order: "طلب", pcs: "قطعة", owed: "المتبقي", paid: "مدفوع ✓", payLater: "على الحساب", total: "الإجمالي", fromPackage: "من الباقة 🎟",
  urgent: "مستعجل ⚡", items: "القطع", payment: "الدفع", timeline: "مراحل الطلب", receipt: "الإيصال", openReceipt: "فتح الإيصال",
  deliverHome: "وصّلوه لي البيت", deliveryOnWay: "خرج للتوصيل 🛵", deliveryPending: "بيوصلك للبيت", deliveryDone: "وُصّل ✓",
  rate: "قيّم الطلب", rateThanks: "مشكور على تقييمك 🌷", rateNote: "ملاحظة (اختياري)", send: "إرسال",
  allOrders: "كل الطلبات", noOrders: "ما عندك طلبات للحين — احجز أول استلام من البيت 👇",
  area: "المنطقة", areaPh: "مثال: الرفاع", address: "العنوان", addressPh: "مجمع، طريق، منزل / شقة", useLocation: "📍 استخدم موقعي الحالي", locationSet: "✓ تم تحديد موقعك",
  locationDenied: "ما قدرنا نحدد موقعك — اكتب العنوان", day: "اليوم", time: "الوقت", deliverBack: "نرجّعها لك البيت بعد التنظيف", notes: "ملاحظة للمندوب (اختياري)", notesPh: "مثال: اتصل قبل الوصول",
  confirmBooking: "تأكيد الحجز", booked: "أبشر! وصل طلبك ✅", bookedSub: "بيأكد لك المحل الموعد على واتساب قريباً.", already: "عندك موعد استلام مسجّل من قبل — ما يحتاج تحجز مرة ثانية 👍",
  today: "اليوم", tomorrow: "بكرة",
  slot_morning: "صباحاً 8–12", slot_noon: "ظهراً 12–4", slot_evening: "مساءً 4–8", slot_night: "ليلاً 8–12",
  feeNote: "رسوم المشوار", freeWithPkg: "مجاني لعملاء الباقات", search: "ابحث عن قطعة…", packages: "الباقات", subscribe: "اشترك عبر واتساب", perPiece: "للقطعة",
  days: "يوم", trips: "توصيلات", bonus: "هدية", servicesAll: "الكل",
  account: "حسابي", phone: "الجوال", balance: "الرصيد", language: "اللغة", logout: "تسجيل الخروج", logoutQ: "متأكد تبي تطلع من حسابك؟", yes: "نعم", no: "لا",
  shopInfo: "عن المحل", hours: "ساعات العمل", callShop: "اتصل بالمحل", privacy: "الخصوصية", version: "الإصدار",
  retry: "إعادة المحاولة", offline: "ما في اتصال بالإنترنت", loading: "لحظة…", error: "صار خطأ — حاول مرة ثانية", signInAgain: "سجّل دخولك مرة ثانية",
  bd: "د.ب", close: "إغلاق", back: "رجوع", requestSent: "أبشر! وصل طلب التوصيل ✅",
  beforeDiscount: "قبل الخصم", discountVal: "الخصم", finalTotal: "الإجمالي النهائي", paidSoFar: "المدفوع", dueNow: "المطلوب دفعه",
  loyaltyCard: "بطاقة الولاء", points: "نقطة", worth: "تساوي", toNext: "باقي", forTier: "للفئة", commitment: "التزامك بالدفع",
  loyaltyHow: "كل 1 د.ب تدفعها = {perBD} نقطة · كل {rp} نقطة = {rv} د.ب رصيد. اطلب الاستبدال من المحل أو على واتساب.", redeem: "استبدال النقاط على واتساب",
};
type Dict = typeof ar;
const en: Dict = {
  appName: "997 Laundry", tagline: "Clean you can trust 💙",
  loginTitle: "Welcome to 997 Laundry", loginSub: "Your orders, your package and home pickup — all in one place.",
  loginHow1: "Tap the button — WhatsApp opens with a ready message", loginHow2: "Send it as is (it carries your sign-in code)", loginHow3: "Come back here — you're signed in ✅",
  loginBtn: "Sign in with WhatsApp", loginWaiting: "Waiting for your WhatsApp message…", loginResend: "WhatsApp didn't open? Tap here", loginCode: "Sign-in code",
  loginExpired: "The code expired — tap the button again", loginErr: "Couldn't connect — check the internet and try again", loginPrivacy: "Your number is used only to show your orders. We never share it.",
  tabHome: "Home", tabOrders: "Orders", tabBook: "Book", tabPrices: "Prices", tabAccount: "Account",
  hello: "Hi", morning: "Good morning", evening: "Good evening",
  debtBanner: "Amount remaining", creditBanner: "Your credit with us", activeOrders: "Your current orders", noActive: "No orders in progress",
  bookPickup: "Book a home pickup", bookSub: "We collect your clothes and bring them back clean", prices: "Prices & packages", chatUs: "Chat with us on WhatsApp",
  myPackage: "My package", piecesLeft: "pieces left", of: "of", expires: "Expires", noExpiry: "No expiry", freeTrips: "free deliveries", forPackage: "for the package", perMonth: "a month",
  pending: "Waiting for confirmation", pickupReq: "Home pickup", dropReq: "Order delivery", awaiting: "Waiting for the shop to confirm", confirmedReq: "Confirmed ✓",
  st_received: "Being cleaned", st_ready: "Ready for pickup", st_delivered: "Delivered", st_cancelled: "Cancelled",
  step1: "Received", step2: "Washing & ironing", step3: "Ready", step4: "Delivered",
  order: "Order", pcs: "pcs", owed: "Remaining", paid: "Paid ✓", payLater: "On account", total: "Total", fromPackage: "From package 🎟",
  urgent: "Urgent ⚡", items: "Items", payment: "Payment", timeline: "Order progress", receipt: "Receipt", openReceipt: "Open receipt",
  deliverHome: "Deliver it to my home", deliveryOnWay: "Out for delivery 🛵", deliveryPending: "Will be delivered home", deliveryDone: "Delivered ✓",
  rate: "Rate this order", rateThanks: "Thanks for your rating 🌷", rateNote: "Note (optional)", send: "Send",
  allOrders: "All orders", noOrders: "No orders yet — book your first home pickup 👇",
  area: "Area", areaPh: "e.g. Riffa", address: "Address", addressPh: "Block, road, house / flat", useLocation: "📍 Use my current location", locationSet: "✓ Location set",
  locationDenied: "Couldn't get your location — type the address", day: "Day", time: "Time", deliverBack: "Deliver back home after cleaning", notes: "Note for the driver (optional)", notesPh: "e.g. call before arriving",
  confirmBooking: "Confirm booking", booked: "Done! Your request is in ✅", bookedSub: "The shop will confirm the time on WhatsApp shortly.", already: "You already have a pickup booked — no need to book again 👍",
  today: "Today", tomorrow: "Tomorrow",
  slot_morning: "Morning 8–12", slot_noon: "Afternoon 12–4", slot_evening: "Evening 4–8", slot_night: "Night 8–12",
  feeNote: "Trip fee", freeWithPkg: "free for package customers", search: "Search for an item…", packages: "Packages", subscribe: "Subscribe on WhatsApp", perPiece: "per piece",
  days: "days", trips: "deliveries", bonus: "Gift", servicesAll: "All",
  account: "Account", phone: "Phone", balance: "Balance", language: "Language", logout: "Sign out", logoutQ: "Sign out of your account?", yes: "Yes", no: "No",
  shopInfo: "About the shop", hours: "Opening hours", callShop: "Call the shop", privacy: "Privacy", version: "Version",
  retry: "Try again", offline: "No internet connection", loading: "One moment…", error: "Something went wrong — try again", signInAgain: "Please sign in again",
  bd: "BD", close: "Close", back: "Back", requestSent: "Done! Delivery request sent ✅",
  beforeDiscount: "Before discount", discountVal: "Discount", finalTotal: "Final total", paidSoFar: "Paid", dueNow: "Amount to pay",
  loyaltyCard: "Loyalty card", points: "points", worth: "worth", toNext: "", forTier: "more to reach", commitment: "Payment commitment",
  loyaltyHow: "Every 1 BD you pay = {perBD} points · every {rp} points = {rv} BD credit. Ask the shop or on WhatsApp to redeem.", redeem: "Redeem on WhatsApp",
};
export type TKey = keyof Dict;
export const DICT: Record<Lang, Dict> = { ar, en };
export const slotKey = (s: Slot | string) => (`slot_${s}` as TKey);
export const money = (n: number, lang: Lang) => `${(Math.round((Number(n) || 0) * 1000) / 1000).toFixed(3)} ${DICT[lang].bd}`;
export function dayLabel(ymd: string, lang: Lang, today: string) {
  if (!ymd) return "";
  if (ymd === today) return DICT[lang].today;
  const t = new Date(today + "T12:00:00Z"); t.setUTCDate(t.getUTCDate() + 1);
  if (ymd === t.toISOString().slice(0, 10)) return DICT[lang].tomorrow;
  try { return new Date(ymd + "T12:00:00Z").toLocaleDateString(lang === "ar" ? "ar-BH" : "en-GB", { weekday: "long", day: "numeric", month: "numeric", timeZone: "UTC" }); } catch { return ymd; }
}
export function bhToday() {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bahrain", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
export function fmtDate(iso: string, lang: Lang) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleString(lang === "ar" ? "ar-BH" : "en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Bahrain" }); } catch { return iso.slice(0, 16); }
}
