// app/create-post.tsx
import { HapticBackButton } from '@/components/HapticBackButton';
import MatchSummary from '@/components/social/MatchSummary';
import { getSchoolByValue } from '@/constants/schools';
import { useAuth } from '@/contexts/AuthContext';
import { useFeed } from '@/contexts/FeedContext';
import { useCreatePost } from '@/hooks/useSocialFeatures';
import { supabase } from '@/supabase';
import { MatchSummaryData } from '@/types/social';
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
  
  // Initialize state from params if present (happens before any useEffect)
  const getInitialCommunity = () => {
    if (params.selectedCommunity && typeof params.selectedCommunity === 'string') {
      const communityId = parseInt(params.selectedCommunity, 10);
      if (!isNaN(communityId)) {
        console.log('🔄 INITIAL: Restoring community from params', { param: params.selectedCommunity, parsed: communityId });
        return communityId;
      }
    }
    return null;
  };
  
  const getInitialTitle = () => {
    return (params.title && typeof params.title === 'string') ? params.title : '';
  };
  
  const getInitialContent = () => {
    return (params.content && typeof params.content === 'string') ? params.content : '';
  };
  
  const [title, setTitle] = useState(getInitialTitle());
  const [content, setContent] = useState(getInitialContent());
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageAspectRatio, setImageAspectRatio] = useState<number | undefined>(undefined);
  const [selectedCommunity, setSelectedCommunity] = useState<number | null>(getInitialCommunity());
  const [selectedMatch, setSelectedMatch] = useState<MatchSummaryData | null>(null);
  const [userMatches, setUserMatches] = useState<MatchSummaryData[]>([]);
  const [showMatchSelector, setShowMatchSelector] = useState(false);
  const [showMediaOptions, setShowMediaOptions] = useState(false);
  const [showCommunityFix, setShowCommunityFix] = useState(false);
  const [isRestoringFromCamera, setIsRestoringFromCamera] = useState(!!params.photoUri);
  const [hasInitializedCommunity, setHasInitializedCommunity] = useState(!!getInitialCommunity()); // True if restored from params

  // Wrap setSelectedCommunity with logging
  const setSelectedCommunityWithLog = (value: number | null) => {
    console.log('🏘️ COMMUNITY CHANGE:', {
      from: selectedCommunity,
      to: value,
      stack: new Error().stack?.split('\n')[2]?.trim() // Get caller info
    });
    setSelectedCommunity(value);
  };

  const { createPost, isCreating } = useCreatePost();
  const { communities: userCommunityMemberships, isLoading: areCommunitiesLoading, error: communitiesError, refetch } = useFeed();

  // Handle back navigation to feed
  const handleBackToFeed = () => {
    router.push('/(tabs)/feed');
  };

  // Debug logging for state changes
  useEffect(() => {
    console.log('🔍 STATE CHANGE:', {
      selectedCommunity,
      isRestoringFromCamera,
      hasInitializedCommunity,
      communitiesCount: userCommunityMemberships?.length || 0,
      areCommunitiesLoading
    });
  }, [selectedCommunity, isRestoringFromCamera, hasInitializedCommunity, userCommunityMemberships, areCommunitiesLoading]);

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
      console.log('📷 RESTORATION: Processing photo from camera', {
        photoUri: params.photoUri,
        // Form data already restored during state initialization
      });
      
      handleSetImage(params.photoUri);
      
      // Clear the params so they're not re-used if the user navigates away and back
      router.setParams({ 
        photoUri: undefined,
        title: undefined,
        content: undefined,
        selectedCommunity: undefined
      });
      
      // Reset the flag after a short delay to allow effects to settle
      setTimeout(() => {
        console.log('📷 RESTORATION: Completed, resetting flag');
        setIsRestoringFromCamera(false);
      }, 100);
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
    setSelectedCommunityWithLog(null);
    setSelectedMatch(null);
  };

  // Auto-select first community if none selected (but not when restoring from camera)
  useEffect(() => {
    // Only auto-select if selectedCommunity is null or undefined (not 0, not NaN)
    // AND we're not currently restoring from camera AND we haven't already set a community
    if (
      userCommunityMemberships &&
      userCommunityMemberships.length > 0 &&
      selectedCommunity === null &&
      !isRestoringFromCamera &&
      !hasInitializedCommunity // Only auto-select if not already initialized
    ) {
      console.log('🔄 AUTO-SELECT: Setting first community', userCommunityMemberships[0].communities.id);
      setSelectedCommunityWithLog(userCommunityMemberships[0].communities.id);
      setShowCommunityFix(false);
      setHasInitializedCommunity(true); // Mark as initialized
    } else if (!areCommunitiesLoading && (!userCommunityMemberships || userCommunityMemberships.length === 0)) {
      setShowCommunityFix(true);
    }
  }, [userCommunityMemberships, areCommunitiesLoading, isRestoringFromCamera, hasInitializedCommunity]); // Added hasInitializedCommunity to deps

  // Load user matches when component mounts
  useEffect(() => {
    loadUserMatches();
  }, [session?.user]);

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
      console.log('📷 CAMERA NAV: Current state before navigation:', {
        selectedCommunity,
        title,
        content
      });
      
      const communityParam = selectedCommunity !== null && selectedCommunity !== undefined ? String(selectedCommunity) : undefined;
      console.log('📷 CAMERA NAV: Community param being passed:', {
        originalValue: selectedCommunity,
        stringifiedParam: communityParam
      });
      
      // Navigate to the custom camera screen with current form data
      router.push({
        pathname: '/camera',
        params: {
          title: title,
          content: content,
          // Always pass selectedCommunity as a stringified number, or undefined if null
          selectedCommunity: communityParam,
          returnPath: '/create-post'
        }
      });
    } catch (error: any) {
      console.error("Camera navigation error:", error);
      Alert.alert("Camera Error", "Could not open camera. Please try again.");
    }
  };

  const takeDualPhotoWithCamera = async () => {
    setShowMediaOptions(false);
    try {
      const communityParam = selectedCommunity !== null && selectedCommunity !== undefined ? String(selectedCommunity) : undefined;
      router.push({
        pathname: '/dual-camera',
        params: {
          title: title,
          content: content,
          selectedCommunity: communityParam,
          returnPath: '/create-post',
        },
      });
    } catch (error: any) {
      console.error('Dual camera navigation error:', error);
      Alert.alert('Camera Error', 'Could not open dual camera. Please try again.');
    }
  };

  // Load user's recent matches for linking (same logic as history page)
  const loadUserMatches = async () => {
    if (!session?.user) return;

    try {
      const { data, error } = await supabase
        .from('saved_matches')
        .select(`
          id,
          "matchSetup",
          "playerStats", 
          "teamPenalties",
          "userSlotMap",
          "winnerTeam",
          "matchDuration",
          "matchStartTime",
          "createdAt"
        `)
        .eq('userId', session.user.id)
        .order('createdAt', { ascending: false })
        .limit(10); // Get last 10 matches

      if (error) throw error;

      // Filter matches to only include those where user was a player (same as history page)
      const playerMatches = (data || []).filter(match => {
        const userSlot = Object.entries(match.userSlotMap || {}).find(
          ([_, userId]) => userId === session.user.id
        );
        return userSlot !== undefined;
      });

      setUserMatches(playerMatches);
    } catch (error) {
      console.error('Error loading user matches:', error);
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
      linkedMatchId: selectedMatch?.id || null,
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
                  onPress={handleBackToFeed}
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
                  onPress={handleBackToFeed} 
                  style={styles.backButton}
                  color="#007AFF"
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
                      onPress={() => setSelectedCommunityWithLog(community.id)}
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

              {/* Match Selection Section */}
              <TouchableOpacity 
                onPress={() => setShowMatchSelector(true)} 
                style={styles.imageButton}
                accessibilityLabel="Link a match to your post"
              >
                <Ionicons name="trophy-outline" size={24} color="#007AFF" />
                <Text style={styles.imageButtonText}>
                  {selectedMatch ? 'Change Match' : 'Link Match'}
                </Text>
              </TouchableOpacity>

              {selectedMatch && (
                <View style={styles.matchPreviewContainer}>
                  <MatchSummary 
                    matchData={selectedMatch} 
                    showFullDetails={false}
                  />
                  <TouchableOpacity
                    onPress={() => setSelectedMatch(null)}
                    style={styles.removeMatchButton}
                    accessibilityLabel="Remove linked match"
                  >
                    <Ionicons name="close-circle" size={24} color="#FF3B30" />
                    <Text style={styles.removeMatchText}>Remove Match</Text>
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
            
            <TouchableOpacity onPress={takeDualPhotoWithCamera} style={styles.modalOption}>
              <Ionicons name="camera-reverse-outline" size={24} color="#007AFF" />
              <Text style={styles.modalOptionText}>Dual Camera</Text>
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

      {/* Match Selector Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showMatchSelector}
        onRequestClose={() => setShowMatchSelector(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMatchSelector(false)}
        >
          <View style={styles.matchSelectorModal}>
            <View style={styles.matchSelectorHeader}>
              <Text style={styles.matchSelectorTitle}>Select Match to Link</Text>
              <TouchableOpacity
                onPress={() => setShowMatchSelector(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.matchList}>
              {userMatches.length === 0 ? (
                <View style={styles.noMatchesContainer}>
                  <Ionicons name="trophy-outline" size={48} color="#ccc" />
                  <Text style={styles.noMatchesText}>No matches found</Text>
                  <Text style={styles.noMatchesSubtext}>
                    Play some matches to link them to your posts!
                  </Text>
                </View>
              ) : (
                userMatches.map((match) => (
                  <TouchableOpacity
                    key={match.id}
                    style={[
                      styles.matchListItem,
                      selectedMatch?.id === match.id && styles.matchListItemSelected
                    ]}
                    onPress={() => {
                      setSelectedMatch(match);
                      setShowMatchSelector(false);
                    }}
                  >
                    <MatchSummary 
                      matchData={match} 
                      showFullDetails={false}
                    />
                    {selectedMatch?.id === match.id && (
                      <View style={styles.selectedIndicator}>
                        <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
                      </View>
                    )}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
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
    marginRight: 10,
  },
  // Match selection styles
  matchPreviewContainer: {
    marginTop: 16,
    position: 'relative',
  },
  removeMatchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    padding: 8,
    backgroundColor: '#FFF2F2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFE6E6',
  },
  removeMatchText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  matchSelectorModal: {
    backgroundColor: 'white',
    margin: 20,
    marginTop: 80,
    borderRadius: 20,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  matchSelectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  matchSelectorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  modalCloseButton: {
    padding: 4,
  },
  matchList: {
    maxHeight: 400,
  },
  matchListItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    position: 'relative',
  },
  matchListItemSelected: {
    backgroundColor: '#F0F9FF',
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  selectedIndicator: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'white',
    borderRadius: 12,
  },
  noMatchesContainer: {
    alignItems: 'center',
    padding: 40,
  },
  noMatchesText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
  },
  noMatchesSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});