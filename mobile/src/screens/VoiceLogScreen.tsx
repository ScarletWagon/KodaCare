import React, { useState, useRef, useEffect, useCallback } from "react";
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
    useAudioRecorder,
    useAudioRecorderState,
    AudioModule,
    RecordingPresets,
} from "expo-audio";
import { useAuth } from "../context/AuthContext";
import { api, AuraResponse } from "../services/api";

interface Message {
    id: string;
    role: "user" | "bear";
    text: string;
}

export default function VoiceLogScreen() {
    const navigation = useNavigation();
    const { token } = useAuth();
    const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
    const recorderState = useAudioRecorderState(audioRecorder);
    const [loading, setLoading] = useState(false);
    const [logged, setLogged] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: "welcome",
            role: "bear",
            text: "Hey! 🐻 Tap and hold the mic button to record a voice message. Tell me how you're feeling!",
        },
    ]);
    const scrollRef = useRef<ScrollView>(null);

    // Check if user has sent at least one message
    const hasUserMessages = messages.some((m) => m.role === "user");

    // Request permissions on mount
    useEffect(() => {
        (async () => {
            const status = await AudioModule.requestRecordingPermissionsAsync();
            if (!status.granted) {
                setMessages((prev) => [
                    ...prev,
                    { id: Date.now().toString(), role: "bear", text: "I need microphone permission to listen! Please enable it in settings. 🐻" },
                ]);
            }
        })();
    }, []);

    const startRecording = async () => {
        try {
            await audioRecorder.prepareToRecordAsync();
            audioRecorder.record();
        } catch (err) {
            console.error("Failed to start recording", err);
        }
    };

    const stopRecording = async () => {
        if (!token) return;
        setLoading(true);

        try {
            await audioRecorder.stop();
            const uri = audioRecorder.uri;

            if (!uri) throw new Error("No audio recorded");

            setMessages((prev) => [
                ...prev,
                { id: Date.now().toString(), role: "user", text: "🎤 Voice message sent" },
            ]);

            const res: AuraResponse = await api.processAuraAudio(token, uri);

            const bearMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: "bear",
                text: res.mascot_response,
            };
            setMessages((prev) => [...prev, bearMsg]);

            if (res.action === "update_condition") {
                setLogged(true);
                setTimeout(() => {
                    setMessages((prev) => [
                        ...prev,
                        {
                            id: (Date.now() + 2).toString(),
                            role: "bear",
                            text: `✅ Logged "${res.condition_name}" to your Health Horizon! You can record more or head back. 🐻`,
                        },
                    ]);
                }, 800);
            }
        } catch (e: any) {
            setMessages((prev) => [
                ...prev,
                {
                    id: (Date.now() + 1).toString(),
                    role: "bear",
                    text: `Oops: ${e.message}. Try recording again? 🐻`,
                },
            ]);
        } finally {
            setLoading(false);
        }
    };

    const handleForceLog = useCallback(async () => {
        if (!token || loading || logged) return;
        setLoading(true);

        try {
            const history = messages
                .filter((m) => m.id !== "welcome")
                .map((m) => ({
                    role: m.role === "bear" ? "model" : "user",
                    text: m.text,
                }));

            const res = await api.forceLog(token, history);

            const bearMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: "bear",
                text: res.mascot_response,
            };
            setMessages((prev) => [...prev, bearMsg]);

            if (res.action === "update_condition") {
                setLogged(true);
                setTimeout(() => {
                    setMessages((prev) => [
                        ...prev,
                        {
                            id: (Date.now() + 2).toString(),
                            role: "bear",
                            text: `✅ Logged "${res.condition_name}" to your Health Horizon! You can record more or head back. 🐻`,
                        },
                    ]);
                }, 800);
            }
        } catch (e: any) {
            setMessages((prev) => [
                ...prev,
                {
                    id: (Date.now() + 1).toString(),
                    role: "bear",
                    text: `Oops, couldn't log: ${e.message}. Try again? 🐻`,
                },
            ]);
        } finally {
            setLoading(false);
        }
    }, [token, loading, logged, messages]);

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backText}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.title}>🎙️ Voice Log</Text>
                <TouchableOpacity
                    style={[
                        styles.logItBtn,
                        (!hasUserMessages || loading || logged) && styles.logItBtnDisabled,
                    ]}
                    onPress={handleForceLog}
                    disabled={!hasUserMessages || loading || logged}
                >
                    <Text style={[
                        styles.logItText,
                        (!hasUserMessages || loading || logged) && styles.logItTextDisabled,
                    ]}>
                        {logged ? "✅ Logged" : "📋 Log It"}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Messages */}
            <ScrollView
                ref={scrollRef}
                style={styles.chat}
                contentContainerStyle={{ paddingBottom: 20 }}
                onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            >
                {messages.map((m) => (
                    <View
                        key={m.id}
                        style={[styles.bubble, m.role === "user" ? styles.userBubble : styles.bearBubble]}
                    >
                        {m.role === "bear" && <Text style={styles.bearLabel}>🐻 Barnaby</Text>}
                        <Text style={m.role === "user" ? styles.userText : styles.bearText}>{m.text}</Text>
                    </View>
                ))}
                {loading && (
                    <View style={[styles.bubble, styles.bearBubble]}>
                        <ActivityIndicator color="#db2777" size="small" />
                        <Text style={styles.thinkingText}>Barnaby is listening...</Text>
                    </View>
                )}
            </ScrollView>

            {/* Mic Button */}
            <View style={styles.micArea}>
                <Text style={styles.hint}>
                    {recorderState.isRecording ? "Recording… release to send" : "Hold to record"}
                </Text>
                <TouchableOpacity
                    style={[styles.micBtn, recorderState.isRecording && styles.micBtnActive]}
                    onPressIn={startRecording}
                    onPressOut={stopRecording}
                    activeOpacity={0.7}
                    disabled={loading}
                >
                    <Text style={styles.micEmoji}>{recorderState.isRecording ? "⏺️" : "🎙️"}</Text>
                </TouchableOpacity>
                {recorderState.isRecording && <Text style={styles.pulse}>● Recording</Text>}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#fce7f3" },

    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingTop: 56,
        paddingHorizontal: 16,
        paddingBottom: 12,
        backgroundColor: "rgba(255,255,255,0.6)",
        borderBottomWidth: 1,
        borderBottomColor: "rgba(219,39,119,0.15)",
    },
    backBtn: { width: 60 },
    backText: { color: "#db2777", fontSize: 15, fontWeight: "600" },
    title: { color: "#9d174d", fontSize: 18, fontWeight: "700" },
    logItBtn: {
        backgroundColor: "#db2777",
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 8,
    },
    logItBtnDisabled: {
        backgroundColor: "rgba(219,39,119,0.15)",
    },
    logItText: {
        color: "#fff",
        fontSize: 13,
        fontWeight: "700",
    },
    logItTextDisabled: {
        color: "#b4637a",
    },

    chat: { flex: 1, paddingHorizontal: 14, paddingTop: 16 },

    bubble: { maxWidth: "82%", borderRadius: 18, padding: 14, marginBottom: 10 },
    userBubble: {
        alignSelf: "flex-end",
        backgroundColor: "#db2777",
        borderBottomRightRadius: 4,
    },
    bearBubble: {
        alignSelf: "flex-start",
        backgroundColor: "rgba(255,255,255,0.7)",
        borderBottomLeftRadius: 4,
        borderWidth: 1,
        borderColor: "rgba(219,39,119,0.15)",
    },
    bearLabel: { fontSize: 11, color: "#9d174d", marginBottom: 4, fontWeight: "600" },
    userText: { color: "#fff", fontSize: 15, lineHeight: 22 },
    bearText: { color: "#1f2937", fontSize: 15, lineHeight: 22 },
    thinkingText: { color: "#9d174d", fontSize: 13, marginTop: 4, fontStyle: "italic" },

    micArea: {
        alignItems: "center",
        paddingVertical: 20,
        paddingBottom: 40,
        backgroundColor: "rgba(255,255,255,0.6)",
        borderTopWidth: 1,
        borderTopColor: "rgba(219,39,119,0.15)",
    },
    hint: { color: "#9d174d", fontSize: 13, marginBottom: 12 },
    micBtn: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: "rgba(219,39,119,0.1)",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 3,
        borderColor: "#db2777",
    },
    micBtnActive: {
        backgroundColor: "#db2777",
        borderColor: "#be185d",
        transform: [{ scale: 1.1 }],
    },
    micEmoji: { fontSize: 36 },
    pulse: {
        color: "#ef4444",
        fontSize: 13,
        fontWeight: "600",
        marginTop: 10,
    },
});
