import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";

export default function VoiceScreen() {
  const navigation = useNavigation();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const startRecording = () => {
    //Implement actual voice recording??
    setIsRecording(true);
    Alert.alert("Recording", "Voice recording started");
  };

  const stopRecording = () => {
    setIsRecording(false);
    Alert.alert("Stopped", "Recording saved");
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={styles.title}>Voice Log</Text>
        <Text style={styles.subtitle}>
          Tap the microphone to start recording
        </Text>

        <View style={styles.recordingArea}>
          <TouchableOpacity
            style={[
              styles.recordButton,
              isRecording && styles.recordButtonActive,
            ]}
            onPress={isRecording ? stopRecording : startRecording}
          >
            <Text style={styles.micIcon}>
              {isRecording ? "⏸️" : "🎙️"}
            </Text>
          </TouchableOpacity>

          {isRecording && (
            <View style={styles.recordingIndicator}>
              <View style={styles.pulse} />
              <Text style={styles.recordingText}>Recording...</Text>
            </View>
          )}
        </View>

        <View style={styles.tipsContainer}>
          <Text style={styles.tipsTitle}>Tips for better results:</Text>
          <Text style={styles.tipText}>• Speak clearly and naturally</Text>
          <Text style={styles.tipText}>• Describe location and severity</Text>
          <Text style={styles.tipText}>• Mention when symptoms started</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050a18",
    padding: 20,
  },
  backButton: {
    marginTop: 40,
    marginBottom: 20,
  },
  backText: {
    color: "#8b5cf6",
    fontSize: 16,
    fontWeight: "600",
  },
  content: {
    flex: 1,
  },
  title: {
    color: "#f1f5f9",
    fontSize: 32,
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: 16,
    marginBottom: 40,
  },
  recordingArea: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  recordButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#8b5cf6",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#8b5cf6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  recordButtonActive: {
    backgroundColor: "#dc2626",
    shadowColor: "#dc2626",
  },
  micIcon: {
    fontSize: 48,
  },
  recordingIndicator: {
    marginTop: 30,
    alignItems: "center",
  },
  pulse: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#dc2626",
    marginBottom: 12,
  },
  recordingText: {
    color: "#dc2626",
    fontSize: 18,
    fontWeight: "600",
  },
  tipsContainer: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: "#8b5cf6",
  },
  tipsTitle: {
    color: "#f1f5f9",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  tipText: {
    color: "#94a3b8",
    fontSize: 14,
    marginBottom: 8,
  },
});