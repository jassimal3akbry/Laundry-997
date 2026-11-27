import React from "react";
import { Text } from "react-native";
import { Tabs } from "expo-router/tabs";
import { useSession } from "../../lib/session";
import { C, F } from "../../lib/theme";

// Home opens first even when the Arabic order puts it last in the list
export const unstable_settings = { initialRouteName: "index" };

const icon = (e: string) => function TabIcon({ focused }: { focused: boolean }) {
  return <Text style={{ fontSize: 21, opacity: focused ? 1 : 0.55 }}>{e}</Text>;
};

export default function TabsLayout() {
  const { t, rtl } = useSession();
  const tabs = [
    { name: "index", title: t("tabHome"), e: "🏠" }, { name: "orders", title: t("tabOrders"), e: "🧺" }, { name: "book", title: t("tabBook"), e: "🚚" },
    { name: "prices", title: t("tabPrices"), e: "🏷️" }, { name: "account", title: t("tabAccount"), e: "👤" },
  ];
  // Arabic: the first tab sits on the right
  const order = rtl ? [...tabs].reverse() : tabs;
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: C.navy, tabBarInactiveTintColor: C.faint,
      tabBarLabelStyle: { fontFamily: F.b, fontSize: 12 }, tabBarStyle: { height: 64, paddingTop: 6, paddingBottom: 8, borderTopColor: C.line, backgroundColor: "#fff" } }}>
      {order.map((x) => <Tabs.Screen key={x.name} name={x.name} options={{ title: x.title, tabBarIcon: icon(x.e) }} />)}
    </Tabs>
  );
}
