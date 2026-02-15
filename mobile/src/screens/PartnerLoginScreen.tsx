import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";

type Props = { navigation: NativeStackNavigationProp<any> };

export default function PartnerLoginScreen({ navigation }: Props) {
  const { partnerLogin } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError("");
    if (code.length < 6) { setError("Enter the full 6-digit code."); return; }
    setLoading(true);
    try {
      await partnerLogin(code);
    } catch (e: any) {
      setError(e.message || "Invalid or expired code.");
      setCode("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.emoji}>🤝</Text>
        <Text style={styles.title}>Partner Access</Text>
        <Text style={styles.sub}>Enter the 6-digit code your patient shared with you</Text>

        {!!error && <Text style={styles.error}>{error}</Text>}

        <TextInput
          style={styles.codeInput} value={code} onChangeText={setCode}
          placeholder="000000" placeholderTextColor="rgba(99,102,241,0.25)"
          maxLength={6} keyboardType="number-pad" textAlign="center"
        />

        <TouchableOpacity style={[styles.btn, code.length < 6 && styles.btnDisabled]} onPress={onSubmit} disabled={loading || code.length < 6}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Connect as Partner</Text>}
        </TouchableOpacity>

        <View style={styles.info}>
          <Text style={styles.infoText}>ℹ️ Don't have a code? Ask your patient to generate one from their dashboard.</Text>
        </View>

        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <Text style={styles.link}>← Back to Sign In</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
   page: { flex: 1, backgroundColor: "#fce7f3" },
   scroll: { flexGrow: 1, justifyContent: "center", padding: 28 },
   emoji: { fontSize: 48, textAlign: "center", marginBottom: 8 },
   title: { fontSize: 26, fontWeight: "700", color: "#9d174d", textAlign: "center", marginBottom: 4 },
   sub: { fontSize: 15, color: "#db2777", textAlign: "center", marginBottom: 32 },
   error: { backgroundColor: "rgba(244,63,94,0.15)", color: "#e11d48", padding: 12, borderRadius: 10, marginBottom: 16, fontSize: 14, textAlign: "center", overflow: "hidden" },
   codeInput: { backgroundColor: "rgba(219,39,119,0.1)", borderWidth: 2, borderColor: "rgba(219,39,119,0.25)", borderRadius: 16, padding: 20, color: "#9d174d", fontSize: 36, fontWeight: "700", letterSpacing: 12, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },
   btn: { backgroundColor: "#db2777", paddingVertical: 16, borderRadius: 14, marginTop: 28, alignItems: "center" },
   btnDisabled: { opacity: 0.5 },
   btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
   info: { backgroundColor: "rgba(225,29,72,0.08)", borderWidth: 1, borderColor: "rgba(225,29,72,0.3)", borderRadius: 12, padding: 14, marginTop: 24 },
   infoText: { color: "#be185d", fontSize: 13, lineHeight: 20 },
   back: { marginTop: 20, alignItems: "center" },
   link: { color: "#9d174d", fontSize: 14, fontWeight: "500" },
});
