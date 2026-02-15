import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
// import * as ImagePicker from 'expo-image-picker';

export default function CameraScreen() {
  const navigation = useNavigation();
  const [image, setImage] = useState<string | null>(null);

  const takePhoto = async () => {
    //Camera functionality??

    //const result = await ImagePicker.launchCameraAsync({...});
    Alert.alert("Camera", "Camera functionality coming soon");
  };

  const pickImage = async () => {
    //Implement image picker
    //const result = await ImagePicker.launchImageLibraryAsync({...});
    Alert.alert("Gallery", "Image picker coming soon");
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
        <Text style={styles.title}>Camera Log</Text>
        <Text style={styles.subtitle}>
          Take or upload a photo of your concern
        </Text>

        <View style={styles.imageArea}>
          {image ? (
            <Image source={{ uri: image }} style={styles.previewImage} />
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderIcon}>📷</Text>
              <Text style={styles.placeholderText}>No photo selected</Text>
            </View>
          )}
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.actionButton} onPress={takePhoto}>
            <Text style={styles.buttonIcon}>📸</Text>
            <Text style={styles.buttonText}>Take Photo</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={pickImage}>
            <Text style={styles.buttonIcon}>🖼️</Text>
            <Text style={styles.buttonText}>Choose from Gallery</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tipsContainer}>
          <Text style={styles.tipsTitle}>Photo tips:</Text>
          <Text style={styles.tipText}>• Use good lighting</Text>
          <Text style={styles.tipText}>• Get close to the affected area</Text>
          <Text style={styles.tipText}>• Take multiple angles if needed</Text>
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
    color: "#06b6d4",
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
  imageArea: {
    flex: 1,
    backgroundColor: "#1e293b",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 20,
  },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderIcon: {
    fontSize: 64,
    marginBottom: 12,
  },
  placeholderText: {
    color: "#64748b",
    fontSize: 16,
  },
  previewImage: {
    width: "100%",
    height: "100%",
    resizeMode: "contain",
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    backgroundColor: "#06b6d4",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  buttonIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  buttonText: {
    color: "#f1f5f9",
    fontSize: 14,
    fontWeight: "600",
  },
  tipsContainer: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: "#06b6d4",
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