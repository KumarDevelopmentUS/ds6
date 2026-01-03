// components/social/CommentSection.tsx
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    FlatList,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { Comment } from '../../types/social';
import { UserAvatar } from './UserAvatar';

interface CommentSectionProps {
  comments: Comment[];
  onAddComment: (content: string, parentId?: number) => void;
}

export const CommentSection: React.FC<CommentSectionProps> = ({ comments, onAddComment }) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<{ id: number; name: string } | null>(null);

  const handleSubmit = () => {
    if (newComment.trim()) {
      onAddComment(newComment, replyingTo?.id);
      setNewComment('');
      setReplyingTo(null);
    }
  };

  const renderComment = ({ item, depth = 0 }: { item: Comment; depth?: number }) => (
    <View style={[styles.commentContainer, depth > 0 && { marginLeft: depth * 20 }]}>
      <View style={styles.commentHeader}>
        <UserAvatar
          icon={item.author_avatar_icon}
          iconColor={item.author_avatar_icon_color}
          backgroundColor={item.author_avatar_background_color}
          size={32}
        />
        <View style={styles.commentInfo}>
          <Text style={styles.userName}>{item.author_name}</Text>
          <Text style={styles.timestamp}>
            {new Date(item.created_at).toLocaleString()}
          </Text>
        </View>
      </View>
      
      <Text style={styles.commentContent}>{item.content}</Text>
      
      <TouchableOpacity
        onPress={() => setReplyingTo({ id: item.id, name: item.author_name })}
        style={styles.replyButton}
      >
        <Text style={styles.replyButtonText}>Reply</Text>
      </TouchableOpacity>

      {item.replies && item.replies.length > 0 && (
        <View style={styles.repliesContainer}>
          {item.replies.map((reply) => (
            <View key={reply.id}>
              {renderComment({ item: reply, depth: depth + 1 })}
            </View>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Comments</Text>
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {replyingTo && (
          <View style={styles.replyingToContainer}>
            <Text style={styles.replyingToText}>
              Replying to {replyingTo.name}
            </Text>
            <TouchableOpacity
              onPress={() => setReplyingTo(null)}
              style={styles.cancelReplyButton}
            >
              <Ionicons name="close" size={18} color="#666" />
            </TouchableOpacity>
          </View>
        )}
        
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder={replyingTo ? "Write a reply..." : "Add a comment..."}
            placeholderTextColor="#999"
            value={newComment}
            onChangeText={setNewComment}
            multiline
          />
          <TouchableOpacity 
            onPress={handleSubmit} 
            style={[styles.submitButton, !newComment.trim() && styles.submitButtonDisabled]}
            disabled={!newComment.trim()}
          >
            <Ionicons name="send" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <FlatList
        data={comments.filter(c => !c.parent_comment_id)}
        renderItem={({ item }) => renderComment({ item })}
        keyExtractor={(item) => item.id.toString()}
        style={styles.commentsList}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No comments yet. Be the first to comment!</Text>
        }
      />
    </View>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    backgroundColor: theme.colors.card,
    padding: 16,
    marginTop: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: theme.colors.textPrimary,
  },
  replyingToContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.backgroundSecondary,
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  replyingToText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  cancelReplyButton: {
    padding: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    backgroundColor: theme.colors.inputBackground,
    color: theme.colors.textPrimary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 40,
    maxHeight: 100,
    fontSize: 14,
  },
  submitButton: {
    backgroundColor: theme.colors.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: theme.colors.buttonDisabled,
  },
  commentsList: {
    maxHeight: 400,
  },
  commentContainer: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  commentInfo: {
    marginLeft: 8,
    flex: 1,
  },
  userName: {
    fontWeight: '600',
    color: theme.colors.textPrimary,
    fontSize: 14,
  },
  timestamp: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  commentContent: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 8,
    lineHeight: 20,
    marginLeft: 40,
  },
  replyButton: {
    marginLeft: 40,
  },
  replyButtonText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  repliesContainer: {
    marginTop: 12,
  },
  emptyText: {
    textAlign: 'center',
    color: theme.colors.textSecondary,
    fontSize: 14,
    marginTop: 20,
  },
});