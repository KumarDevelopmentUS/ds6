// components/social/CommentSection.tsx
import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  StyleSheet,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { UserAvatar } from './UserAvatar';
import { Comment } from '../../types/social';
import { Ionicons } from '@expo/vector-icons';

interface CommentSectionProps {
  comments: Comment[];
  onAddComment: (content: string, parentId?: number) => void;
}

export const CommentSection: React.FC<CommentSectionProps> = ({ comments, onAddComment }) => {
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

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    padding: 16,
    marginTop: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#000',
  },
  replyingToContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f5f5f5',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  replyingToText: {
    fontSize: 14,
    color: '#666',
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
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 40,
    maxHeight: 100,
    fontSize: 14,
  },
  submitButton: {
    backgroundColor: '#007AFF',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  commentsList: {
    maxHeight: 400,
  },
  commentContainer: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
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
    color: '#000',
    fontSize: 14,
  },
  timestamp: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  commentContent: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
    lineHeight: 20,
    marginLeft: 40,
  },
  replyButton: {
    marginLeft: 40,
  },
  replyButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
  },
  repliesContainer: {
    marginTop: 12,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
    marginTop: 20,
  },
});