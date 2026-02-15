import React, { useRef, useEffect } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { View, Text, Animated, Dimensions, StyleSheet, Image } from "react-native";
import WelcomeScreen from "../screens/WelcomeScreen";
import LogScreen from "../screens/LogScreen";
import RecordScreen from "../screens/RecordScreen";
import CheckInScreen from "../screens/CheckInScreen";
import AccountScreen from "../screens/AccountScreen";

const Tab = createBottomTabNavigator();
const TAB_COUNT = 5;
const SCREEN_W = Dimensions.get("window").width;
const TAB_W = SCREEN_W / TAB_COUNT;

/* eslint-disable @typescript-eslint/no-var-requires */
const logIcon = require("../../assets/icon_log.png");
const checkinIcon = require("../../assets/icon_checkin.png");
/* eslint-enable */

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  if (label === "Log") {
    return <Image source={logIcon} style={[styles.iconImage, { opacity: focused ? 1 : 0.5 }]} />;
  }
  if (label === "Check In") {
    return <Image source={checkinIcon} style={[styles.iconImage, { opacity: focused ? 1 : 0.5 }]} />;
  }
  const icons: Record<string, string> = {
    Welcome: "🏠",
    Record: "🎙️",
    Account: "👤",
  };
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>
      {icons[label] || "•"}
    </Text>
  );
}

/* ── Animated rectangle slider behind active tab ────── */
function SliderBar({ index }: { index: number }) {
  const slideX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(slideX, {
      toValue: index * TAB_W,
      friction: 7,
      tension: 90,
      useNativeDriver: true,
    }).start();
  }, [index]);

  return (
    <Animated.View
      style={[
        styles.sliderRect,
        {
          width: TAB_W - 8,
          transform: [{ translateX: Animated.add(slideX, 4) }],
        },
      ]}
    />
  );
}

export default function PatientTabs() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => {
        const idx = props.state.index;
        return (
          <View style={styles.tabContainer}>
            {/* The slider rectangle sits behind everything */}
            <SliderBar index={idx} />

            {/* Tab buttons */}
            <View style={styles.tabRow}>
              {props.state.routes.map((route: any, i: number) => {
                const focused = idx === i;
                return (
                  <View
                    key={route.key}
                    style={styles.tabItem}
                    onTouchEnd={() => {
                      const event = props.navigation.emit({
                        type: "tabPress",
                        target: route.key,
                        canPreventDefault: true,
                      });
                      if (!event.defaultPrevented) {
                        props.navigation.navigate(route.name);
                      }
                    }}
                  >
                    <TabIcon label={route.name} focused={focused} />
                    <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>
                      {route.name}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        );
      }}
    >
      <Tab.Screen name="Welcome" component={WelcomeScreen} />
      <Tab.Screen name="Log" component={LogScreen} />
      <Tab.Screen name="Record" component={RecordScreen} />
      <Tab.Screen name="Check In" component={CheckInScreen} />
      <Tab.Screen name="Account" component={AccountScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  iconImage: { width: 28, height: 28, borderRadius: 6 },

  tabContainer: {
    backgroundColor: "#fce7f3",
    borderTopWidth: 1,
    borderTopColor: "rgba(219,39,119,0.15)",
    paddingBottom: 20,
    paddingTop: 8,
  },

  /* The rectangle that slides behind the active tab */
  sliderRect: {
    position: "absolute",
    top: 4,
    height: 56,
    borderRadius: 14,
    backgroundColor: "rgba(219,39,119,0.13)",
    borderWidth: 1,
    borderColor: "rgba(219,39,119,0.2)",
  },

  tabRow: {
    flexDirection: "row",
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 6,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#9d174d",
    marginTop: 3,
  },
  tabLabelActive: {
    color: "#db2777",
    fontWeight: "700",
  },
});