// app/post/[id].tsx
import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ActivityIndicator,
  SafeAreaView,
  FlatList,
  Modal,
  TouchableOpacity,
  Pressable
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { UserAvatar } from '../../components/social/UserAvatar';
import { VoteButtons } from '../../components/social/VoteButtons';
import { CommentSection } from '../../components/social/CommentSection';
import { usePost, useComments } from '../../hooks/useSocialFeatures';
import { Image } from 'expo-image';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';

const AnimatedImage = Animated.createAnimatedComponent(Image);

const formatTimestamp = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleString();
};

const blurhash = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4';

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams();
  const postId = Array.isArray(id) ? parseInt(id[0], 10) : parseInt(id || '', 10);
  
  const { post, isLoading: postLoading, handleVote, userVote, error: postError } = usePost(postId);
  const { comments, addComment } = useComments(postId);
  const [imageModalVisible, setImageModalVisible] = useState(false);

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
            size={48}
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
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
      },
      listContentContainer: {
        paddingBottom: 40,
      },
      loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
      },
      errorText: {
        fontSize: 16,
        color: '#888',
      },
      postContainer: {
        backgroundColor: '#fff',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0'
      },
      header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
      },
      headerText: { marginLeft: 12, flex: 1 },
      authorName: { fontSize: 16, fontWeight: '600' },
      timestamp: { fontSize: 14, color: '#666', marginTop: 2 },
      title: { fontSize: 22, fontWeight: 'bold', marginBottom: 12 },
      content: { fontSize: 16, lineHeight: 24, marginBottom: 16 },
      image: { 
        width: '100%', 
        aspectRatio: 1.7,
        borderRadius: 8, 
        marginBottom: 16, 
        backgroundColor: '#f0f0f0' 
      },
      actions: { paddingTop: 16, borderTopWidth: 1, borderTopColor: '#eee' },
      commentContainer: {
        flexDirection: 'row',
        padding: 16,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
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
        color: '#333',
      },
      noCommentsText: {
        textAlign: 'center',
        padding: 20,
        color: '#888',
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
      }
});