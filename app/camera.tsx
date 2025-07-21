// app/camera.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
// CHANGE 1: Imported CameraType here
import { CameraView, useCameraPermissions, CameraType } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function CameraScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  // CHANGE 2: Explicitly set the type for the state variable
  const [facing, setFacing] = useState<CameraType>('back');
  const [isCapturing, setIsCapturing] = useState(false);
  const cameraRef = useRef<CameraView | null>(null);

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  async function takePicture() {
    if (!cameraRef.current || isCapturing) return;

    setIsCapturing(true);
    try {
      const picture = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: true,
      });

      // Pass the photo back to create-post screen using the same navigation method as dual-camera
      router.navigate({
        pathname: '/(tabs)/create-post',
        params: { photoUri: picture.uri },
      });
    } catch (error) {
      console.error('Error taking picture:', error);
      Alert.alert('Error', 'Could not take a picture. Please try again.');
    } finally {
      setIsCapturing(false);
    }
  }

  function toggleCameraFacing() {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  }

  if (!permission) {
    // Permissions are still loading
    return <View style={styles.container}><ActivityIndicator color="white" /></View>;
  }

  if (!permission.granted) {
    // Permissions are not granted
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <Text style={styles.errorText}>Camera permission is required to take photos.</Text>
          <TouchableOpacity style={styles.button} onPress={() => router.back()}>
            <Text style={styles.buttonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="close" size={30} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Take a Photo</Text>
        <TouchableOpacity onPress={toggleCameraFacing} style={styles.headerButton}>
          <Ionicons name="camera-reverse-outline" size={30} color="white" />
        </TouchableOpacity>
      </View>

      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
          enableTorch={false}
        />
      </View>

      <View style={styles.controlsContainer}>
        <TouchableOpacity
          onPress={takePicture}
          style={styles.captureButton}
          disabled={isCapturing}
        >
          {isCapturing ? (
            <ActivityIndicator color="white" />
          ) : (
            <View style={styles.captureInner} />
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// Styles are adapted from your dual-camera.tsx for consistency
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 10 : 30,
    paddingBottom: 20,
  },
  headerButton: {
    padding: 5,
    width: 40,
    alignItems: 'center',
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  cameraContainer: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    marginHorizontal: 10,
    backgroundColor: '#1a1a1a',
  },
  camera: {
    flex: 1,
  },
  controlsContainer: {
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 30,
  },
  captureButton: {
    backgroundColor: '#007AFF',
    borderRadius: 40,
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#007AFF',
    borderWidth: 4,
    borderColor: 'white',
  },
  errorText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    alignSelf: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});