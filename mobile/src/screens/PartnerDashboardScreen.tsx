import React, { useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  ScrollView, ActivityIndicator, RefreshControl,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { api, CheckInRecord } from "../services/api";

/* ── Suggestion generator ──────────────────────────── */
function getSuggestions(checkin: CheckInRecord): string[] {
  const tips: string[] = [];

  // Feeling
  if (checkin.current_feeling) {
    tips.push(`💬 Your partner shared: "${checkin.current_feeling}" — let them know you read it and care.`);
  }

  // Overall health
  const h = checkin.overall_health;
  if (h === "poor") tips.push("🩹 They're feeling poor — check if they need rest, medication, or a doctor visit.");
  else if (h === "fair") tips.push("💛 They're feeling fair — a small gesture like cooking their favorite meal may help.");
  else if (h === "good") tips.push("💚 They're feeling good! Keep the positive energy going with a fun activity together.");
  else if (h === "excellent") tips.push("🌟 They're feeling excellent — great time to celebrate the good days!");

  // Rash
  if (checkin.has_rash) {
    tips.push("🧴 They reported a rash — consider helping them schedule a dermatology appointment or picking up soothing cream.");
  }

  // Skin concerns
  if (checkin.skin_concerns) {
    tips.push("🪞 Skin concerns noted — help them stay hydrated and remind them about sunscreen.");
  }

  // Symptoms
  const symptoms = checkin.other_symptoms || [];
  if (symptoms.includes("Fatigue")) tips.push("😴 Fatigue reported — prepare a restful evening and avoid over-scheduling.");
  if (symptoms.includes("Headache")) tips.push("💊 Headache noted — dim the lights, offer water, and check in on stress levels.");
  if (symptoms.includes("Nausea")) tips.push("🫚 Nausea reported — ginger tea and light meals can help.");
  if (symptoms.includes("Dizziness")) tips.push("⚡ Dizziness mentioned — make sure they're eating and staying hydrated.");
  if (symptoms.includes("Muscle aches")) tips.push("🧊 Muscle aches — a warm bath or gentle stretching might ease the discomfort.");
  if (symptoms.includes("Difficulty sleeping")) tips.push("🌙 Sleep trouble — create a calming bedtime routine and limit screens before bed.");
  if (symptoms.includes("Changes in appetite")) tips.push("🍽️ Appetite changes — offer nutritious, easy-to-eat snacks throughout the day.");

  // Additional
  if (checkin.additional_concerns) {
    tips.push(`📝 They also noted: "${checkin.additional_concerns}"`);
  }

  return tips;
}

export default function PartnerDashboardScreen() {
  const { user, token, logout } = useAuth();
  const [checkin, setCheckin] = useState<CheckInRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCheckin = async () => {
    if (!token) return;
    try {
      const res = await api.getLatestCheckIn(token);
      setCheckin(res.checkin);
    } catch { }
  };

  useEffect(() => {
    fetchCheckin().finally(() => setLoading(false));
  }, [token]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCheckin();
    setRefreshing(false);
  };

  const onLogout = () => {
    Alert.alert("Sign Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: logout },
    ]);
  };

  const suggestions = checkin ? getSuggestions(checkin) : [];
  const checkinDate = checkin
    ? new Date(checkin.created_at).toLocaleString(undefined, {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    })
    : null;

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#db2777" />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>❤️ KodaCare</Text>
        <TouchableOpacity onPress={onLogout}>
          <Text style={styles.logoutLink}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Profile card */}
      <View style={styles.card}>
        <Text style={styles.emoji}>🤝</Text>
        <Text style={styles.role}>PARTNER</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      {/* Check-in data */}
      {loading ? (
        <ActivityIndicator size="large" color="#db2777" style={{ marginTop: 40 }} />
      ) : !user?.linked_id ? (
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            ❌ Not linked to a patient yet.{"\n\n"}
            Ask your patient to generate a link code and log in with it.
          </Text>
        </View>
      ) : !checkin ? (
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            ✅ You're linked to your patient.{"\n\n"}
            No check-ins yet — once they submit one, their health summary and care suggestions will appear here.
          </Text>
        </View>
      ) : (
        <>
          {/* Latest Check-In */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Latest Check-In</Text>
              <Text style={styles.timestamp}>{checkinDate}</Text>
            </View>
            <View style={styles.divider} />

            <Text style={styles.fieldLabel}>How they're feeling</Text>
            <Text style={styles.fieldValue}>{checkin.current_feeling || "—"}</Text>

            <Text style={styles.fieldLabel}>Overall Health</Text>
            <View style={styles.healthBadge}>
              <Text style={styles.healthBadgeText}>
                {checkin.overall_health ? checkin.overall_health.charAt(0).toUpperCase() + checkin.overall_health.slice(1) : "—"}
              </Text>
            </View>

            {checkin.has_rash && (
              <>
                <Text style={styles.fieldLabel}>⚠️ Rash Reported</Text>
                <Text style={styles.fieldValue}>{checkin.rash_details || "No details provided"}</Text>
              </>
            )}

            {checkin.skin_concerns ? (
              <>
                <Text style={styles.fieldLabel}>Skin Concerns</Text>
                <Text style={styles.fieldValue}>{checkin.skin_concerns}</Text>
              </>
            ) : null}

            {checkin.other_symptoms.length > 0 && (
              <>
                <Text style={styles.fieldLabel}>Symptoms</Text>
                <View style={styles.chipRow}>
                  {checkin.other_symptoms.map((s) => (
                    <View key={s} style={styles.symptomChip}>
                      <Text style={styles.symptomChipText}>{s}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {checkin.additional_concerns ? (
              <>
                <Text style={styles.fieldLabel}>Additional Concerns</Text>
                <Text style={styles.fieldValue}>{checkin.additional_concerns}</Text>
              </>
            ) : null}
          </View>

          {/* Care Suggestions */}
          {suggestions.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>💡 Care Suggestions</Text>
              <View style={styles.divider} />
              {suggestions.map((tip, idx) => (
                <Text key={idx} style={styles.tipText}>{tip}</Text>
              ))}
            </View>
          )}
        </>
      )}

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#fce7f3" },
  scroll: { padding: 24, paddingBottom: 40 },

  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 48, marginBottom: 28 },
  logo: {
    fontSize: 22, fontWeight: "700", color: "#9d174d",
    textShadowColor: "#fff", textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2,
  },
  logoutLink: { color: "#e11d48", fontSize: 14, fontWeight: "700" },

  card: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.45)",
    borderWidth: 1, borderColor: "rgba(219,39,119,0.15)",
    borderRadius: 20, padding: 28, marginBottom: 20,
  },
  emoji: { fontSize: 48, marginBottom: 12 },
  role: {
    fontSize: 12, fontWeight: "700", color: "#fff", letterSpacing: 1,
    backgroundColor: "#db2777", paddingHorizontal: 14, paddingVertical: 4,
    borderRadius: 20, overflow: "hidden", marginBottom: 8,
  },
  email: { fontSize: 16, color: "#9d174d", fontWeight: "600" },

  infoCard: {
    backgroundColor: "rgba(255,255,255,0.45)",
    borderWidth: 1, borderColor: "rgba(219,39,119,0.15)",
    borderRadius: 20, padding: 24,
  },
  infoText: { color: "#be185d", fontSize: 15, lineHeight: 24, fontWeight: "500" },

  section: {
    backgroundColor: "rgba(255,255,255,0.45)",
    borderWidth: 1, borderColor: "rgba(219,39,119,0.15)",
    borderRadius: 16, padding: 20, marginBottom: 16,
  },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: "#db2777", marginBottom: 10 },
  timestamp: { fontSize: 12, color: "#9d174d", fontWeight: "500" },
  divider: { height: 1, backgroundColor: "rgba(219,39,119,0.2)", marginBottom: 14 },

  fieldLabel: { fontSize: 12, fontWeight: "700", color: "#9d174d", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 12, marginBottom: 4 },
  fieldValue: { fontSize: 15, color: "#1f2937", lineHeight: 22, marginBottom: 4, fontWeight: "500" },

  healthBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(219,39,119,0.12)", paddingHorizontal: 14, paddingVertical: 5,
    borderRadius: 12, marginBottom: 4,
  },
  healthBadgeText: { color: "#db2777", fontSize: 14, fontWeight: "600" },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  symptomChip: {
    backgroundColor: "rgba(219,39,119,0.12)",
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 14, marginBottom: 4,
  },
  symptomChipText: { color: "#db2777", fontSize: 13, fontWeight: "600" },

  tipText: { fontSize: 14, color: "#9d174d", lineHeight: 22, marginBottom: 10, fontWeight: "500" },
});