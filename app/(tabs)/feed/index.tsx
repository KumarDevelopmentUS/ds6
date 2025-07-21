// app/(tabs)/feed/index.tsx
import { PostCard } from '@/components/social/PostCard';
import { getSchoolByValue } from '@/constants/schools';
import { useAuth } from '@/contexts/AuthContext';
import { useFeed } from '@/contexts/FeedContext';
import { usePosts, useRealtimeUpdates } from '@/hooks/useSocialFeatures';
import { supabase } from '@/supabase';
import { debugFeedProvider, debugUserCommunities, fixUserCommunityMembership } from '@/utils/profileSync';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    Pressable,
    RefreshControl,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

export default function FeedScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { communities, isLoading: isCommunitiesLoading, error: communitiesError, refetch } = useFeed();
  const [selectedCommunityId, setSelectedCommunityId] = useState<number | null>(null);
  const [dropdownVisible, setDropdownVisible] = useState(false);

  // Debug logging
  console.log('🏘️ FEED SCREEN: Current state:', {
    communities: communities?.length || 0,
    isLoading: isCommunitiesLoading,
    error: communitiesError?.message,
    userId: session?.user?.id
  });

  // Get the currently selected community
  const selectedCommunity = selectedCommunityId
    ? communities?.find(c => c.communities?.id === selectedCommunityId)?.communities
    : null;
    
  // Find the display name for the selected community
  const schoolForSelected = selectedCommunity?.type === 'school'
    ? getSchoolByValue(selectedCommunity.name)
    : undefined;
  const selectedCommunityDisplayName = schoolForSelected
    ? schoolForSelected.display
    : selectedCommunity?.name;

  const { posts, isLoading, refetch: refetchPosts, handleVote, userVotes } = usePosts(selectedCommunityId || undefined);

  // Enable real-time updates for the selected community
  useRealtimeUpdates(selectedCommunityId || undefined);

  // Define the type for a post item
  type Post = typeof posts extends (infer U)[] ? U : any;

  // Memoize the renderItem function to improve FlatList performance
  const renderItem = useCallback(({ item }: { item: Post }) => (
    <PostCard
      post={item}
      onPress={() => router.push({
        pathname: "/post/[id]",
        params: { id: item.id }
      })}
      onVote={(voteType) => handleVote(item.id, voteType)}
      userVote={userVotes?.[item.id]}
    />
  ), [router, handleVote, userVotes]);

  // Community membership fix function
  const fixCommunityMembership = async () => {
    if (!session?.user) {
      Alert.alert('Not Logged In', 'Please log in first');
      return;
    }
    
    try {
      Alert.alert('Fixing...', 'Attempting to fix community membership...');
      
      // Check if user is in any community
      const { data: memberships } = await supabase
        .from('user_communities')
        .select('*, communities(*)')
        .eq('user_id', session.user.id);

      console.log('Current memberships:', memberships);

      if (memberships && memberships.length > 0) {
        Alert.alert('Already Fixed', `You are already in ${memberships.length} community(ies)! Try refreshing the app.`);
        return;
      }

      // Use the utility function to fix membership
      const result = await fixUserCommunityMembership();
      
      if (result?.success) {
        Alert.alert('Fixed!', 'You have been added to the general community. Refreshing...');
        
        // Trigger refetch and force refresh
        refetch();
        setTimeout(() => {
          if (typeof window !== 'undefined') {
            window.location.reload();
          }
        }, 1000);
      } else {
        Alert.alert('Fix Failed', result?.error || 'Unknown error occurred');
      }
      
    } catch (error: any) {
      console.error('Fix error:', error);
      Alert.alert('Error', error.message || 'Failed to fix community membership');
    }
  };

  // Debug function to check community data
  const debugCommunities = async () => {
    if (!session?.user) {
      Alert.alert('Not logged in');
      return;
    }

    try {
      console.log('🔍 DEBUG: Starting community diagnostic...');
      
      // Run both debug functions
      await debugUserCommunities();
      await debugFeedProvider();

      Alert.alert('Debug Complete', 'Check the console for detailed debug information');

    } catch (error: any) {
      console.error('Debug error:', error);
      Alert.alert('Debug Failed', error.message);
    }
  };

  // Handle the loading state for fetching communities
  if (isCommunitiesLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Loading communities...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Handle any errors that occurred while fetching communities
  if (communitiesError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Error loading communities: {communitiesError.message}</Text>
          
          {/* Debug and Fix buttons */}
          <View style={{ marginTop: 20, gap: 10 }}>
            <TouchableOpacity 
              style={{ backgroundColor: '#ff6b6b', padding: 15, borderRadius: 8 }}
              onPress={fixCommunityMembership}
            >
              <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold' }}>
                🔧 Fix Community Membership
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={{ backgroundColor: '#4ecdc4', padding: 15, borderRadius: 8 }}
              onPress={debugCommunities}
            >
              <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold' }}>
                🔍 Debug Communities
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // If communities array is empty, show fix option
  if (!communities || communities.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Ionicons name="home-outline" size={64} color="#666" />
          <Text style={styles.emptyText}>You haven't joined any communities yet.</Text>
          <Text style={styles.emptySubtext}>
            Join a community to start seeing posts and connecting with others!
          </Text>
          
          <View style={{ marginTop: 30, gap: 12, width: '100%', maxWidth: 300 }}>
            <TouchableOpacity 
              style={{ backgroundColor: '#007AFF', padding: 16, borderRadius: 8 }}
              onPress={fixCommunityMembership}
            >
              <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold', fontSize: 16 }}>
                🏘️ Join General Community
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={{ backgroundColor: '#4ecdc4', padding: 12, borderRadius: 8 }}
              onPress={debugCommunities}
            >
              <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold' }}>
                🔍 Debug Communities
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const handleCreatePost = () => {
    router.push('/create-post');
  };

  const handleViewMembers = () => {
    if (selectedCommunityId) {
      router.push({
        pathname: '/community-members',
        params: {
          communityId: selectedCommunityId,
          communityName: selectedCommunity?.name || 'Community'
        }
      });
    } else {
      // If viewing all communities, show all members from all user's communities
      router.push({
        pathname: '/community-members',
        params: {
          communityId: 'all',
          communityName: 'All Communities'
        }
      });
    }
  };

  const toggleDropdown = () => {
    setDropdownVisible(!dropdownVisible);
  };

  const selectCommunity = (communityId: number | null) => {
    setSelectedCommunityId(communityId);
    setDropdownVisible(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with Dropdown */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => {
            // TODO: Navigate to community settings
            Alert.alert('Coming Soon', 'Community settings will be available soon!');
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="settings-outline" size={24} color="#007AFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.dropdownButton}
          onPress={toggleDropdown}
          activeOpacity={0.7}
        >
          {/* Spacer to balance the icon on the right and center the text */}
          <View style={{ width: 20 }} />

          <Text style={styles.dropdownButtonText}>
            {selectedCommunity ? selectedCommunityDisplayName : 'All Communities'}
          </Text>

          <Ionicons
            name={dropdownVisible ? "chevron-up" : "chevron-down"}
            size={20}
            color="#007AFF"
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerButton}
          onPress={handleViewMembers}
          activeOpacity={0.7}
        >
          <Ionicons name="people" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {/* Dropdown Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={dropdownVisible}
        onRequestClose={() => setDropdownVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setDropdownVisible(false)}
        >
          <View style={styles.dropdownContainer}>
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => selectCommunity(null)}
            >
              <Text style={[
                styles.dropdownItemText,
                selectedCommunityId === null && styles.dropdownItemTextSelected
              ]}>
                All Communities
              </Text>
              {selectedCommunityId === null && (
                <Ionicons name="checkmark" size={20} color="#007AFF" />
              )}
            </TouchableOpacity>

            {communities.map((membership) => {
              const community = membership.communities;
              const school = community.type === 'school' ? getSchoolByValue(community.name) : undefined;
              const displayName = school ? school.display : community.name;
              
              return (
                <TouchableOpacity
                  key={community.id}
                  style={styles.dropdownItem}
                  onPress={() => selectCommunity(community.id)}
                >
                  <Text style={[
                    styles.dropdownItemText,
                    selectedCommunityId === community.id && styles.dropdownItemTextSelected
                  ]}>
                    {displayName}
                  </Text>
                  {selectedCommunityId === community.id && (
                    <Ionicons name="checkmark" size={20} color="#007AFF" />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Modal>

      {/* Posts List */}
      <FlatList
        data={posts}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refetchPosts}
            tintColor="#007AFF"
          />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {selectedCommunity
                ? `No posts in ${selectedCommunityDisplayName || ''} yet. Be the first to share!`
                : 'No posts yet. Be the first to share!'}
            </Text>
          </View>
        }
      />

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={handleCreatePost}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={30} color="white" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between', // Aligns items on opposite ends
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 12,
  },
  headerButton: {
    padding: 4,
  },
  dropdownButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    paddingTop: 100,
  },
  dropdownContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 12,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#333',
  },
  dropdownItemTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  listContent: {
    paddingVertical: 8,
    paddingBottom: 80, // Add padding for FABs
  },
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 100,
  },
  emptyText: {
    fontSize: 18,
    color: '#333',
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
});