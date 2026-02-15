import React, { useState, useRef, useCallback } from "react";
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity,
    ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { api, AuraResponse } from "../services/api";

interface Message {
    id: string;
    role: "user" | "bear";
    text: string;
    action?: AuraResponse["action"];
}

export default function TextLogScreen() {
    const navigation = useNavigation();
    const { token } = useAuth();
    const [messages, setMessages] = useState<Message[]>([
        {
            id: "welcome",
            role: "bear",
            text: "Hey there! 🐻 I'm Barnaby — tell me what's going on and I'll log it for you. How are you feeling?",
        },
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [logged, setLogged] = useState(false);
    const scrollRef = useRef<ScrollView>(null);

    // Check if user has sent at least one message (something to log)
    const hasUserMessages = messages.some((m) => m.role === "user");

    const send = useCallback(async () => {
        const text = input.trim();
        if (!text || !token || loading) return;

        const userMsg: Message = { id: Date.now().toString(), role: "user", text };
        setMessages((prev) => [...prev, userMsg]);
        setInput("");
        setLoading(true);

        try {
            const res = await api.processAuraText(token, text);
            const bearMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: "bear",
                text: res.mascot_response,
                action: res.action,
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
                            text: `✅ Logged "${res.condition_name}" to your Health Horizon! You can keep chatting or head back. 🐻`,
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
                    text: `Oops, something went wrong: ${e.message}. Try again? 🐻`,
                },
            ]);
        } finally {
            setLoading(false);
        }
    }, [input, token, loading]);

    const handleForceLog = useCallback(async () => {
        if (!token || loading || logged) return;
        setLoading(true);

        try {
            // Build conversation history from messages (skip the welcome message)
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
                action: res.action,
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
                            text: `✅ Logged "${res.condition_name}" to your Health Horizon! You can keep chatting or head back. 🐻`,
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
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={0}
        >
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backText}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.title}>✍️ Text Log</Text>
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

            {/* Chat */}
            <ScrollView
                ref={scrollRef}
                style={styles.chat}
                contentContainerStyle={{ paddingBottom: 20 }}
                onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            >
                {messages.map((m) => (
                    <View
                        key={m.id}
                        style={[
                            styles.bubble,
                            m.role === "user" ? styles.userBubble : styles.bearBubble,
                        ]}
                    >
                        {m.role === "bear" && <Text style={styles.bearLabel}>🐻 Barnaby</Text>}
                        <Text style={m.role === "user" ? styles.userText : styles.bearText}>
                            {m.text}
                        </Text>
                    </View>
                ))}
                {loading && (
                    <View style={[styles.bubble, styles.bearBubble]}>
                        <ActivityIndicator color="#db2777" size="small" />
                        <Text style={styles.thinkingText}>Barnaby is thinking...</Text>
                    </View>
                )}
            </ScrollView>

            {/* Input */}
            <View style={styles.inputRow}>
                <TextInput
                    style={styles.input}
                    placeholder="Describe your symptoms…"
                    placeholderTextColor="#b4637a"
                    value={input}
                    onChangeText={setInput}
                    multiline
                    returnKeyType="send"
                    onSubmitEditing={send}
                    editable={!loading}
                />
                <TouchableOpacity
                    style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
                    onPress={send}
                    disabled={!input.trim() || loading}
                >
                    <Text style={styles.sendText}>↑</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
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

    bubble: {
        maxWidth: "82%",
        borderRadius: 18,
        padding: 14,
        marginBottom: 10,
    },
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

    inputRow: {
        flexDirection: "row",
        alignItems: "flex-end",
        paddingHorizontal: 12,
        paddingVertical: 10,
        paddingBottom: 30,
        backgroundColor: "rgba(255,255,255,0.6)",
        borderTopWidth: 1,
        borderTopColor: "rgba(219,39,119,0.15)",
    },
    input: {
        flex: 1,
        backgroundColor: "rgba(219,39,119,0.08)",
        borderWidth: 1,
        borderColor: "rgba(219,39,119,0.2)",
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        color: "#1f2937",
        fontSize: 15,
        maxHeight: 100,
    },
    sendBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#db2777",
        alignItems: "center",
        justifyContent: "center",
        marginLeft: 8,
    },
    sendBtnDisabled: { opacity: 0.4 },
    sendText: { color: "#fff", fontSize: 20, fontWeight: "700" },
});
