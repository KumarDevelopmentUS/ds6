// app/post/[id].tsx
import { HapticBackButton } from '@/components/HapticBackButton';
import { useTheme } from '@/contexts/ThemeContext';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Modal,
    Platform,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { CommentSection } from '../../components/social/CommentSection';
import MatchSummary from '../../components/social/MatchSummary';
import { UserAvatar } from '../../components/social/UserAvatar';
import { VoteButtons } from '../../components/social/VoteButtons';
import { useComments, usePost } from '../../hooks/useSocialFeatures';

const AnimatedImage = Animated.createAnimatedComponent(Image);

const formatTimestamp = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleString();
};

const blurhash = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4';

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const postId = Array.isArray(id) ? id[0] : (id as string);
  
  const { post, isLoading: postLoading, handleVote, userVote, error: postError } = usePost(postId);
  const { comments, addComment } = useComments(postId);
  const [imageModalVisible, setImageModalVisible] = useState(false);

  // Handle back navigation to feed
  const handleBackToFeed = () => {
    router.push({
      pathname: '/(tabs)/' as any,
      params: { initialTab: 'feed' }
    });
  };

  // --- Temporary Gesture State ---
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  // --- Gestures with "Snap Back" on Release ---
  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = event.scale;
    })
    .onEnd(() => {
      // Snap back to original state with a smooth animation on release
      scale.value = withTiming(1);
      translateX.value = withTiming(0);
      translateY.value = withTiming(0);
    });

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
    })
    .onEnd(() => {
      // Snap back to original state with a smooth animation on release
      scale.value = withTiming(1);
      translateX.value = withTiming(0);
      translateY.value = withTiming(0);
    });

  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture);

  // --- Animated Style ---
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  if (postLoading || !post) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </SafeAreaView>
    );
  }
  if (postError) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.errorText}>{postError?.message || "Post not found."}</Text>
      </SafeAreaView>
    );
  }

  const renderPostHeader = () => (
    <View>
      <View style={styles.postContainer}>
        <View style={styles.header}>
          <UserAvatar
            icon={post.author_avatar_icon}
            iconColor={post.author_avatar_icon_color}
            backgroundColor={post.author_avatar_background_color}
            size={Platform.OS === 'web' ? 56 : 48}
          />
          <View style={styles.headerText}>
            <Text style={styles.authorName}>{post.author_name}</Text>
            <Text style={styles.timestamp}>
              {formatTimestamp(post.created_at)}
            </Text>
          </View>
        </View>

        <Text style={styles.title}>{post.title}</Text>
        {post.content && <Text style={styles.content}>{post.content}</Text>}
        
        {post.image_url && 
          <TouchableOpacity onPress={() => setImageModalVisible(true)} activeOpacity={0.8}>
            <Image 
              source={{ uri: post.image_url }} 
              style={styles.image} 
              placeholder={{ blurhash }}
              contentFit="contain"
              transition={500}
            />
          </TouchableOpacity>
        }
        
        {/* Display linked match summary with full details if present */}
        {post.linked_match_data && (
          <MatchSummary 
            matchData={post.linked_match_data} 
            showFullDetails={true}
          />
        )}

        <View style={styles.actions}>
          <VoteButtons
            likeCount={post.like_count}
            onVote={handleVote}
            userVote={userVote ?? null}
          />
        </View>
      </View>
      <CommentSection comments={comments || []} onAddComment={addComment} />
    </View>
  );

  const renderCommentItem = ({ item }: { item: any }) => (
    <View style={styles.commentContainer}>
       <UserAvatar
        icon={item.author_avatar_icon}
        iconColor={item.author_avatar_icon_color}
        backgroundColor={item.author_avatar_background_color}
        size={32}
      />
      <View style={styles.commentTextContainer}>
        <Text style={styles.commentAuthor}>{item.author_name}</Text>
        <Text style={styles.commentContent}>{item.content}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Back Button */}
      <HapticBackButton 
        onPress={handleBackToFeed} 
        style={styles.backButton}
        color="#3b82f6"
      />

      <Modal
        animationType="fade"
        transparent={true}
        visible={imageModalVisible}
        onRequestClose={() => setImageModalVisible(false)}
      >
        <Pressable style={styles.modalContainer} onPress={() => setImageModalVisible(false)}>
            <GestureDetector gesture={composedGesture}>
                <AnimatedImage
                    source={{ uri: post?.image_url }}
                    style={[styles.modalImage, animatedStyle]}
                    contentFit="contain"
                />
            </GestureDetector>
        </Pressable>
      </Modal>

      <FlatList
        data={comments || []}
        renderItem={renderCommentItem}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={renderPostHeader}
        ListEmptyComponent={
          !postLoading && <Text style={styles.noCommentsText}>No comments yet.</Text>
        }
        contentContainerStyle={styles.listContentContainer}
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
      />
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
      },
      scrollView: {
        flex: 1,
      },
      listContentContainer: {
        padding: 20,
        paddingTop: 100,
        paddingBottom: 40,
      },
      loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
      },
      errorText: {
        fontSize: 16,
        color: theme.colors.textSecondary,
      },
      postContainer: {
        backgroundColor: theme.colors.card,
        padding: 20,
        borderRadius: 12,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: {
          width: 0,
          height: 1,
        },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
      },
      header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
      },
      headerText: { marginLeft: 12, flex: 1 },
      authorName: { 
        fontSize: Platform.OS === 'web' ? 18 : 16, 
        fontWeight: '600' 
      },
      timestamp: { 
        fontSize: Platform.OS === 'web' ? 16 : 14, 
        color: theme.colors.textSecondary, 
        marginTop: 2 
      },
      title: { 
        fontSize: Platform.OS === 'web' ? 26 : 22, 
        fontWeight: 'bold', 
        marginBottom: 12 
      },
      content: { 
        fontSize: Platform.OS === 'web' ? 18 : 16, 
        lineHeight: Platform.OS === 'web' ? 28 : 24, 
        marginBottom: 16 
      },
      image: { 
        width: '100%', 
        aspectRatio: 1.3,
        borderRadius: 8, 
        marginBottom: 16, 
        marginHorizontal: -20,
        backgroundColor: theme.colors.backgroundSecondary 
      },
      actions: { paddingTop: 16, borderTopWidth: 1, borderTopColor: theme.colors.border },
      commentContainer: {
        flexDirection: 'row',
        backgroundColor: theme.colors.card,
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: {
          width: 0,
          height: 1,
        },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
      },
      commentTextContainer: {
        marginLeft: 12,
        flex: 1,
      },
      commentAuthor: {
        fontWeight: 'bold',
        marginBottom: 4,
      },
      commentContent: {
        color: theme.colors.textSecondary,
      },
      noCommentsText: {
        textAlign: 'center',
        padding: 20,
        color: theme.colors.textSecondary,
      },
      modalContainer: {
        flex: 1,
        backgroundColor: theme.colors.overlay,
        justifyContent: 'center',
        alignItems: 'center',
      },
      modalImage: {
        width: 380,
        height: 380,
      },
      backButton: {
        position: 'absolute',
        top: 60,
        left: 20,
        flexDirection: 'row',
        alignItems: 'center',
        zIndex: 1,
      },
});