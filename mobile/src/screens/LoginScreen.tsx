import React, { useState, useRef } from "react";
import teddy from "../../assets/teddy.png";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  Image, Animated, LayoutChangeEvent,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";

const SLIDER_PADDING = 4;

type Props = { navigation: NativeStackNavigationProp<any> };

export default function LoginScreen({ navigation }: Props) {
  const { login, partnerLogin } = useAuth();

  /* ── shared state ─────────────────────────────────── */
  const [mode, setMode] = useState<"patient" | "partner">("patient");
  const slideAnim = useRef(new Animated.Value(0)).current;   // 0 = patient, 1 = partner
  const [trackWidth, setTrackWidth] = useState(0);

  /* ── patient state ────────────────────────────────── */
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  /* ── partner state ────────────────────────────────── */
  const [code, setCode] = useState("");

  /* ── common ───────────────────────────────────────── */
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  /* ── animations ───────────────────────────────────── */
  const toggleMode = (next: "patient" | "partner") => {
    if (next === mode) return;
    setMode(next);
    setError("");
    Animated.spring(slideAnim, {
      toValue: next === "partner" ? 1 : 0,
      useNativeDriver: false,
      friction: 8,
      tension: 70,
    }).start();
  };

  const thumbWidth = trackWidth > 0 ? (trackWidth - SLIDER_PADDING * 2) / 2 : 0;
  const thumbLeft = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [SLIDER_PADDING, SLIDER_PADDING + thumbWidth],
  });

  const onTrackLayout = (e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
  };

  /* ── handlers ─────────────────────────────────────── */
  const onPatientLogin = async () => {
    setError("");
    if (!email || !password) { setError("Email and password are required."); return; }
    setLoading(true);
    try {
      await login(email, password);
    } catch (e: any) {
      setError(e.message || "Login failed.");
      setPassword("");
    } finally {
      setLoading(false);
    }
  };

  const onPartnerLogin = async () => {
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

  /* ── render ───────────────────────────────────────── */
  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Logo */}
        <View style={styles.logoContainer}>
          <Image source={teddy} style={styles.logoImage} />
          <Text style={styles.logo}>KodaCare</Text>
        </View>

        {/* ── Glass Slider Toggle ───────────────────── */}
        <View style={styles.sliderTrack} onLayout={onTrackLayout}>
          {/* animated glass thumb */}
          {thumbWidth > 0 && (
            <Animated.View
              style={[
                styles.sliderThumb,
                { width: thumbWidth, left: thumbLeft },
              ]}
            />
          )}
          <TouchableOpacity
            style={styles.sliderHalf}
            activeOpacity={0.7}
            onPress={() => toggleMode("patient")}
          >
            <Text style={[styles.sliderLabel, mode === "patient" && styles.sliderLabelActive]}>
              🩺  Patient
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.sliderHalf}
            activeOpacity={0.7}
            onPress={() => toggleMode("partner")}
          >
            <Text style={[styles.sliderLabel, mode === "partner" && styles.sliderLabelActive]}>
              🤝  Partner
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Error ─────────────────────────────────── */}
        {!!error && <Text style={styles.error}>{error}</Text>}

        {/* ── Patient Form ──────────────────────────── */}
        {mode === "patient" && (
          <View>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input} value={email} onChangeText={setEmail}
              placeholder="you@email.com" placeholderTextColor="#b4637a"
              autoCapitalize="none" keyboardType="email-address"
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input} value={password} onChangeText={setPassword}
              placeholder="Enter your password" placeholderTextColor="#b4637a"
              secureTextEntry
            />

            <TouchableOpacity style={styles.btn} onPress={onPatientLogin} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Sign In</Text>}
            </TouchableOpacity>

            <View style={styles.links}>
              <TouchableOpacity onPress={() => navigation.navigate("ForgotPassword")}>
                <Text style={styles.link}>Forgot password?</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate("Register")}>
                <Text style={styles.link}>Create account</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Partner Form ──────────────────────────── */}
        {mode === "partner" && (
          <View>
            <Text style={styles.partnerHint}>Enter the 6-digit code your patient shared</Text>

            <TextInput
              style={styles.codeInput} value={code} onChangeText={setCode}
              placeholder="000000" placeholderTextColor="rgba(157,23,77,0.25)"
              maxLength={6} keyboardType="number-pad" textAlign="center"
            />

            <TouchableOpacity
              style={[styles.btn, code.length < 6 && styles.btnDisabled]}
              onPress={onPartnerLogin}
              disabled={loading || code.length < 6}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Connect as Partner</Text>}
            </TouchableOpacity>

            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                ℹ️  Don't have a code? Ask your patient to generate one from their dashboard.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ── Styles ───────────────────────────────────────────── */
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#fce7f3" },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 28 },

  /* logo */
  logoContainer: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 20 },
  logoImage: { width: 80, height: 80, marginRight: 8 },
  logo: { fontSize: 32, fontWeight: "700", color: "#9d174d" },

  /* ── glass slider ──────────────────────────────────── */
  sliderTrack: {
    flexDirection: "row",
    backgroundColor: "rgba(219,39,119,0.12)",
    borderRadius: 16,
    height: 52,
    marginBottom: 28,
    position: "relative",
    borderWidth: 1,
    borderColor: "rgba(219,39,119,0.18)",
    overflow: "hidden",
  },
  sliderThumb: {
    position: "absolute",
    top: SLIDER_PADDING,
    bottom: SLIDER_PADDING,
    borderRadius: 12,
    /* glassmorphism */
    backgroundColor: "rgba(255,255,255,0.65)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.8)",
    /* shadow for depth */
    shadowColor: "#db2777",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  sliderHalf: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  sliderLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#9d174d",
    opacity: 0.5,
  },
  sliderLabelActive: {
    opacity: 1,
    color: "#9d174d",
  },

  /* ── forms ─────────────────────────────────────────── */
  error: {
    backgroundColor: "rgba(244,63,94,0.15)",
    color: "#e11d48",
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    fontSize: 14,
    textAlign: "center",
    overflow: "hidden",
  },
  label: {
    fontSize: 12, fontWeight: "600", color: "#9d174d",
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, marginTop: 14,
  },
  input: {
    backgroundColor: "rgba(219,39,119,0.1)",
    borderWidth: 1,
    borderColor: "rgba(219,39,119,0.25)",
    borderRadius: 12, padding: 14, color: "#1f2937", fontSize: 16,
  },
  btn: {
    backgroundColor: "#db2777",
    paddingVertical: 16, borderRadius: 14, marginTop: 28, alignItems: "center",
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  /* patient links */
  links: { flexDirection: "row", justifyContent: "space-between", marginTop: 20 },
  link: { color: "#9d174d", fontSize: 14, fontWeight: "500" },

  /* partner extras */
  partnerHint: {
    fontSize: 15, color: "#db2777", textAlign: "center", marginBottom: 24,
  },
  codeInput: {
    backgroundColor: "rgba(219,39,119,0.1)",
    borderWidth: 2, borderColor: "rgba(219,39,119,0.25)",
    borderRadius: 16, padding: 20, color: "#9d174d",
    fontSize: 36, fontWeight: "700", letterSpacing: 12,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  infoBox: {
    backgroundColor: "rgba(225,29,72,0.08)",
    borderWidth: 1, borderColor: "rgba(225,29,72,0.3)",
    borderRadius: 12, padding: 14, marginTop: 24,
  },
  infoText: { color: "#be185d", fontSize: 13, lineHeight: 20 },
});