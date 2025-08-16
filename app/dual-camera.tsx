// app/dual-camera.tsx
import { HapticBackButton } from '@/components/HapticBackButton';
import { Ionicons } from '@expo/vector-icons';
import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    Platform,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import ViewShot, { captureRef } from 'react-native-view-shot';

export default function DualCameraScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const cameraRef = useRef<CameraView | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  const [backPhotoUri, setBackPhotoUri] = useState<string | null>(null);
  const [frontPhotoUri, setFrontPhotoUri] = useState<string | null>(null);
  const [backAspect, setBackAspect] = useState<number | null>(null); // width / height
  const [frontAspect, setFrontAspect] = useState<number | null>(null);

  const composeRef = useRef<View>(null);
  const [isComposing, setIsComposing] = useState(false);

  // Extract form data from params
  const formData = {
    title: (params.title as string) || '',
    content: (params.content as string) || '',
    selectedCommunity: (params.selectedCommunity as string) || '',
    returnPath: (params.returnPath as string) || '/create-post',
  };

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  const onCameraReady = () => setIsCameraReady(true);

  const takeSingle = async () => {
    if (!cameraRef.current) throw new Error('Camera not ready');
    const photo = await cameraRef.current.takePictureAsync({
      quality: 0.8,
      base64: false,
      skipProcessing: false,
    });
    return photo.uri;
  };

  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const captureBoth = useCallback(async () => {
    if (!isCameraReady || !cameraRef.current || isCapturing) return;
    setIsCapturing(true);
    try {
      // Back first
      setFacing('back');
      await wait(150);
      const backUri = await takeSingle();
      setBackPhotoUri(backUri);
      Image.getSize(backUri, (w, h) => setBackAspect(w / h), () => setBackAspect(null));

      // Then front
      setFacing('front');
      await wait(450);
      const frontUri = await takeSingle();
      setFrontPhotoUri(frontUri);
      Image.getSize(frontUri, (w, h) => setFrontAspect(w / h), () => setFrontAspect(null));

      // Compose side-by-side
      setIsComposing(true);
    } catch (e: any) {
      console.error('Dual capture error', e);
      Alert.alert('Camera Error', 'Could not take dual photo. Please try again.');
      setIsCapturing(false);
      setIsComposing(false);
    }
  }, [isCameraReady, isCapturing]);

  // After both URIs are present, compose via ViewShot
  useEffect(() => {
    const compose = async () => {
      if (!isComposing || !backPhotoUri || !frontPhotoUri || !composeRef.current) return;
      try {
        // Give images a moment to render
        await wait(150);
        const uri = await captureRef(composeRef.current!, {
          format: 'jpg',
          quality: 0.92,
          width: SURFACE_WIDTH,
          height: SURFACE_HEIGHT,
        });

        router.navigate({
          pathname: formData.returnPath as any,
          params: {
            photoUri: uri,
            title: formData.title,
            content: formData.content,
            selectedCommunity: formData.selectedCommunity,
          },
        });
      } catch (e) {
        console.error('Compose error', e);
        Alert.alert('Compose Error', 'Failed to compose images.');
      } finally {
        setIsCapturing(false);
        setIsComposing(false);
      }
    };
    compose();
  }, [isComposing, backPhotoUri, frontPhotoUri]);

  if (!permission) {
    return (
      <View style={styles.container}> 
        <ActivityIndicator color="white" size="large" />
        <Text style={styles.loadingText}>Loading camera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera" size={64} color="#666" style={styles.permissionIcon} />
          <Text style={styles.errorText}>Camera permission is required to take photos.</Text>
          <Text style={styles.permissionSubtext}>
            Please allow camera access to take photos for your posts.
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={() => requestPermission()}>
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={() => {
              router.navigate({
                pathname: formData.returnPath as any,
                params: {
                  title: formData.title,
                  content: formData.content,
                  selectedCommunity: formData.selectedCommunity,
                },
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
        <HapticBackButton
          onPress={() => {
            router.navigate({
              pathname: formData.returnPath as any,
              params: {
                title: formData.title,
                content: formData.content,
                selectedCommunity: formData.selectedCommunity,
              },
            });
          }}
          style={styles.headerButton}
          color="white"
          text=""
          iconSize={30}
        />
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Dual Camera</Text>
        </View>
        <TouchableOpacity onPress={() => setFacing((c) => (c === 'back' ? 'front' : 'back'))} style={styles.headerButton}>
          <Ionicons name="camera-reverse-outline" size={30} color="white" />
        </TouchableOpacity>
      </View>

      <View style={styles.cameraContainer}>
        <View style={styles.camera}> 
          <CameraView
            ref={cameraRef}
            style={styles.cameraView}
            facing={facing}
            onCameraReady={onCameraReady}
            enableTorch={false}
          />
        </View>
        {!isCameraReady && (
          <View style={styles.cameraLoadingOverlay}>
            <ActivityIndicator color="white" size="large" />
            <Text style={styles.cameraLoadingText}>Preparing camera...</Text>
          </View>
        )}
      </View>

      <View style={styles.controlsContainer}>
        <TouchableOpacity
          onPress={captureBoth}
          style={[styles.captureButton, (!isCameraReady || isCapturing) && styles.captureButtonDisabled]}
          disabled={!isCameraReady || isCapturing}
        >
          {isCapturing ? <ActivityIndicator color="white" /> : <View style={styles.captureInner} />}
        </TouchableOpacity>
        <Text style={styles.statusText}>
          {isCapturing ? 'Capturing...' : 'Tap to capture both cameras'}
        </Text>
      </View>

      {/* Hidden composition surface for ViewShot */}
      {(backPhotoUri && frontPhotoUri) ? (
        <View
          style={styles.composerHidden}
          pointerEvents="none"
        >
          <ViewShot
            ref={composeRef}
            style={styles.composerSurface}
            options={{ format: 'jpg', quality: 0.92, width: SURFACE_WIDTH, height: SURFACE_HEIGHT }}
          >
            <View style={styles.sideBySideRow} collapsable={false}>
              <View style={styles.sideSlot}>
                {backPhotoUri ? (
                  <Image
                    source={{ uri: backPhotoUri }}
                    style={computeFitStyle(backAspect)}
                    resizeMode="contain"
                  />
                ) : null}
              </View>
              <View style={styles.sideSlot}>
                {frontPhotoUri ? (
                  <Image
                    source={{ uri: frontPhotoUri }}
                    style={computeFitStyle(frontAspect)}
                    resizeMode="contain"
                  />
                ) : null}
              </View>
            </View>
          </ViewShot>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const deviceWidth = Dimensions.get('window').width;
const MARGIN_H = 10;
const SURFACE_WIDTH = Math.round(deviceWidth - 2 * MARGIN_H); // final output square width
const SURFACE_HEIGHT = SURFACE_WIDTH; // keep square output

// Compute a style that fits full image inside half-width x full-height without cropping
function computeFitStyle(aspect: number | null) {
  // Fit into half-width by full-height without cropping horizontally.
  const maxWidth = Math.floor(SURFACE_WIDTH / 2);
  const maxHeight = SURFACE_HEIGHT;
  if (!aspect || aspect <= 0) {
    return { width: maxWidth, height: maxHeight };
  }
  // Start by filling the height (to avoid tiny, floating images), then clamp width
  let height = maxHeight;
  let width = height * aspect;
  if (width > maxWidth) {
    width = maxWidth;
    height = width / aspect;
  }
  return { width, height, backgroundColor: 'transparent' } as const;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
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
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    marginTop: 2,
  },
  cameraContainer: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    marginHorizontal: 10,
    backgroundColor: 'transparent',
  },
  camera: {
    flex: 1,
    overflow: 'hidden',
  },
  cameraView: {
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
    fontSize: 14,
    marginTop: 10,
  },
  composerHidden: {
    position: 'absolute',
    left: -20000,
    top: -20000,
    width: SURFACE_WIDTH,
    height: SURFACE_HEIGHT,
  },
  composerSurface: {
    width: SURFACE_WIDTH,
    height: SURFACE_HEIGHT,
    backgroundColor: 'transparent',
  },
  sideBySideRow: {
    width: SURFACE_WIDTH,
    height: SURFACE_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideSlot: {
    width: SURFACE_WIDTH / 2,
    height: SURFACE_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
});


