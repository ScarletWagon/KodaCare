import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";

type Props = { navigation: NativeStackNavigationProp<any> };

export default function RegisterScreen({ navigation }: Props) {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onRegister = async () => {
    setError("");
    if (!name || !email || !password || !answer) { setError("All fields are required."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true);
    try {
      await register(name, email, password, answer);
    } catch (e: any) {
      setError(e.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.sub}>Set up your patient profile</Text>

        {!!error && <Text style={styles.error}>{error}</Text>}

        <Text style={styles.label}>Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName}
          placeholder="Your name" placeholderTextColor="#64748b"
          autoCapitalize="words" />

        <Text style={styles.label}>Email</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail}
          placeholder="you@email.com" placeholderTextColor="#64748b"
          autoCapitalize="none" keyboardType="email-address" />

        <Text style={styles.label}>Password</Text>
        <TextInput style={styles.input} value={password} onChangeText={setPassword}
          placeholder="Min 6 characters" placeholderTextColor="#64748b" secureTextEntry />

        <Text style={styles.label}>Security: What is your mother's maiden name?</Text>
        <TextInput style={styles.input} value={answer} onChangeText={setAnswer}
          placeholder="Your answer" placeholderTextColor="#64748b" />

        <TouchableOpacity style={styles.btn} onPress={onRegister} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Create Account</Text>}
        </TouchableOpacity>

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
  title: { fontSize: 26, fontWeight: "700", color: "#9d174d", textAlign: "center", marginBottom: 4 },
  sub: { fontSize: 15, color: "#db2777", textAlign: "center", marginBottom: 32 },
  error: { backgroundColor: "rgba(244,63,94,0.15)", color: "#e11d48", padding: 12, borderRadius: 10, marginBottom: 16, fontSize: 14, overflow: "hidden" },
  label: { fontSize: 12, fontWeight: "600", color: "#9d174d", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: "rgba(219,39,119,0.1)", borderWidth: 1, borderColor: "rgba(219,39,119,0.25)", borderRadius: 12, padding: 14, color: "#1f2937", fontSize: 16 },
  btn: { backgroundColor: "#db2777", paddingVertical: 16, borderRadius: 14, marginTop: 28, alignItems: "center" },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  back: { marginTop: 20, alignItems: "center" },
  link: { color: "#9d174d", fontSize: 14, fontWeight: "500" },
});
