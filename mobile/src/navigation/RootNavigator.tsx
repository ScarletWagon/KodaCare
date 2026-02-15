import React from "react";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import AuthStack from "./AuthStack";
import PatientStack from "./PatientStack";
import PartnerStack from "./PartnerStack";

export default function RootNavigator() {
  const { token, user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#050a18", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (!token || !user) return <AuthStack />;
  if (user.role === "partner") return <PartnerStack />;
  return <PatientStack />;
}
