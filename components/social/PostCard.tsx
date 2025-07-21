// components/social/PostCard.tsx
import { Ionicons } from '@expo/vector-icons';
import * as Device from 'expo-device';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { memo, useState } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { getSchoolByValue } from '@/constants/schools';
// Note: You will need to update your actual Post type definition where it lives.
import { Post as BasePost } from '../../types/social';
import { UserAvatar } from './UserAvatar';
import { VoteButtons } from './VoteButtons';

// Extend the base Post type to include the author's username for display
type Post = BasePost & {
  author_username: string; // Added for @username display
};

const AnimatedImage = Animated.createAnimatedComponent(Image);

interface PostCardProps {
  post: Post & { community_name?: string };
  onPress: () => void;
  onVote: (voteType: -1 | 1) => void;
  userVote?: -1 | 1 | null;
}

const isIOSSimulator = Platform.OS === 'ios' && !Device.isDevice;
const blurhash = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4';

// Define the component with a clear function name to satisfy 'react/display-name'
const PostCardComponent: React.FC<PostCardProps> = ({
  post,
  onPress,
  onVote,
  userVote,
}) => {
  const [imageModalVisible, setImageModalVisible] = useState(false);

  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const pinchGesture = Gesture.Pinch()
    .onUpdate(event => {
      scale.value = event.scale;
    })
    .onEnd(() => {
      scale.value = withTiming(1);
      translateX.value = withTiming(0);
      translateY.value = withTiming(0);
    });

  const panGesture = Gesture.Pan()
    .onUpdate(event => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
    })
    .onEnd(() => {
      scale.value = withTiming(1);
      translateX.value = withTiming(0);
      translateY.value = withTiming(0);
    });

  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const handleOpenInBrowser = () => {
    if (post.image_url) {
      Linking.openURL(post.image_url);
    }
  };

  const school = post.community_name
    ? getSchoolByValue(post.community_name)
    : undefined;
  const displayName = school ? school.display : post.community_name;

  return (
    <>
      <Modal
        animationType="fade"
        transparent={true}
        visible={imageModalVisible}
        onRequestClose={() => setImageModalVisible(false)}
      >
        <Pressable
          style={styles.modalContainer}
          onPress={() => setImageModalVisible(false)}
        >
          <GestureDetector gesture={composedGesture}>
            <AnimatedImage
              source={{ uri: post?.image_url }}
              style={[styles.modalImage, animatedStyle]}
              contentFit="contain"
            />
          </GestureDetector>
        </Pressable>
      </Modal>

      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={styles.container}
      >
        <View style={styles.header}>
          <UserAvatar
            icon={post.author_avatar_icon}
            iconColor={post.author_avatar_icon_color}
            backgroundColor={post.author_avatar_background_color}
            size={36}
          />
          <View style={styles.headerText}>
            <View style={styles.topRow}>
              <View>
                <Text style={styles.authorName}>{post.author_name}</Text>
                {/* Display @username below the author name, as requested */}
                <Text style={styles.username}>@{post.author_username}</Text>
              </View>
              {displayName && (
                <View style={styles.communityBadge}>
                  <Text style={styles.communityName}>{displayName}</Text>
                </View>
              )}
            </View>
            <Text style={styles.timestamp}>
              {new Date(post.created_at).toLocaleDateString()}
            </Text>
          </View>
        </View>

        <Text style={styles.title}>{post.title}</Text>

        {post.content && (
          <Text style={styles.content} numberOfLines={3}>
            {post.content}
          </Text>
        )}

        {post.image_url &&
          (isIOSSimulator ? (
            <TouchableOpacity
              style={styles.simulatorImageContainer}
              onPress={handleOpenInBrowser}
            >
              <Ionicons name="image" size={50} color="#007AFF" />
              <Text style={styles.simulatorImageText}>Image Available</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => setImageModalVisible(true)}
              activeOpacity={0.9}
            >
              <View style={styles.imageContainer}>
                <Image
                  source={{ uri: post.image_url }}
                  style={styles.image}
                  placeholder={{ blurhash }}
                  contentFit="contain"
                  transition={500}
                />
              </View>
            </TouchableOpacity>
          ))}

        <View style={styles.footer}>
          <VoteButtons
            likeCount={post.like_count}
            onVote={onVote}
            userVote={userVote || null}
          />
          <View style={styles.commentButton}>
            <Ionicons name="chatbubble-outline" size={18} color="#666" />
            <Text style={styles.commentCount}>{post.comment_count}</Text>
          </View>
        </View>
      </TouchableOpacity>
    </>
  );
};

// Export the memoized component
export const PostCard = memo(PostCardComponent);

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerText: {
    marginLeft: 12,
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start', // Changed to flex-start for multi-line text
    justifyContent: 'space-between',
    gap: 8,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  username: {
    // New style for the @username
    fontSize: 13,
    color: '#555',
  },
  communityBadge: {
    backgroundColor: '#e8f4ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginTop: 2, // Align with author name
  },
  communityName: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
  },
  timestamp: {
    fontSize: 12,
    color: '#666',
    marginTop: 4, // Adjusted margin
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  content: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 12,
  },
  imageContainer: {
    width: '100%',
    marginBottom: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: undefined,
    aspectRatio: 1,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width: 380,
    height: 380,
  },
  simulatorImageContainer: {
    width: '100%',
    height: 200,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e1e4e8',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  simulatorImageText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    marginTop: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  commentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  commentCount: {
    fontSize: 14,
    color: '#666',
  },
});
