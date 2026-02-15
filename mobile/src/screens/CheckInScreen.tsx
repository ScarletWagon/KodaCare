import React, { useState, useRef } from "react";
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  Switch, StyleSheet, ActivityIndicator, Animated, Modal,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { api, CheckInPayload } from "../services/api";

const healthOptions = ["Excellent", "Good", "Fair", "Poor"];

const symptomOptions = [
  "Fatigue",
  "Headache",
  "Nausea",
  "Dizziness",
  "Muscle aches",
  "Difficulty sleeping",
  "Changes in appetite",
];

export default function CheckInScreen() {
  const { token } = useAuth();

  const [checkInData, setCheckInData] = useState<CheckInPayload>({
    currentFeeling: "",
    overallHealth: "",
    hasRash: false,
    rashDetails: "",
    skinConcerns: "",
    otherSymptoms: [],
    additionalConcerns: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const update = <K extends keyof CheckInPayload>(field: K, value: CheckInPayload[K]) => {
    setCheckInData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleSymptom = (symptom: string) => {
    setCheckInData((prev) => {
      const symptoms = prev.otherSymptoms.includes(symptom)
        ? prev.otherSymptoms.filter((s) => s !== symptom)
        : [...prev.otherSymptoms, symptom];
      return { ...prev, otherSymptoms: symptoms };
    });
  };

  const resetForm = () => {
    setCheckInData({
      currentFeeling: "",
      overallHealth: "",
      hasRash: false,
      rashDetails: "",
      skinConcerns: "",
      otherSymptoms: [],
      additionalConcerns: "",
    });
  };

  const playSuccessAnimation = () => {
    setShowSuccess(true);
    scaleAnim.setValue(0);
    opacityAnim.setValue(0);
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, friction: 4, tension: 60, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
      Animated.delay(2000),
      Animated.timing(opacityAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(() => {
      setShowSuccess(false);
      resetForm();
    });
  };

  const onSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      await api.submitCheckIn(token!, checkInData);
      playSuccessAnimation();
    } catch (e: any) {
      setError(e.message || "Failed to submit check-in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.page} contentContainerStyle={styles.scroll}>
        <Text style={styles.heading}>💬  Daily Check-In</Text>

        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* ── How are you feeling? ──────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How are you feeling today?</Text>
          <TextInput
            style={styles.textArea}
            multiline
            numberOfLines={3}
            placeholder="Describe how you're feeling..."
            placeholderTextColor="#b4637a"
            value={checkInData.currentFeeling}
            onChangeText={(t) => update("currentFeeling", t)}
          />
        </View>

        {/* ── Overall Health ───────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Physical Health</Text>
          <Text style={styles.label}>How is your overall health?</Text>
          <View style={styles.chipRow}>
            {healthOptions.map((opt) => {
              const active = checkInData.overallHealth === opt.toLowerCase();
              return (
                <TouchableOpacity
                  key={opt}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => update("overallHealth", opt.toLowerCase())}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {opt}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Rash / Skin ─────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Skin Health</Text>

          <View style={styles.switchRow}>
            <Text style={styles.label}>Any rashes or skin irritations?</Text>
            <Switch
              value={checkInData.hasRash}
              onValueChange={(v) => update("hasRash", v)}
              trackColor={{ false: "rgba(219,39,119,0.2)", true: "#db2777" }}
              thumbColor="#fff"
            />
          </View>

          {checkInData.hasRash && (
            <TextInput
              style={styles.textArea}
              multiline
              numberOfLines={3}
              placeholder="Describe location, size, color, duration..."
              placeholderTextColor="#b4637a"
              value={checkInData.rashDetails}
              onChangeText={(t) => update("rashDetails", t)}
            />
          )}

          <Text style={[styles.label, { marginTop: 14 }]}>Other skin concerns?</Text>
          <TextInput
            style={styles.textAreaSmall}
            multiline
            numberOfLines={2}
            placeholder="Dryness, discoloration, new moles, etc."
            placeholderTextColor="#b4637a"
            value={checkInData.skinConcerns}
            onChangeText={(t) => update("skinConcerns", t)}
          />
        </View>

        {/* ── Other Symptoms ──────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Other Symptoms</Text>
          <View style={styles.chipRow}>
            {symptomOptions.map((symptom) => {
              const active = checkInData.otherSymptoms.includes(symptom);
              return (
                <TouchableOpacity
                  key={symptom}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => toggleSymptom(symptom)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {symptom}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Additional Concerns ─────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Anything Else?</Text>
          <TextInput
            style={styles.textArea}
            multiline
            numberOfLines={3}
            placeholder="Any other health concerns to note..."
            placeholderTextColor="#b4637a"
            value={checkInData.additionalConcerns}
            onChangeText={(t) => update("additionalConcerns", t)}
          />
        </View>

        {/* ── Submit ──────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={onSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Submit Check-In</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Success overlay with teddy ✅ ────────────── */}
      <Modal transparent visible={showSuccess} animationType="none">
        <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
          <Animated.View style={[styles.successCard, { transform: [{ scale: scaleAnim }] }]}>
            <Text style={styles.teddyEmoji}>🧸</Text>
            <Text style={styles.checkEmoji}>✅</Text>
            <Text style={styles.successTitle}>Check-In Complete!</Text>
            <Text style={styles.successSub}>
              Great job taking care of your health today.
            </Text>
          </Animated.View>
        </Animated.View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#fce7f3" },
  scroll: { padding: 24, paddingBottom: 40 },

  heading: {
    fontSize: 26,
    fontWeight: "700",
    color: "#9d174d",
    textAlign: "center",
    marginBottom: 24,
    marginTop: 16,
    textShadowColor: "#fff",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },

  errorBox: { backgroundColor: "rgba(244,63,94,0.15)", padding: 12, borderRadius: 10, marginBottom: 16 },
  errorText: { color: "#e11d48", fontSize: 14, fontWeight: "500" },

  section: {
    backgroundColor: "rgba(255,255,255,0.45)",
    borderWidth: 1,
    borderColor: "rgba(219,39,119,0.15)",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: "#db2777", marginBottom: 14 },
  label: { fontSize: 14, fontWeight: "500", color: "#9d174d", marginBottom: 8 },

  textArea: {
    backgroundColor: "rgba(219,39,119,0.08)",
    borderWidth: 1, borderColor: "rgba(219,39,119,0.2)",
    borderRadius: 12, padding: 14,
    fontSize: 15, color: "#1f2937",
    minHeight: 80, textAlignVertical: "top",
  },
  textAreaSmall: {
    backgroundColor: "rgba(219,39,119,0.08)",
    borderWidth: 1, borderColor: "rgba(219,39,119,0.2)",
    borderRadius: 12, padding: 14,
    fontSize: 15, color: "#1f2937",
    minHeight: 56, textAlignVertical: "top",
  },

  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 20, borderWidth: 1,
    borderColor: "rgba(219,39,119,0.25)",
    backgroundColor: "rgba(219,39,119,0.06)", marginBottom: 4,
  },
  chipActive: { backgroundColor: "#db2777", borderColor: "#db2777" },
  chipText: { color: "#9d174d", fontSize: 14, fontWeight: "500" },
  chipTextActive: { color: "#fff" },

  btn: { backgroundColor: "#db2777", paddingVertical: 16, borderRadius: 14, alignItems: "center", marginTop: 8 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  // ── Success overlay ────────────────────────────
  overlay: {
    flex: 1,
    backgroundColor: "rgba(252,231,243,0.92)",
    justifyContent: "center",
    alignItems: "center",
  },
  successCard: {
    backgroundColor: "#fff",
    borderRadius: 28,
    padding: 40,
    alignItems: "center",
    shadowColor: "#db2777",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 10,
  },
  teddyEmoji: { fontSize: 72, marginBottom: 4 },
  checkEmoji: { fontSize: 36, marginBottom: 16 },
  successTitle: { fontSize: 22, fontWeight: "700", color: "#db2777", marginBottom: 8 },
  successSub: { fontSize: 15, color: "#9d174d", textAlign: "center", lineHeight: 22, fontWeight: "500" },
});