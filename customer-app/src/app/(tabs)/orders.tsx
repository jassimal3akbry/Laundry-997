import React, { useCallback, useEffect, useState } from "react";
import { useSession } from "../../lib/session";
import { api } from "../../lib/api";
import { Btn, Empty, Loading, Screen, T } from "../../components/ui";
import { OrderCard } from "../../components/OrderCard";
import { router } from "expo-router";
import type { Order } from "../../lib/types";

export default function OrdersScreen() {
  const { t, token } = useSession();
  const [orders, setOrders] = useState<Order[] | null>(null), [busy, setBusy] = useState(false), [err, setErr] = useState(false);
  const load = useCallback(() => api<{ orders: Order[] }>("orders", {}, token), [token]);
  useEffect(() => {
    let active = true;
    load().then(
      ({ orders }) => { if (active) { setOrders(orders); setErr(false); } },
      () => { if (active) setErr(true); },
    );
    return () => { active = false; };
  }, [load]);
  const refresh = async () => {
    setBusy(true);
    try { const { orders } = await load(); setOrders(orders); setErr(false); }
    catch { setErr(true); }
    finally { setBusy(false); }
  };
  return (
    <Screen onRefresh={refresh} refreshing={busy}>
      <T w="x" size={26} style={{ marginBottom: 14 }}>{t("tabOrders")}</T>
      {orders === null ? (err ? <><Empty icon="📡" text={t("error")} /><Btn title={t("retry")} onPress={refresh} /></> : <Loading />)
        : orders.length ? orders.map((o) => <OrderCard key={o.id} o={o} />)
        : <><Empty icon="🧺" text={t("noOrders")} /><Btn icon="🚚" title={t("bookPickup")} onPress={() => router.push("/book")} /></>}
    </Screen>
  );
}
