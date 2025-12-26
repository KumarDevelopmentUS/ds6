// app/(tabs)/feed/index.tsx
import { CommunitySettingsPanel } from '@/components/CommunitySettingsPanel';
import { PostCard } from '@/components/social/PostCard';
import { ThemedText } from '@/components/themed/ThemedText';
import { ThemedView } from '@/components/themed/ThemedView';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { getSchoolByValue } from '@/constants/schools';
import { useAuth } from '@/contexts/AuthContext';
import { useFeed } from '@/contexts/FeedContext';
import { usePosts, useRealtimeUpdates } from '@/hooks/useSocialFeatures';
import { supabase } from '@/supabase';
import { debugFeedProvider, debugUserCommunities, fixUserCommunityMembership } from '@/utils/profileSync';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    FlatList,
    Modal,
    Pressable,
    RefreshControl,
    SafeAreaView,
    ScrollView,
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
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [userJoinDate, setUserJoinDate] = useState<string>('');



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

  // State to control when realtime subscriptions are active
  const [realtimeEnabled, setRealtimeEnabled] = useState(false);
  const [isAppLoaded, setIsAppLoaded] = useState(false);

  // Enable real-time updates only after app is loaded and user is on feed
  useRealtimeUpdates(selectedCommunityId || undefined, realtimeEnabled);

  // Track when app is fully loaded
  useEffect(() => {
    if (session?.user && !isAppLoaded) {
      // Small delay to ensure everything is initialized
      const timer = setTimeout(() => {
        setIsAppLoaded(true);
        setRealtimeEnabled(true);
        console.log('Feed: App loaded, enabling realtime subscriptions');
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [session?.user, isAppLoaded]);

  // Cleanup subscriptions when component unmounts
  useEffect(() => {
    return () => {
      console.log('Feed: Component unmounting, disabling realtime subscriptions');
      setRealtimeEnabled(false);
    };
  }, []);



  // Fetch join date when component mounts and a community is already selected
  useEffect(() => {
    if (selectedCommunityId && session?.user?.id) {
      fetchUserJoinDate(selectedCommunityId);
    }
  }, [selectedCommunityId, session?.user?.id]);

  // Define the type for a post item
  type Post = typeof posts extends (infer U)[] ? U : any;

  // Memoize the renderItem function to improve FlatList performance
  const renderItem = useCallback(({ item }: { item: Post }) => (
    <PostCard
      post={item}
      onPress={() => router.push({
        pathname: "/post/[id]",
        params: { id: item.uid }
      })}
      onVote={(voteType) => handleVote(item.uid, voteType)}
      userVote={userVotes?.[item.uid]}
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

      
      // Run both debug functions
      await debugUserCommunities();
      await debugFeedProvider();

      Alert.alert('Debug Complete', 'Check the console for detailed debug information');

    } catch (error: any) {
      console.error('Debug error:', error);
      Alert.alert('Debug Failed', error.message);
    }
  };

  // If user is not logged in, show login prompt
  if (!session) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.centeredContainer}>
            <ThemedView variant="card" style={styles.loginCard}>
              <Ionicons name="people-outline" size={64} color="#666" />
              <ThemedText variant="subtitle" style={styles.loginTitle}>
                Join Communities
              </ThemedText>
              <ThemedText variant="body" style={styles.loginSubtext}>
                Sign in to join communities and connect with other players!
              </ThemedText>
              
              <View style={styles.loginButtons}>
                <TouchableOpacity 
                  style={styles.signInButton}
                  onPress={() => router.push('/(auth)/login')}
                >
                  <Text style={styles.buttonText}>Sign In</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.createAccountButton}
                  onPress={() => router.push('/(auth)/signUp')}
                >
                  <Text style={styles.buttonText}>Create Account</Text>
                </TouchableOpacity>
              </View>
            </ThemedView>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Handle the loading state for fetching communities
  if (isCommunitiesLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.communitySelector}>
            <Text style={styles.selectorLabel}>Loading...</Text>
          </View>
        </View>
        <ScrollView contentContainerStyle={styles.listContent}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Handle any errors that occurred while fetching communities
  if (communitiesError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Error loading communities: {communitiesError.message}</Text>
          
          {/* Fix button */}
          <View style={{ marginTop: 20, gap: 10 }}>
            <TouchableOpacity 
              style={{ backgroundColor: '#ff6b6b', padding: 15, borderRadius: 8 }}
              onPress={fixCommunityMembership}
            >
              <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold' }}>
                🔧 Fix Community Membership
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
        <EmptyState
          type="communities"
          title="No Communities Yet"
          description="Join a community to start seeing posts and connecting with other players!"
          actionLabel="Join General Community"
          onAction={fixCommunityMembership}
          secondaryActionLabel="Edit Profile"
          onSecondaryAction={() => router.push('/edit-profile')}
        />
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
          communityName: selectedCommunityDisplayName || 'Community'
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
    
    // Fetch join date for the selected community
    if (communityId && session?.user?.id) {
      fetchUserJoinDate(communityId);
    } else {
      setUserJoinDate('');
    }
  };

  const fetchUserJoinDate = async (communityId: number) => {
    if (!session?.user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('user_communities')
        .select('joined_at')
        .eq('user_id', session.user.id)
        .eq('community_id', communityId)
        .single();

      if (error) throw error;
      setUserJoinDate(data?.joined_at || '');
    } catch (error) {
      console.error('Error fetching join date:', error);
      setUserJoinDate('');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
        {/* Header with Dropdown */}
      <View style={styles.header}>
        <TouchableOpacity
          style={[
            styles.headerButton,
            !selectedCommunityId && styles.headerButtonDisabled
          ]}
          onPress={() => {
            if (selectedCommunityId) {
              setSettingsVisible(true);
            } else {
              Alert.alert('No Community Selected', 'Please select a community to view its settings.');
            }
          }}
          activeOpacity={0.7}
          disabled={!selectedCommunityId}
        >
          <Ionicons 
            name="settings-outline" 
            size={24} 
            color={selectedCommunityId ? "#007AFF" : "#CCCCCC"} 
          />
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
          style={[
            styles.headerButton,
            !selectedCommunityId && styles.headerButtonDisabled
          ]}
          onPress={() => {
            if (selectedCommunityId) {
              handleViewMembers();
            } else {
              Alert.alert('No Community Selected', 'Please select a community to view its members.');
            }
          }}
          activeOpacity={0.7}
          disabled={!selectedCommunityId}
        >
          <Ionicons 
            name="people" 
            size={24} 
            color={selectedCommunityId ? "#007AFF" : "#CCCCCC"} 
          />
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
              const isPrivate = community.type === 'private';
              
              return (
                <TouchableOpacity
                  key={community.id}
                  style={styles.dropdownItem}
                  onPress={() => selectCommunity(community.id)}
                >
                  <View style={styles.dropdownItemContent}>
                    {isPrivate && (
                      <Ionicons name="lock-closed" size={14} color="#666" style={{ marginRight: 6 }} />
                    )}
                  <Text style={[
                    styles.dropdownItemText,
                    selectedCommunityId === community.id && styles.dropdownItemTextSelected
                  ]}>
                    {displayName}
                  </Text>
                  </View>
                  {selectedCommunityId === community.id && (
                    <Ionicons name="checkmark" size={20} color="#007AFF" />
                  )}
                </TouchableOpacity>
              );
            })}

            {/* Divider */}
            <View style={styles.dropdownDivider} />

            {/* Create Community Option */}
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => {
                setDropdownVisible(false);
                router.push('/create-community');
              }}
            >
              <View style={styles.dropdownItemContent}>
                <Ionicons name="add-circle-outline" size={18} color="#007AFF" style={{ marginRight: 6 }} />
                <Text style={[styles.dropdownItemText, { color: '#007AFF' }]}>
                  Create Community
                </Text>
              </View>
            </TouchableOpacity>

            {/* Join Community Option */}
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => {
                setDropdownVisible(false);
                router.push('/join-community');
              }}
            >
              <View style={styles.dropdownItemContent}>
                <Ionicons name="enter-outline" size={18} color="#007AFF" style={{ marginRight: 6 }} />
                <Text style={[styles.dropdownItemText, { color: '#007AFF' }]}>
                  Join Community
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Posts List */}
      <FlatList
        data={posts}
        renderItem={renderItem}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => {
              console.log('Feed: Manual refresh triggered, re-enabling realtime');
              setRealtimeEnabled(true);
              refetchPosts();
            }}
            tintColor="#007AFF"
          />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <EmptyState
            type="posts"
            title="No posts yet"
            description={selectedCommunity
              ? `Be the first to share something in ${selectedCommunityDisplayName || 'this community'}!`
              : 'Select a community and start sharing with others!'}
            actionLabel="Create Post"
            onAction={handleCreatePost}
          />
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

      {/* Community Settings Panel */}
      {selectedCommunityId && (
        <CommunitySettingsPanel
          visible={settingsVisible}
          onClose={() => setSettingsVisible(false)}
          communityId={selectedCommunityId}
          communityName={selectedCommunity?.name || ''}
          joinedAt={userJoinDate}
          onLeaveCommunity={() => {
            setSettingsVisible(false);
            setSelectedCommunityId(null);
            // Refresh communities after leaving
            refetch();
          }}
        />
      )}
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
  headerButtonDisabled: {
    opacity: 0.5,
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
  dropdownItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: '#E5E5E5',
    marginVertical: 8,
    marginHorizontal: 16,
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
    padding: 20,
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
  loginCard: {
    alignItems: 'center',
    marginBottom: 32,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  loginTitle: {
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  loginSubtext: {
    textAlign: 'center',
    marginBottom: 24,
    opacity: 0.8,
    lineHeight: 20,
  },
  loginButtons: {
    width: '100%',
    maxWidth: 300,
    gap: 12,
  },
  signInButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  createAccountButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  centeredContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 12,
    paddingBottom: 40,
  },
});