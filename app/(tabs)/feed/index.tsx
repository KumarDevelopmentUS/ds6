// app/(tabs)/feed/index.tsx
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
import { PostCard } from '@/components/social/PostCard';
import { useFeed } from '@/contexts/FeedContext';
import { usePosts, useRealtimeUpdates } from '@/hooks/useSocialFeatures';
import { getSchoolByValue } from '@/constants/schools';

export default function FeedScreen() {
  const router = useRouter();
  const { communities, isLoading: isCommunitiesLoading, error: communitiesError } = useFeed();
  const [selectedCommunityId, setSelectedCommunityId] = useState<number | null>(null);
  const [dropdownVisible, setDropdownVisible] = useState(false);

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


  const { posts, isLoading, refetch, handleVote, userVotes } = usePosts(selectedCommunityId || undefined);

  // Enable real-time updates for the selected community
  useRealtimeUpdates(selectedCommunityId || undefined);

  // Define the type for a post item (adjust as needed based on your data shape)
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
  ), [router, handleVote, userVotes]); // Dependencies for the callback

  // Handle the loading state for fetching communities
  if (isCommunitiesLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Handle any errors that occurred while fetching communities
  if (communitiesError || !communities) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Could not load communities.</Text>
      </View>
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
            onRefresh={refetch}
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
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