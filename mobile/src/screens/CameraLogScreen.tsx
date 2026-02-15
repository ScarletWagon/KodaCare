import React, { useState, useRef, useCallback } from "react";
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
    ActivityIndicator, TextInput, Image,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useAuth } from "../context/AuthContext";
import { api, AuraResponse } from "../services/api";

interface Message {
    id: string;
    role: "user" | "bear";
    text: string;
    imageUri?: string;
}

export default function CameraLogScreen() {
    const navigation = useNavigation();
    const { token } = useAuth();
    const [permission, requestPermission] = useCameraPermissions();
    const cameraRef = useRef<CameraView>(null);

    const [photoUri, setPhotoUri] = useState<string | null>(null);
    const [description, setDescription] = useState("");
    const [loading, setLoading] = useState(false);
    const [logged, setLogged] = useState(false);
    const [showCamera, setShowCamera] = useState(true);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: "welcome",
            role: "bear",
            text: "📷 Take a photo of what concerns you — a rash, a skin change, or anything else. I'll take a look and help log it! 🐻",
        },
    ]);
    const scrollRef = useRef<ScrollView>(null);

    // Check if user has sent at least one message
    const hasUserMessages = messages.some((m) => m.role === "user");

    if (!permission) return <View style={styles.container} />;
    if (!permission.granted) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Text style={styles.backText}>← Back</Text>
                    </TouchableOpacity>
                    <Text style={styles.title}>📷 Camera Log</Text>
                    <View style={{ width: 80 }} />
                </View>
                <View style={styles.permBox}>
                    <Text style={styles.permText}>Camera access is needed to take photos</Text>
                    <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
                        <Text style={styles.permBtnText}>Grant Permission</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    const takePhoto = async () => {
        if (!cameraRef.current) return;
        try {
            const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
            if (photo?.uri) {
                setPhotoUri(photo.uri);
                setShowCamera(false);
            }
        } catch (err) {
            console.error("Camera error", err);
        }
    };

    const sendPhoto = async () => {
        if (!photoUri || !token) return;
        setLoading(true);

        setMessages((prev) => [
            ...prev,
            {
                id: Date.now().toString(),
                role: "user",
                text: description || "📸 Photo sent",
                imageUri: photoUri,
            },
        ]);

        try {
            const res: AuraResponse = await api.processAuraImage(token, photoUri, description || undefined);

            setMessages((prev) => [
                ...prev,
                { id: (Date.now() + 1).toString(), role: "bear", text: res.mascot_response },
            ]);

            if (res.action === "update_condition") {
                setLogged(true);
                setTimeout(() => {
                    setMessages((prev) => [
                        ...prev,
                        {
                            id: (Date.now() + 2).toString(),
                            role: "bear",
                            text: `✅ Logged "${res.condition_name}" to your Health Horizon! Take more photos or head back. 🐻`,
                        },
                    ]);
                }, 800);
            }
        } catch (e: any) {
            setMessages((prev) => [
                ...prev,
                { id: (Date.now() + 1).toString(), role: "bear", text: `Oops: ${e.message}. Try again? 🐻` },
            ]);
        } finally {
            setLoading(false);
            setPhotoUri(null);
            setDescription("");
            setShowCamera(true);
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

            setMessages((prev) => [
                ...prev,
                { id: (Date.now() + 1).toString(), role: "bear", text: res.mascot_response },
            ]);

            if (res.action === "update_condition") {
                setLogged(true);
                setTimeout(() => {
                    setMessages((prev) => [
                        ...prev,
                        {
                            id: (Date.now() + 2).toString(),
                            role: "bear",
                            text: `✅ Logged "${res.condition_name}" to your Health Horizon! Take more photos or head back. 🐻`,
                        },
                    ]);
                }, 800);
            }
        } catch (e: any) {
            setMessages((prev) => [
                ...prev,
                { id: (Date.now() + 1).toString(), role: "bear", text: `Oops, couldn't log: ${e.message}. Try again? 🐻` },
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
                <Text style={styles.title}>📷 Camera Log</Text>
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

            {showCamera && !photoUri ? (
                <View style={styles.cameraWrap}>
                    <CameraView ref={cameraRef} style={styles.camera} facing="back" />
                    <TouchableOpacity style={styles.captureBtn} onPress={takePhoto}>
                        <View style={styles.captureInner} />
                    </TouchableOpacity>
                </View>
            ) : photoUri ? (
                <View style={styles.previewWrap}>
                    <Image source={{ uri: photoUri }} style={styles.preview} />
                    <TextInput
                        style={styles.descInput}
                        placeholder="Add a description (optional)…"
                        placeholderTextColor="#b4637a"
                        value={description}
                        onChangeText={setDescription}
                    />
                    <View style={styles.previewActions}>
                        <TouchableOpacity
                            style={styles.retakeBtn}
                            onPress={() => { setPhotoUri(null); setShowCamera(true); }}
                        >
                            <Text style={styles.retakeBtnText}>Retake</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.sendPhotoBtn, loading && { opacity: 0.5 }]}
                            onPress={sendPhoto}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <Text style={styles.sendPhotoBtnText}>Send to Barnaby 🐻</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            ) : null}

            {messages.length > 1 && (
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
                            {m.imageUri && <Image source={{ uri: m.imageUri }} style={styles.thumbImage} />}
                            <Text style={m.role === "user" ? styles.userText : styles.bearText}>{m.text}</Text>
                        </View>
                    ))}
                    {loading && (
                        <View style={[styles.bubble, styles.bearBubble]}>
                            <ActivityIndicator color="#db2777" size="small" />
                            <Text style={styles.thinkingText}>Barnaby is analysing your photo...</Text>
                        </View>
                    )}
                </ScrollView>
            )}
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

    permBox: { flex: 1, justifyContent: "center", alignItems: "center", padding: 40 },
    permText: { color: "#9d174d", fontSize: 16, textAlign: "center", marginBottom: 20 },
    permBtn: { backgroundColor: "#db2777", borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14 },
    permBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

    cameraWrap: { height: 340, position: "relative" },
    camera: { flex: 1 },
    captureBtn: {
        position: "absolute",
        bottom: 20,
        alignSelf: "center",
        width: 72,
        height: 72,
        borderRadius: 36,
        borderWidth: 4,
        borderColor: "#fff",
        alignItems: "center",
        justifyContent: "center",
    },
    captureInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#fff" },

    previewWrap: { padding: 16 },
    preview: { width: "100%", height: 220, borderRadius: 14, marginBottom: 12 },
    descInput: {
        backgroundColor: "rgba(219,39,119,0.08)",
        borderWidth: 1,
        borderColor: "rgba(219,39,119,0.2)",
        borderRadius: 12,
        padding: 14,
        color: "#1f2937",
        fontSize: 15,
        marginBottom: 12,
    },
    previewActions: { flexDirection: "row", gap: 12 },
    retakeBtn: {
        flex: 1,
        backgroundColor: "rgba(219,39,119,0.1)",
        borderWidth: 1,
        borderColor: "rgba(219,39,119,0.2)",
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: "center",
    },
    retakeBtnText: { color: "#9d174d", fontWeight: "600" },
    sendPhotoBtn: {
        flex: 2,
        backgroundColor: "#db2777",
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: "center",
    },
    sendPhotoBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

    chat: { flex: 1, paddingHorizontal: 14, paddingTop: 16 },
    bubble: { maxWidth: "82%", borderRadius: 18, padding: 14, marginBottom: 10 },
    userBubble: { alignSelf: "flex-end", backgroundColor: "#db2777", borderBottomRightRadius: 4 },
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
    thumbImage: { width: 140, height: 100, borderRadius: 10, marginBottom: 8 },
});
