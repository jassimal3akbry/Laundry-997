// Order details: progress, items (package items show their value), payment, receipt link, home delivery, rating.
import React, { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSession } from "../../lib/session";
import { api } from "../../lib/api";
import { Badge, Btn, Card, Divider, Empty, Loading, Row, Screen, Section, T } from "../../components/ui";
import { Field } from "../../components/AddressForm";
import { BillLines, Progress, statusColor } from "../../components/OrderCard";
import { C } from "../../lib/theme";
import { fmtDate, money } from "../../lib/i18n";
import type { Order } from "../../lib/types";

export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang, token, home } = useSession();
  const [o, setO] = useState<Order | null>(null), [err, setErr] = useState(false);
  const [stars, setStars] = useState(0), [note, setNote] = useState(""), [rated, setRated] = useState(false), [busy, setBusy] = useState(false);
  const load = useCallback(async () => { try { const r = await api<{ order: Order }>("order", { id }, token); setO(r.order); setErr(false); } catch { setErr(true); } }, [id, token]);
  useEffect(() => { load(); }, [load]);
  const back = () => (router.canGoBack() ? router.back() : router.replace("/orders"));
  const header = <Pressable onPress={back} style={{ marginBottom: 10 }}><T w="b" color={C.blue}>{lang === "ar" ? "→" : "←"} {t("back")}</T></Pressable>;
  if (!o) return <Screen>{header}{err ? <><Empty icon="📡" text={t("error")} /><Btn title={t("retry")} onPress={load} /></> : <Loading />}</Screen>;
  const [fg, bg] = statusColor(o);
  const nm = (it: { ar: string; en: string }) => (lang === "ar" ? it.ar : it.en);
  const pendingDrop = home?.requests.some((r) => r.kind === "dropreq" && r.orderNumber === o.number);
  const rate = async () => { setBusy(true); try { await api("feedback", { orderId: o.id, rating: stars, message: note }, token); setRated(true); } finally { setBusy(false); } };
  return (
    <Screen onRefresh={load}>
      {header}
      <Card>
        <Row style={{ justifyContent: "space-between" }}>
          <T w="x" size={22}>{t("order")} #{o.number}</T>
          <Badge label={t(`st_${o.status}` as any)} color={fg} bg={bg} />
        </Row>
        <T color={C.muted} size={13} style={{ marginTop: 4 }}>{fmtDate(o.createdAt, lang)}{o.urgent ? ` · ${t("urgent")}` : ""}</T>
        {o.status !== "cancelled" ? <Progress o={o} /> : null}
      </Card>

      {o.status === "ready" && !(o.delivery && o.delivery.drop) ? (
        pendingDrop ? <Card tone="soft" style={{ marginTop: 12 }}><T w="b">📦 {t("awaiting")}</T></Card>
          : <Btn icon="🚚" title={t("deliverHome")} onPress={() => router.push(`/deliver/${o.id}`)} style={{ marginTop: 12 }} />
      ) : null}
      {o.delivery && o.delivery.drop ? (
        <Card tone="soft" style={{ marginTop: 12 }}>
          <T w="b">🚚 {o.delivery.status === "onway" ? t("deliveryOnWay") : o.delivery.status === "done" ? t("deliveryDone") : t("deliveryPending")}</T>
          {o.delivery.address ? <T size={13} color={C.muted}>📍 {o.delivery.address}</T> : null}
        </Card>
      ) : null}

      <Section title={`👕 ${t("items")} (${o.pieces})`} />
      <Card style={{ paddingVertical: 8 }}>
        {(o.items || []).map((it, i) => (
          <View key={i}>
            {i ? <Divider /> : null}
            <Row style={{ justifyContent: "space-between" }}>
              <View style={{ flex: 1 }}>
                <T w="b">{it.urgent ? "⚡ " : ""}{nm(it)} × {it.qty}</T>
                <T size={13} color={C.muted}>{lang === "ar" ? it.serviceAr : it.serviceEn}{it.fromPackage ? ` · ${t("fromPackage")}` : ""}</T>
              </View>
              <T w="b" color={it.fromPackage ? C.green : C.navy}>{money(it.value, lang)}</T>
            </Row>
          </View>
        ))}
        {(o.extras || []).map((x, i) => (
          <View key={`x${i}`}><Divider /><Row style={{ justifyContent: "space-between" }}><T>➕ {x.label}</T><T w="b">{x.free ? "✓" : money(x.total, lang)}</T></Row></View>
        ))}
      </Card>

      <Section title={`💳 ${t("payment")}`} />
      <Card>
        {o.packageValue ? <Row style={{ justifyContent: "space-between" }}><T color={C.muted}>{t("fromPackage")}</T><T w="b" color={C.green}>−{money(o.packageValue, lang)}</T></Row> : null}
        {o.urgentFee ? <Row style={{ justifyContent: "space-between" }}><T color={C.muted}>{t("urgent")}</T><T>{money(o.urgentFee, lang)}</T></Row> : null}
        <BillLines o={o} />
      </Card>
      {o.receipt ? <Btn kind="ghost" icon="🧾" title={t("openReceipt")} onPress={() => Linking.openURL(o.receipt)} style={{ marginTop: 12 }} /> : null}

      {o.history && o.history.length ? <>
        <Section title={`🕐 ${t("timeline")}`} />
        <Card>{o.history.map((h, i) => <Row key={i} style={{ justifyContent: "space-between", marginBottom: 4 }}><T>{t(`st_${h.status}` as any)}</T><T color={C.muted} size={13}>{fmtDate(h.at, lang)}</T></Row>)}</Card>
      </> : null}

      {o.status === "delivered" ? <>
        <Section title={`⭐ ${t("rate")}`} />
        <Card>
          {rated ? <T w="b" center color={C.green}>{t("rateThanks")}</T> : <>
            <Row style={{ justifyContent: "center", marginBottom: 12 }} gap={6}>
              {[1, 2, 3, 4, 5].map((n) => <Pressable key={n} onPress={() => setStars(n)} accessibilityLabel={`${n}`}><T size={34} center>{n <= stars ? "★" : "☆"}</T></Pressable>)}
            </Row>
            <Field label={t("rateNote")} value={note} onChange={setNote} multiline />
            <Btn title={t("send")} onPress={rate} disabled={!stars} loading={busy} />
          </>}
        </Card>
      </> : null}
    </Screen>
  );
}
