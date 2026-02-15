import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import PartnerDashboardScreen from "../screens/PartnerDashboardScreen";

const Stack = createNativeStackNavigator();

export default function PartnerStack() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="PartnerDashboard" component={PartnerDashboardScreen} />
        </Stack.Navigator>
    );
}
