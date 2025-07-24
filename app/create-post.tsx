// app/create-post.tsx
import { HapticBackButton } from '@/components/HapticBackButton';
import { getSchoolByValue } from '@/constants/schools';
import { useAuth } from '@/contexts/AuthContext';
import { useFeed } from '@/contexts/FeedContext';
import { useCreatePost } from '@/hooks/useSocialFeatures';
import { fixUserCommunityMembership } from '@/utils/profileSync';
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

export default function CreatePostScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const params = useLocalSearchParams();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageAspectRatio, setImageAspectRatio] = useState<number | undefined>(undefined);
  const [selectedCommunity, setSelectedCommunity] = useState<number | null>(null);
  const [showMediaOptions, setShowMediaOptions] = useState(false);
  const [showCommunityFix, setShowCommunityFix] = useState(false);
  const [isRestoringFromCamera, setIsRestoringFromCamera] = useState(false);

  const { createPost, isCreating } = useCreatePost();
  const { communities: userCommunityMemberships, isLoading: areCommunitiesLoading, error: communitiesError, refetch } = useFeed();

  // Debug logging
  console.log('🔍 CREATE POST: Component state:', {
    communities: userCommunityMemberships?.length || 0,
    isLoading: areCommunitiesLoading,
    error: communitiesError?.message,
    selectedCommunity,
    showCommunityFix,
    rawData: userCommunityMemberships,
    dataType: typeof userCommunityMemberships,
    isArray: Array.isArray(userCommunityMemberships)
  });

  // Check the noCommunities calculation
  const noCommunities = !userCommunityMemberships || userCommunityMemberships.length === 0;
  console.log('🔍 CREATE POST: noCommunities check:', {
    noCommunities,
    reason: !userCommunityMemberships ? 'falsy userCommunityMemberships' : 
           userCommunityMemberships.length === 0 ? 'empty array' : 'has communities'
  });

  // Extra debug to see if FeedProvider fix worked
  console.log('🔄 CREATE POST: FeedProvider fix test:', {
    timestamp: new Date().toISOString(),
    hasData: !!userCommunityMemberships,
    dataLength: userCommunityMemberships?.length,
    shouldShowCommunities: !noCommunities
  });

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
  
  // Check if we received data from the camera screen (photo + preserved form data)
  useEffect(() => {
    if (params.photoUri && typeof params.photoUri === 'string') {
      setIsRestoringFromCamera(true); // Flag that we're restoring
      handleSetImage(params.photoUri);
      
      // Restore form data if it was preserved from camera navigation
      if (params.title && typeof params.title === 'string') {
        setTitle(params.title);
      }
      if (params.content && typeof params.content === 'string') {
        setContent(params.content);
      }
      if (params.selectedCommunity && typeof params.selectedCommunity === 'string') {
        const communityId = parseInt(params.selectedCommunity, 10);
        if (!isNaN(communityId)) {
          setSelectedCommunity(communityId);
        }
      }
      
      // Clear the params so they're not re-used if the user navigates away and back
      router.setParams({ 
        photoUri: undefined,
        title: undefined,
        content: undefined,
        selectedCommunity: undefined
      });
      
      // Reset the flag after a short delay to allow effects to settle
      setTimeout(() => setIsRestoringFromCamera(false), 100);
    }
  }, [params.photoUri, params.title, params.content, params.selectedCommunity]);

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

  // Auto-select first community if none selected (but not when restoring from camera)
  useEffect(() => {
    // Only auto-select if selectedCommunity is null or undefined (not 0, not NaN)
    if (
      userCommunityMemberships &&
      userCommunityMemberships.length > 0 &&
      (selectedCommunity === null || selectedCommunity === undefined) &&
      !isRestoringFromCamera
    ) {
      setSelectedCommunity(userCommunityMemberships[0].communities.id);
      setShowCommunityFix(false);
    } else if (!areCommunitiesLoading && (!userCommunityMemberships || userCommunityMemberships.length === 0)) {
      setShowCommunityFix(true);
    }
  }, [userCommunityMemberships, selectedCommunity, areCommunitiesLoading, isRestoringFromCamera]);

  // Community membership fix function
  const fixCommunityMembership = async () => {
    if (!session?.user) {
      Alert.alert('Not Logged In', 'Please log in first');
      return;
    }
    
    try {
      Alert.alert('Fixing...', 'Attempting to fix community membership...');
      
      // Use the utility function to fix membership
      const result = await fixUserCommunityMembership();
      
      if (result?.success) {
        Alert.alert('Fixed!', 'You have been added to the general community.');
        
        // Refetch communities
        refetch();
        setShowCommunityFix(false);
      } else {
        Alert.alert('Fix Failed', result?.error || 'Unknown error occurred');
      }
      
    } catch (error: any) {
      console.error('Fix error:', error);
      Alert.alert('Error', error.message || 'Failed to fix community membership');
    }
  };

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
      // Navigate to the custom camera screen with current form data
      router.push({
        pathname: '/camera',
        params: {
          title: title,
          content: content,
          // Always pass selectedCommunity as a stringified number, or undefined if null
          selectedCommunity: selectedCommunity !== null && selectedCommunity !== undefined ? String(selectedCommunity) : undefined,
          returnPath: '/create-post'
        }
      });
    } catch (error: any) {
      console.error("Camera navigation error:", error);
      Alert.alert("Camera Error", "Could not open camera. Please try again.");
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
        <Text style={styles.loadingText}>Loading communities...</Text>
      </SafeAreaView>
    );
  }

  if (communitiesError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.form}>
          <Text style={styles.errorText}>Error loading communities: {communitiesError.message}</Text>
          <TouchableOpacity 
            style={styles.fixButton}
            onPress={fixCommunityMembership}
          >
            <Text style={styles.fixButtonText}>🔧 Try Fix</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Show community fix UI if user has no communities
  if (showCommunityFix || !userCommunityMemberships || userCommunityMemberships.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
            <View style={styles.form}>
              <Text style={styles.sectionTitle}>You must join a community before posting.</Text>
              
              <View style={styles.communityFixContainer}>
                <Ionicons name="information-circle" size={48} color="#FF6B6B" />
                <Text style={styles.communityFixTitle}>No Communities Found</Text>
                <Text style={styles.communityFixText}>
                  You need to join at least one community before you can create posts. 
                  Let&apos;s get you set up with the general community!
                </Text>
                
                <TouchableOpacity 
                  style={styles.fixButton}
                  onPress={fixCommunityMembership}
                >
                  <Text style={styles.fixButtonText}>
                    🏘️ Join General Community
                  </Text>
                </TouchableOpacity>
                
                <HapticBackButton 
                  style={styles.backButton}
                  onPress={() => router.back()}
                  text="Go Back"
                  color="#007AFF"
                />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.container}>
            <View style={styles.header}>
                              <HapticBackButton 
                  onPress={() => router.back()} 
                  style={styles.backButton}
                  color="#007AFF"
                  text=""
                />
              <Text style={styles.headerTitle}>Create Post</Text>
              <View style={styles.headerSpacer} />
            </View>

            <View style={styles.form}>
              <Text style={styles.sectionTitle}>Create a New Post</Text>
              
              <Text style={styles.label}>Select Community</Text>
              <View style={styles.communitySelector}>
                {userCommunityMemberships?.map((membership) => {
                  const community = membership.communities;
                  const school = community.type === 'school' ? getSchoolByValue(community.name) : undefined;
                  const displayName = school ? school.display : community.name;
                  
                  return (
                    <TouchableOpacity
                      key={community.id}
                      style={[
                        styles.communityOption,
                        selectedCommunity === community.id && styles.communityOptionSelected
                      ]}
                      onPress={() => setSelectedCommunity(community.id)}
                    >
                      <Text
                        style={[
                          styles.communityOptionText,
                          selectedCommunity === community.id && styles.communityOptionTextSelected
                        ]}
                      >
                        {displayName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
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
            
            {/* Removed Photo Library Option */}
            
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
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    color: '#FF3B30',
    textAlign: 'center',
    padding: 20,
    fontSize: 16,
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40, // Adjust as needed for spacing
  },
  form: {
    padding: 16,
    paddingTop: 8, // Reduced since we have header now
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
  // Community fix styles
  communityFixContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginTop: 20,
  },
  communityFixTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 12,
    textAlign: 'center',
  },
  communityFixText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  fixButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  fixButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#666',
    fontSize: 16,
  },
});