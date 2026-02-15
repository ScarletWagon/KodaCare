
import React, { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";

export default function AccountScreen() {
  const { user, token, logout, refreshUser } = useAuth();

  // Change password state
  const [secAnswer, setSecAnswer] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  // Partner code state
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [codeError, setCodeError] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);
  const [unlinkLoading, setUnlinkLoading] = useState(false);

  // Fetch existing code on mount
  useEffect(() => {
    if (token) {
      api.getMyCode(token).then((res) => {
        if (res.code) setLinkCode(res.code);
      }).catch(() => { });
    }
  }, [token]);

  const onChangePassword = async () => {
    setPwError(""); setPwSuccess("");
    if (!secAnswer || !newPw) { setPwError("Both fields are required."); return; }
    if (newPw.length < 6) { setPwError("Password must be at least 6 characters."); return; }
    setPwLoading(true);
    try {
      await api.resetPassword(user!.email, secAnswer, newPw);
      setPwSuccess("Password updated!");
      setSecAnswer(""); setNewPw("");
    } catch (e: any) {
      setPwError(e.message || "Failed to change password.");
    } finally {
      setPwLoading(false);
    }
  };

  const onGenerateCode = async () => {
    setLinkCode(null); setCodeError("");
    setCodeLoading(true);
    try {
      const res = await api.generateLinkCode(token!);
      setLinkCode(res.code);
      await refreshUser();
    } catch (e: any) {
      setCodeError(e.message || "Failed to generate code.");
    } finally {
      setCodeLoading(false);
    }
  };

  const onUnlink = () => {
    Alert.alert(
      "Unlink Partner",
      "Are you sure you want to unlink your partner? They will lose access and the current code will be deleted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unlink",
          style: "destructive",
          onPress: async () => {
            setUnlinkLoading(true);
            try {
              await api.unlinkPartner(token!);
              setLinkCode(null);
              await refreshUser();
            } catch (e: any) {
              setCodeError(e.message || "Failed to unlink.");
            } finally {
              setUnlinkLoading(false);
            }
          },
        },
      ],
    );
  };

  const onLogout = () => {
    Alert.alert("Sign Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: logout },
    ]);
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.scroll}>
      {/* Profile header */}
      <View style={styles.profileCard}>
        <Text style={styles.avatar}>🩺</Text>
        <Text style={styles.title}>{user?.email}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{user?.role.toUpperCase()}</Text>
        </View>
        <Text style={styles.linked}>
          {user?.linked_id ? "✅ Partner linked" : "❌ No partner linked"}
        </Text>
      </View>

      {/* Change Password */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Change Password</Text>

        {!!pwError && <Text style={styles.error}>{pwError}</Text>}
        {!!pwSuccess && <Text style={styles.success}>{pwSuccess}</Text>}

        <Text style={styles.label}>Security: Mother's maiden name?</Text>
        <TextInput style={styles.input} value={secAnswer} onChangeText={setSecAnswer}
          placeholder="Your answer" placeholderTextColor="#b4637a" />

        <Text style={styles.label}>New Password</Text>
        <TextInput style={styles.input} value={newPw} onChangeText={setNewPw}
          placeholder="Min 6 characters" placeholderTextColor="#b4637a" secureTextEntry />

        <TouchableOpacity style={styles.btn} onPress={onChangePassword} disabled={pwLoading}>
          {pwLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Update Password</Text>}
        </TouchableOpacity>
      </View>

      {/* Generate Partner Code */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Partner Link Code</Text>
        <Text style={styles.hint}>
          {user?.linked_id
            ? "You are linked to a partner. You can unlink to revoke access."
            : "Generate a 6-digit code for your partner to connect."}
        </Text>

        {!!codeError && <Text style={styles.error}>{codeError}</Text>}

        {/* Show existing code if available */}
        {linkCode && (
          <View style={styles.codeBox}>
            <Text style={styles.codeLabel}>
              {user?.linked_id ? "Your partner's access code" : "Share this code with your partner"}
            </Text>
            <Text style={styles.codeValue}>{linkCode}</Text>
          </View>
        )}

        {/* Generate / Regenerate button (only if not linked) */}
        {!user?.linked_id && (
          <TouchableOpacity
            style={styles.btn}
            onPress={onGenerateCode}
            disabled={codeLoading}
          >
            {codeLoading ? <ActivityIndicator color="#fff" /> : (
              <Text style={styles.btnText}>
                {linkCode ? "Regenerate Code" : "Generate Code"}
              </Text>
            )}
          </TouchableOpacity>
        )}

        {/* Unlink button (only if linked) */}
        {!!user?.linked_id && (
          <TouchableOpacity
            style={styles.unlinkBtn}
            onPress={onUnlink}
            disabled={unlinkLoading}
          >
            {unlinkLoading ? <ActivityIndicator color="#fff" /> : (
              <Text style={styles.unlinkText}>Unlink Partner</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Sign Out */}
      <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#fce7f3" },
  scroll: { padding: 24, paddingBottom: 40 },

  profileCard: { alignItems: "center", paddingVertical: 28, marginBottom: 8 },
  avatar: { fontSize: 48, marginBottom: 12 },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#9d174d",
    marginBottom: 8,
    textAlign: "center",
    textShadowColor: "#fff",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  badge: { backgroundColor: "rgba(219,39,119,0.15)", paddingHorizontal: 14, paddingVertical: 4, borderRadius: 20 },
  badgeText: { color: "#db2777", fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },
  linked: { color: "#9d174d", fontSize: 14, marginTop: 10, fontWeight: "500" },

  section: { backgroundColor: "rgba(255,255,255,0.45)", borderWidth: 1, borderColor: "rgba(219,39,119,0.15)", borderRadius: 16, padding: 20, marginBottom: 20 },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: "#db2777", marginBottom: 12 },
  hint: { color: "#9d174d", fontSize: 13, lineHeight: 20, marginBottom: 16 },

  error: { backgroundColor: "rgba(244,63,94,0.15)", color: "#e11d48", padding: 12, borderRadius: 10, marginBottom: 12, fontSize: 14, overflow: "hidden" },
  success: { backgroundColor: "rgba(34,197,94,0.12)", color: "#16a34a", padding: 12, borderRadius: 10, marginBottom: 12, fontSize: 14, overflow: "hidden" },

  label: { fontSize: 12, fontWeight: "600", color: "#9d174d", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, marginTop: 10 },
  input: { backgroundColor: "rgba(219,39,119,0.1)", borderWidth: 1, borderColor: "rgba(219,39,119,0.25)", borderRadius: 12, padding: 14, color: "#1f2937", fontSize: 16 },

  btn: { backgroundColor: "#db2777", paddingVertical: 14, borderRadius: 14, marginTop: 20, alignItems: "center" },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "700", letterSpacing: 0.5 },

  codeBox: { marginTop: 10, padding: 20, backgroundColor: "rgba(219,39,119,0.06)", borderWidth: 2, borderColor: "rgba(219,39,119,0.25)", borderRadius: 16, borderStyle: "dashed", alignItems: "center" },
  codeLabel: { color: "#9d174d", fontSize: 13, marginBottom: 10 },
  codeValue: { fontSize: 40, fontWeight: "700", color: "#db2777", letterSpacing: 10 },

  unlinkBtn: { backgroundColor: "#e11d48", borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 16 },
  unlinkText: { color: "#fff", fontSize: 15, fontWeight: "700", letterSpacing: 0.5 },

  logoutBtn: { backgroundColor: "#e11d48", borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 16 },
  logoutText: { color: "#fff", fontSize: 15, fontWeight: "700", letterSpacing: 0.5 },
});
