// app/(tabs)/create-post.tsx
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useFeed } from '@/contexts/FeedContext';
import { useCreatePost } from '@/hooks/useSocialFeatures';

export default function CreatePostScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageAspectRatio, setImageAspectRatio] = useState<number | undefined>(undefined);
  const [selectedCommunity, setSelectedCommunity] = useState<number | null>(null);
  const [showMediaOptions, setShowMediaOptions] = useState(false);

  const { createPost, isCreating } = useCreatePost();
  const { communities: userCommunityMemberships, isLoading: areCommunitiesLoading, error: communitiesError } = useFeed();

  // Simple image setter without processing
  const handleSetImage = (uri: string | null) => {
    setImageUri(uri);
    if (uri) {
      Image.getSize(uri, (width, height) => {
        setImageAspectRatio(width / height);
      });
    } else {
      setImageAspectRatio(undefined);
    }
  };
  
  // Check if we received a photo from the camera screen
  useEffect(() => {
    if (params.photoUri && typeof params.photoUri === 'string') {
      handleSetImage(params.photoUri);
      // Optional: Clear the param so it's not re-used if the user navigates away and back
      router.setParams({ photoUri: undefined });
    }
  }, [params.photoUri]);

  // Request media library permission on mount
  useEffect(() => {
    ImagePicker.getMediaLibraryPermissionsAsync();
  }, []);

  // Reset form state
  const resetForm = () => {
    setTitle('');
    setContent('');
    setImageUri(null);
    setImageAspectRatio(undefined);
    setSelectedCommunity(null);
  };

  useEffect(() => {
    if (userCommunityMemberships && userCommunityMemberships.length > 0 && !selectedCommunity) {
      setSelectedCommunity(userCommunityMemberships[0].communities.id);
    }
  }, [userCommunityMemberships, selectedCommunity]);

  const pickImageFromLibrary = async () => {
    setShowMediaOptions(false);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Photo library permission is required to select images.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() }
        ]);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.7,
      });

      if (!result.canceled) {
        const uri = result.assets?.[0]?.uri;
        if (uri) {
          handleSetImage(uri);
        }
      }
    } catch (error: any) {
      console.error("Image picker error:", error);
      Alert.alert("Image Error", error.message || "Could not select an image.");
    }
  };

  const takePhotoWithCamera = async () => {
    setShowMediaOptions(false);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera permission is required to take photos.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() }
        ]);
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.7,
      });

      if (!result.canceled) {
        const uri = result.assets?.[0]?.uri;
        if (uri) {
          handleSetImage(uri);
        }
      }
    } catch (error: any) {
      console.error("Camera error:", error);
      Alert.alert("Camera Error", error.message || "Could not take a photo.");
    }
  };

  const handleSubmit = () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }

    if (!selectedCommunity) {
      Alert.alert('Error', 'Please select a community');
      return;
    }

    const selectedCommunityData = userCommunityMemberships?.find(
      (uc) => uc.communities.id === selectedCommunity
    );

    if (!selectedCommunityData) {
      Alert.alert('Error', 'Invalid community selected');
      return;
    }

    createPost({
      title: title.trim(),
      content: content.trim(),
      imageUri,
      communityId: selectedCommunity,
      communityType: selectedCommunityData.communities.type as 'general' | 'school',
    });

    resetForm();
  };

  if (areCommunitiesLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </SafeAreaView>
    );
  }

  if (communitiesError) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Error loading communities</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
          <View style={styles.form}>
            <Text style={styles.sectionTitle}>Create a New Post</Text>
            
            <Text style={styles.label}>Select Community</Text>
            <View style={styles.communitySelector}>
              {userCommunityMemberships?.map((membership) => (
                <TouchableOpacity
                  key={membership.communities.id}
                  style={[
                    styles.communityOption,
                    selectedCommunity === membership.communities.id && styles.communityOptionSelected
                  ]}
                  onPress={() => setSelectedCommunity(membership.communities.id)}
                >
                  <Text
                    style={[
                      styles.communityOptionText,
                      selectedCommunity === membership.communities.id && styles.communityOptionTextSelected
                    ]}
                  >
                    {membership.communities.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Enter post title"
              maxLength={100}
            />

            <Text style={styles.label}>Content (optional)</Text>
            <TextInput
              style={[styles.input, styles.contentInput]}
              value={content}
              onChangeText={setContent}
              placeholder="What's on your mind?"
              multiline
              maxLength={500}
            />
            <Text style={styles.charCount}>{content.length}/500</Text>
            
            <TouchableOpacity 
              onPress={() => setShowMediaOptions(true)} 
              style={styles.imageButton}
              accessibilityLabel="Add media to your post"
            >
              <Ionicons name="camera-outline" size={24} color="#007AFF" />
              <Text style={styles.imageButtonText}>Add Photo</Text>
            </TouchableOpacity>

            {imageUri && imageAspectRatio && (
              <View style={styles.imagePreviewContainer}>
                <Image 
                  source={{ uri: imageUri }} 
                  style={[styles.imagePreview, { aspectRatio: imageAspectRatio }]} 
                />
                <TouchableOpacity
                  onPress={() => handleSetImage(null)}
                  style={styles.removeImageButton}
                  accessibilityLabel="Remove selected image"
                >
                  <Ionicons name="close-circle" size={24} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isCreating || !title.trim() || !selectedCommunity}
              style={[
                styles.submitButton, 
                (isCreating || !title.trim() || !selectedCommunity) && styles.submitButtonDisabled
              ]}
              accessibilityLabel="Create and submit your post"
            >
              <Text style={styles.submitButtonText}>
                {isCreating ? 'Creating...' : 'Create Post'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      
      {/* Media Options Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showMediaOptions}
        onRequestClose={() => setShowMediaOptions(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMediaOptions(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Choose Photo Source</Text>
            
            <TouchableOpacity onPress={pickImageFromLibrary} style={styles.modalOption}>
              <Ionicons name="images-outline" size={24} color="#007AFF" />
              <Text style={styles.modalOptionText}>Photo Library</Text>
            </TouchableOpacity>
            
            <TouchableOpacity onPress={takePhotoWithCamera} style={styles.modalOption}>
              <Ionicons name="camera-outline" size={24} color="#007AFF" />
              <Text style={styles.modalOptionText}>Take Photo</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => setShowMediaOptions(false)} 
              style={[styles.modalOption, styles.modalCancelOption]}
            >
              <Text style={[styles.modalOptionText, styles.modalCancelText]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  errorText: {
    color: '#666',
    textAlign: 'center',
    padding: 20,
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  form: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
    marginTop: 16,
  },
  communitySelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  communityOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  communityOptionSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  communityOptionText: {
    color: '#666',
    fontSize: 14,
  },
  communityOptionTextSelected: {
    color: '#fff',
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  contentInput: {
    minHeight: 100,
  },
  charCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 4,
  },
  imageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 8,
    marginTop: 16,
    backgroundColor: '#fff',
  },
  imageButtonText: {
    marginLeft: 8,
    color: '#007AFF',
    fontSize: 16,
  },
  imagePreviewContainer: {
    marginTop: 16,
    position: 'relative',
    alignItems: 'center',
  },
  imagePreview: {
    width: '100%',
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'white',
    borderRadius: 12,
  },
  submitButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#f8f8f8',
    marginBottom: 10,
  },
  modalOptionText: {
    fontSize: 16,
    marginLeft: 12,
    color: '#000',
  },
  modalCancelOption: {
    backgroundColor: 'transparent',
    justifyContent: 'center',
    marginTop: 10,
  },
  modalCancelText: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '500',
  },
});