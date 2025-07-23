// app/camera.tsx
import { Ionicons } from '@expo/vector-icons';
import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { HapticBackButton } from '@/components/HapticBackButton';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

export default function CameraScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [isCapturing, setIsCapturing] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const cameraRef = useRef<CameraView | null>(null);

  // Extract form data from params
  const formData = {
    title: params.title as string || '',
    content: params.content as string || '',
    selectedCommunity: params.selectedCommunity as string || '',
    returnPath: params.returnPath as string || '/create-post'
  };

  console.log('📷 Camera screen mounted with form data:', formData);

  useEffect(() => {
    console.log('📷 Camera screen mounted');
    if (!permission?.granted) {
      console.log('📷 Requesting camera permission...');
      requestPermission();
    }
  }, [permission]);

  useEffect(() => {
    console.log('📷 Permission status:', {
      granted: permission?.granted,
      canAskAgain: permission?.canAskAgain,
      status: permission?.status
    });
  }, [permission]);

  async function takePicture() {
    console.log('📷 Take picture attempted', {
      cameraRef: !!cameraRef.current,
      isCapturing,
      isCameraReady
    });

    if (!cameraRef.current || isCapturing || !isCameraReady) {
      console.log('📷 Cannot take picture - camera not ready');
      return;
    }

    setIsCapturing(true);
    try {
      console.log('📷 Taking picture...');
      const picture = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: false, // Changed to false for better reliability
        base64: false, // Don't need base64, just URI
      });

      console.log('📷 Picture taken successfully:', {
        uri: picture.uri,
        width: picture.width,
        height: picture.height
      });

      // Navigate back to create-post with the photo AND preserved form data
      router.navigate({
        pathname: formData.returnPath,
        params: { 
          photoUri: picture.uri,
          // Preserve all form data
          title: formData.title,
          content: formData.content,
          selectedCommunity: formData.selectedCommunity,
        },
      });
    } catch (error) {
      console.error('📷 Error taking picture:', error);
      Alert.alert('Camera Error', 'Could not take a picture. Please try again.');
    } finally {
      setIsCapturing(false);
    }
  }

  function toggleCameraFacing() {
    console.log('📷 Toggling camera facing from', facing);
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  }

  const handleCameraReady = () => {
    console.log('📷 Camera is ready');
    setIsCameraReady(true);
  };

  if (!permission) {
    // Permissions are still loading
    console.log('📷 Permissions loading...');
    return (
      <View style={styles.container}>
        <ActivityIndicator color="white" size="large" />
        <Text style={styles.loadingText}>Loading camera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    // Permissions are not granted
    console.log('📷 Camera permission not granted');
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera" size={64} color="#666" style={styles.permissionIcon} />
          <Text style={styles.errorText}>Camera permission is required to take photos.</Text>
          <Text style={styles.permissionSubtext}>
            Please allow camera access to take photos for your posts.
          </Text>
          
          <TouchableOpacity 
            style={styles.permissionButton} 
            onPress={() => requestPermission()}
          >
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, styles.secondaryButton]} 
            onPress={() => {
              // Preserve form data when going back from permission screen
              router.navigate({
                pathname: formData.returnPath,
                params: {
                  title: formData.title,
                  content: formData.content,
                  selectedCommunity: formData.selectedCommunity,
                }
              });
            }}
          >
            <Text style={styles.buttonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <HapticBackButton onPress={() => {
          // Preserve form data even when going back without taking a photo
          router.navigate({
            pathname: formData.returnPath,
            params: {
              title: formData.title,
              content: formData.content,
              selectedCommunity: formData.selectedCommunity,
            }
          });
        }} style={styles.headerButton} color="white" text="" iconSize={30} />
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
          onCameraReady={handleCameraReady}
        />
        
        {!isCameraReady && (
          <View style={styles.cameraLoadingOverlay}>
            <ActivityIndicator color="white" size="large" />
            <Text style={styles.cameraLoadingText}>Preparing camera...</Text>
          </View>
        )}
      </View>

      <View style={styles.controlsContainer}>
        <TouchableOpacity
          onPress={takePicture}
          style={[styles.captureButton, (!isCameraReady || isCapturing) && styles.captureButtonDisabled]}
          disabled={!isCameraReady || isCapturing}
        >
          {isCapturing ? (
            <ActivityIndicator color="white" />
          ) : (
            <View style={styles.captureInner} />
          )}
        </TouchableOpacity>
        
        {!isCameraReady && (
          <Text style={styles.statusText}>Camera is loading...</Text>
        )}
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
  secondaryButton: {
    backgroundColor: '#666',
    marginTop: 10,
  },
  permissionIcon: {
    marginBottom: 20,
  },
  permissionSubtext: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  permissionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 8,
    alignSelf: 'center',
    marginBottom: 10,
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  cameraLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 20,
  },
  cameraLoadingText: {
    color: 'white',
    fontSize: 18,
    marginTop: 10,
  },
  loadingText: {
    color: 'white',
    fontSize: 18,
    marginTop: 10,
  },
  captureButtonDisabled: {
    opacity: 0.7,
  },
  statusText: {
    color: 'white',
    fontSize: 16,
    marginTop: 10,
  },
});