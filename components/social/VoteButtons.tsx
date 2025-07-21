// components/social/VoteButtons.tsx
import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface VoteButtonsProps {
  likeCount: number;
  onVote: (voteType: -1 | 1) => void;
  userVote: -1 | 1 | null;
}

export const VoteButtons: React.FC<VoteButtonsProps> = ({ likeCount, onVote, userVote }) => {
  const [localVote, setLocalVote] = useState(userVote);
  const [displayCount, setDisplayCount] = useState(likeCount);

  useEffect(() => {
    setLocalVote(userVote);
  }, [userVote]);

  useEffect(() => {
    setDisplayCount(likeCount);
  }, [likeCount]);

  const handleVote = (voteType: -1 | 1) => {
    let newCount = displayCount;
    
    if (localVote === voteType) {
      // Removing vote
      setLocalVote(null);
      newCount = displayCount + (voteType === 1 ? -1 : 1);
    } else if (localVote === null) {
      // Adding new vote
      setLocalVote(voteType);
      newCount = displayCount + (voteType === 1 ? 1 : -1);
    } else {
      // Changing vote
      setLocalVote(voteType);
      newCount = displayCount + (voteType === 1 ? 2 : -2);
    }
    
    setDisplayCount(newCount);
    onVote(voteType);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={() => handleVote(1)}
        style={[styles.button, localVote === 1 && styles.activeUpvote]}
      >
        <Ionicons
          name="arrow-up"
          size={18}
          color={localVote === 1 ? '#007AFF' : '#666'}
        />
      </TouchableOpacity>

      <Text style={[styles.count, localVote !== null && styles.activeCount]}>
        {displayCount}
      </Text>

      <TouchableOpacity
        onPress={() => handleVote(-1)}
        style={[styles.button, localVote === -1 && styles.activeDownvote]}
      >
        <Ionicons
          name="arrow-down"
          size={18}
          color={localVote === -1 ? '#FF3B30' : '#666'}
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  button: {
    padding: 6,
    borderRadius: 4,
  },
  activeUpvote: {
    backgroundColor: '#007AFF20',
  },
  activeDownvote: {
    backgroundColor: '#FF3B3020',
  },
  count: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    minWidth: 20,
    textAlign: 'center',
  },
  activeCount: {
    color: '#000',
  },
});