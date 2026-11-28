// One order at a glance: number, status, a 4-step progress bar, pieces, and what is still owed.
import React from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Badge, Card, Row, T, useDir } from "./ui";
import { C, F } from "../lib/theme";
import { useSession } from "../lib/session";
import { money } from "../lib/i18n";
import type { Order } from "../lib/types";

export function stepOf(o: Order) {
  if (o.status === "delivered") return 3;
  if (o.status === "ready") return o.delivery && o.delivery.drop && o.delivery.status === "onway" ? 2.5 : 2;
  return 1;
}
export function statusColor(o: Order): [string, string] {
  if (o.status === "ready") return [C.green, C.greenSoft];
  if (o.status === "delivered") return [C.muted, "#eef2f5"];
  if (o.status === "cancelled") return [C.red, C.redSoft];
  return [C.blue, C.soft];
}

export function Progress({ o }: { o: Order }) {
  const { t } = useSession(); const { row } = useDir();
  const s = stepOf(o), labels = [t("step1"), t("step2"), t("step3"), t("step4")];
  return (
    <View style={{ marginTop: 12 }}>
      <View style={{ flexDirection: row, alignItems: "center" }}>
        {labels.map((_, i) => (
          <React.Fragment key={i}>
            <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: i <= s ? C.blue : C.line, borderWidth: i === Math.floor(s) ? 3 : 0, borderColor: C.soft }} />
            {i < 3 ? <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < s ? C.blue : C.line, marginHorizontal: 2 }} /> : null}
          </React.Fragment>
        ))}
      </View>
      <View style={{ flexDirection: row, justifyContent: "space-between", marginTop: 6 }}>
        {labels.map((l, i) => <T key={i} size={11} w={i === Math.floor(s) ? "b" : "r"} color={i <= s ? C.navy : C.faint}>{l}</T>)}
      </View>
    </View>
  );
}

// الفاتورة: قبل الخصم · الخصم · الإجمالي النهائي · المدفوع · المطلوب دفعه
export function BillLines({ o }: { o: Order }) {
  const { t, lang } = useSession();
  const line = (label: string, value: string, color?: string, bold?: boolean) => (
    <Row style={{ justifyContent: "space-between", marginTop: 4 }}><T size={13} color={C.muted}>{label}</T><T size={bold ? 15 : 13} w={bold ? "x" : "b"} color={color || C.text}>{value}</T></Row>
  );
  const disc = Number(o.discount) || 0;
  return (
    <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 8 }}>
      {disc > 0 ? line(t("beforeDiscount"), money(o.before || o.total + disc, lang)) : null}
      {disc > 0 ? line(`🏷 ${t("discountVal")}`, `−${money(disc, lang)}`, C.green) : null}
      {line(disc > 0 ? t("finalTotal") : t("total"), money(o.total, lang), undefined, true)}
      {o.owed > 0 && (o.paidSoFar || 0) > 0 ? line(t("paidSoFar"), money(o.paidSoFar || 0, lang), C.green) : null}
      {o.owed > 0 ? line(`💳 ${t("dueNow")}`, money(o.owed, lang), C.red, true)
        : <Row style={{ justifyContent: "flex-end", marginTop: 4 }}>{o.payLater ? <T size={13} color={C.orange}>{t("payLater")}</T> : <T size={13} color={C.green} w="b">{t("paid")}</T>}</Row>}
    </View>
  );
}

export function OrderCard({ o }: { o: Order }) {
  const { t, lang } = useSession();
  const [fg, bg] = statusColor(o);
  const dlv = o.delivery && o.delivery.drop ? (o.delivery.status === "onway" ? t("deliveryOnWay") : o.delivery.status === "done" ? t("deliveryDone") : t("deliveryPending")) : "";
  return (
    <Card onPress={() => router.push(`/order/${o.id}`)} style={{ marginBottom: 12 }}>
      <Row style={{ justifyContent: "space-between" }}>
        <T w="x" size={17}>{t("order")} #{o.number}</T>
        <Badge label={t(`st_${o.status}` as any)} color={fg} bg={bg} />
      </Row>
      <Row style={{ marginTop: 6, flexWrap: "wrap" }} gap={10}>
        <T color={C.muted} size={14}>👕 {o.pieces} {t("pcs")}</T>
        {o.urgent ? <T color={C.orange} size={14} w="b">{t("urgent")}</T> : null}
        {o.fromPackage && o.total === 0 ? <T color={C.green} size={14} w="b">{t("fromPackage")}</T> : null}
        {dlv ? <T color={C.blue} size={14}>{dlv}</T> : null}
      </Row>
      {o.status !== "delivered" && o.status !== "cancelled" ? <Progress o={o} /> : null}
      <BillLines o={o} />
    </Card>
  );
}
