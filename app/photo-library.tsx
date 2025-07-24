import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

export default function PhotoLibraryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [permission, setPermission] = useState<ImagePicker.PermissionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Extract form data from params
  const formData = {
    title: params.title as string || '',
    content: params.content as string || '',
    selectedCommunity: params.selectedCommunity as string || '',
    returnPath: params.returnPath as string || '/create-post',
  };

  useEffect(() => {
    (async () => {
      // Check current permission
      const current = await ImagePicker.getMediaLibraryPermissionsAsync();
      setPermission(current);
      if (!current.granted) {
        // Request permission if not already granted
        const requested = await ImagePicker.requestMediaLibraryPermissionsAsync();
        setPermission(requested);
        if (!requested.granted) {
          setIsLoading(false);
          return;
        }
      }
      // Permission granted, open picker
      pickImage();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function pickImage() {
    setIsLoading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.7,
      });
      setIsLoading(false);
      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        // Navigate back to create-post with the photo and preserved form data
        router.navigate({
          pathname: formData.returnPath as any,
          params: {
            photoUri: result.assets[0].uri,
            title: formData.title,
            content: formData.content,
            selectedCommunity: formData.selectedCommunity,
          },
        });
      } else {
        // User canceled, just go back with form data
        router.navigate({
          pathname: formData.returnPath as any,
          params: {
            title: formData.title,
            content: formData.content,
            selectedCommunity: formData.selectedCommunity,
          },
        });
      }
    } catch (error: any) {
      setIsLoading(false);
      Alert.alert('Image Error', error.message || 'Could not select an image.');
      // Go back with form data
      router.navigate({
        pathname: formData.returnPath as any,
        params: {
          title: formData.title,
          content: formData.content,
          selectedCommunity: formData.selectedCommunity,
        },
      });
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Preparing photo library...</Text>
      </SafeAreaView>
    );
  }

  if (!permission?.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <Ionicons name="images-outline" size={64} color="#666" style={styles.permissionIcon} />
          <Text style={styles.errorText}>Photo library permission is required to select images.</Text>
          <Text style={styles.permissionSubtext}>
            Please allow photo library access to select images for your posts.
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={async () => {
              const requested = await ImagePicker.requestMediaLibraryPermissionsAsync();
              setPermission(requested);
              if (requested.granted) {
                pickImage();
              }
            }}
          >
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={() => Linking.openSettings()}
          >
            <Text style={styles.buttonText}>Open Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton, { marginTop: 10 }]}
            onPress={() => {
              // Go back with form data
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

  // Should never reach here, but fallback
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.loadingText}>Something went wrong. Please try again.</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionIcon: {
    marginBottom: 20,
  },
  errorText: {
    color: '#333',
    fontSize: 16,
    textAlign: 'center',
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
  button: {
    backgroundColor: '#666',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    alignSelf: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#ccc',
  },
}); 