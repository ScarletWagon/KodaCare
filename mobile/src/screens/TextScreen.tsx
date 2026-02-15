import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";

export default function TextScreen() {
  const navigation = useNavigation();
  const [symptomText, setSymptomText] = useState("");
  const [location, setLocation] = useState("");
  const [severity, setSeverity] = useState("");

  const handleSubmit = () => {
    if (!symptomText.trim()) {
      Alert.alert("Error", "Please describe your symptoms");
      return;
    }
    
    //Submit to API
    Alert.alert("Success", "Symptoms logged successfully");
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Text Log</Text>
        <Text style={styles.subtitle}>
          Write down your symptoms and concerns
        </Text>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Describe your symptoms</Text>
          <TextInput
            style={styles.textArea}
            multiline
            numberOfLines={6}
            placeholder="What are you experiencing?"
            placeholderTextColor="#64748b"
            value={symptomText}
            onChangeText={setSymptomText}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Location (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Where on your body?"
            placeholderTextColor="#64748b"
            value={location}
            onChangeText={setLocation}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Severity (optional)</Text>
          <View style={styles.severityButtons}>
            {['Mild', 'Moderate', 'Severe'].map((level) => (
              <TouchableOpacity
                key={level}
                style={[
                  styles.severityButton,
                  severity === level && styles.severityButtonActive,
                ]}
                onPress={() => setSeverity(level)}
              >
                <Text
                  style={[
                    styles.severityText,
                    severity === level && styles.severityTextActive,
                  ]}
                >
                  {level}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitButtonText}>Submit Log</Text>
        </TouchableOpacity>
      </ScrollView>
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
    color: "#10b981",
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
    marginBottom: 30,
  },
  formGroup: {
    marginBottom: 24,
  },
  label: {
    color: "#f1f5f9",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    color: "#f1f5f9",
    fontSize: 16,
    borderWidth: 2,
    borderColor: "#334155",
  },
  textArea: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    color: "#f1f5f9",
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: "top",
    borderWidth: 2,
    borderColor: "#334155",
  },
  severityButtons: {
    flexDirection: "row",
    gap: 12,
  },
  severityButton: {
    flex: 1,
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#334155",
  },
  severityButtonActive: {
    backgroundColor: "#10b981",
    borderColor: "#10b981",
  },
  severityText: {
    color: "#94a3b8",
    fontSize: 14,
    fontWeight: "600",
  },
  severityTextActive: {
    color: "#f1f5f9",
  },
  submitButton: {
    backgroundColor: "#10b981",
    borderRadius: 12,
    padding: 18,
    alignItems: "center",
    marginTop: 12,
    marginBottom: 40,
  },
  submitButtonText: {
    color: "#f1f5f9",
    fontSize: 18,
    fontWeight: "700",
  },
});