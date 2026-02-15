import React, { useEffect, useState } from "react";
import {
    View, Text, StyleSheet, ScrollView, ActivityIndicator,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { api, CheckInRecord } from "../services/api";

/* ── Random healthy fallback quips ──────────────────── */
const QUIPS = [
    "🍎 An apple a day keeps the doctor away!",
    "💧 Stay hydrated — your body will thank you!",
    "🧘 Take 5 deep breaths. You've got this.",
    "🌞 A little sunshine goes a long way!",
    "😴 Sleep is a superpower — get your 8 hours!",
    "🥦 Eat your greens! Future-you will be grateful.",
    "🚶 A short walk can clear your mind and lift your spirits.",
    "💪 You're doing amazing. Keep taking care of yourself!",
];

/* ── Personalized tips from check-in ────────────────── */
function buildTips(checkin: CheckInRecord): string[] {
    const tips: string[] = [];
    const h = checkin.overall_health;
    if (h === "poor") tips.push("🩹 You mentioned feeling poor — take it easy and prioritise rest today.");
    else if (h === "fair") tips.push("💛 Feeling fair — a balanced meal and some fresh air might help lift your day.");
    else if (h === "good") tips.push("💚 You're feeling good! Keep the momentum going.");
    else if (h === "excellent") tips.push("🌟 Feeling excellent — what a great day to be alive!");

    if (checkin.has_rash) tips.push("🧴 You reported a rash — keep the area clean and moisturised, and consider seeing a dermatologist.");
    const symptoms = checkin.other_symptoms || [];
    if (symptoms.includes("Fatigue")) tips.push("😴 Fatigue noted — try a power nap or an early bedtime tonight.");
    if (symptoms.includes("Headache")) tips.push("💊 Headache? — Stay hydrated and take a break from bright screens.");
    if (symptoms.includes("Nausea")) tips.push("🫚 Nausea tip — sip on ginger tea or eat small, bland meals.");
    if (symptoms.includes("Dizziness")) tips.push("⚡ Feeling dizzy — make sure you've eaten and had enough water today.");
    if (symptoms.includes("Muscle aches")) tips.push("🧊 Muscle aches — gentle stretching or a warm bath can work wonders.");
    if (symptoms.includes("Difficulty sleeping")) tips.push("🌙 Sleep trouble — try dimming the lights an hour before bed.");
    if (symptoms.includes("Changes in appetite")) tips.push("🍽️ Appetite changes — keep nutritious snacks within reach.");

    return tips;
}

export default function WelcomeScreen() {
    const { user, token } = useAuth();
    const [checkin, setCheckin] = useState<CheckInRecord | null>(null);
    const [loading, setLoading] = useState(true);

    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    const displayName = user?.name || user?.email || "there";

    useEffect(() => {
        if (!token) { setLoading(false); return; }
        (async () => {
            try {
                const res = await api.getMyLatestCheckIn(token);
                setCheckin(res.checkin);
            } catch { }
            setLoading(false);
        })();
    }, [token]);

    const tips = checkin ? buildTips(checkin) : [];
    const randomQuip = QUIPS[Math.floor(Math.random() * QUIPS.length)];

    return (
        <ScrollView style={styles.page} contentContainerStyle={styles.scroll}>
            {/* Hero */}
            <Text style={styles.brand}>❤️ KodaCare</Text>
            <Text style={styles.greeting}>{greeting},</Text>
            <Text style={styles.name}>{displayName}</Text>

            {/* Status card */}
            <View style={styles.card}>
                <Text style={styles.cardEmoji}>🩺</Text>
                <Text style={styles.cardTitle}>Your Health Hub</Text>
                <View style={styles.divider} />
                <Text style={styles.cardText}>
                    {user?.linked_id
                        ? "✅  You're linked with your partner — they can see your check-ins and help support your well-being."
                        : "💡  Generate a partner code in the Account tab to let someone you trust monitor your health."}
                </Text>
            </View>

            {/* Personalised tips / fallback quip */}
            <View style={styles.card}>
                <Text style={styles.cardTitle}>✨ For You Today</Text>
                <View style={styles.divider} />
                {loading ? (
                    <ActivityIndicator color="#db2777" />
                ) : tips.length > 0 ? (
                    tips.map((tip, i) => (
                        <Text key={i} style={styles.cardText}>{tip}</Text>
                    ))
                ) : (
                    <Text style={styles.quip}>{randomQuip}</Text>
                )}
            </View>

            <View style={{ height: 30 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    page: { flex: 1, backgroundColor: "#fce7f3" },
    scroll: { padding: 28, paddingBottom: 40 },

    brand: {
        fontSize: 26,
        fontWeight: "700",
        color: "#db2777",
        textAlign: "center",
        marginTop: 52,
        marginBottom: 4,
        textShadowColor: "#fff",
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
    },
    greeting: {
        fontSize: 22,
        fontWeight: "600",
        color: "#9d174d",
        textAlign: "center",
        marginTop: 20,
    },
    name: {
        fontSize: 24,
        fontWeight: "700",
        color: "#db2777",
        textAlign: "center",
        marginBottom: 28,
    },

    card: {
        backgroundColor: "rgba(255,255,255,0.5)",
        borderWidth: 1,
        borderColor: "rgba(219,39,119,0.15)",
        borderRadius: 20,
        padding: 22,
        marginBottom: 18,
    },
    cardEmoji: { fontSize: 40, textAlign: "center", marginBottom: 10 },
    cardTitle: {
        fontSize: 17,
        fontWeight: "700",
        color: "#db2777",
        marginBottom: 10,
    },
    divider: { height: 1, backgroundColor: "rgba(219,39,119,0.2)", marginBottom: 14 },
    cardText: {
        fontSize: 14,
        color: "#9d174d",
        lineHeight: 22,
        marginBottom: 8,
        fontWeight: "500",
    },
    quip: {
        fontSize: 16,
        color: "#be185d",
        lineHeight: 24,
        textAlign: "center",
        fontWeight: "600",
        fontStyle: "italic",
        paddingVertical: 8,
    },
});
