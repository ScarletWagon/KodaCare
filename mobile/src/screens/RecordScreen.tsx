import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";

export default function RecordScreen() {
  const navigation = useNavigation<any>();

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>📝 Record a Log</Text>
      <Text style={styles.subtitle}>
        Choose how you'd like to tell Barnaby what's going on
      </Text>

      {/* Voice */}
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => navigation.navigate("VoiceLog")}
      >
        <Text style={styles.cardIcon}>🎙️</Text>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>Voice Log</Text>
          <Text style={styles.cardDesc}>Hold to record — Barnaby listens & logs</Text>
        </View>
        <Text style={styles.arrow}>›</Text>
      </TouchableOpacity>

      {/* Camera */}
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => navigation.navigate("CameraLog")}
      >
        <Text style={styles.cardIcon}>📷</Text>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>Camera Log</Text>
          <Text style={styles.cardDesc}>Take a photo — rash, skin change, etc.</Text>
        </View>
        <Text style={styles.arrow}>›</Text>
      </TouchableOpacity>

      {/* Text */}
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => navigation.navigate("TextLog")}
      >
        <Text style={styles.cardIcon}>✍️</Text>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>Text Log</Text>
          <Text style={styles.cardDesc}>Chat with Barnaby — type your symptoms</Text>
        </View>
        <Text style={styles.arrow}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fce7f3",
    paddingHorizontal: 24,
    paddingTop: 70,
  },
  heading: {
    fontSize: 26,
    fontWeight: "700",
    color: "#9d174d",
    textAlign: "center",
    marginBottom: 6,
    textShadowColor: "#fff",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  subtitle: {
    fontSize: 14,
    color: "#9d174d",
    textAlign: "center",
    marginBottom: 28,
    fontWeight: "500",
  },

  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.45)",
    borderWidth: 1,
    borderColor: "rgba(219,39,119,0.15)",
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
  },
  cardIcon: { fontSize: 32, marginRight: 14 },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 17, fontWeight: "700", color: "#db2777", marginBottom: 3 },
  cardDesc: { fontSize: 13, color: "#9d174d", lineHeight: 18 },
  arrow: { fontSize: 24, color: "#db2777", fontWeight: "300" },
});