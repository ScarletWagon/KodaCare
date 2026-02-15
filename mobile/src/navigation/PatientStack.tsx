import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import PatientTabs from "./PatientTabs";
import VoiceLogScreen from "../screens/VoiceLogScreen";
import CameraLogScreen from "../screens/CameraLogScreen";
import TextLogScreen from "../screens/TextLogScreen";

const Stack = createNativeStackNavigator();

export default function PatientStack() {
    return (
        <Stack.Navigator
            screenOptions={{
                headerShown: false,
                animation: "fade",
            }}
        >
            <Stack.Screen name="Tabs" component={PatientTabs} />
            <Stack.Screen name="VoiceLog" component={VoiceLogScreen} />
            <Stack.Screen name="CameraLog" component={CameraLogScreen} />
            <Stack.Screen name="TextLog" component={TextLogScreen} />
        </Stack.Navigator>
    );
}
