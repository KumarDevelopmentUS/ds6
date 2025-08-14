import { getSchoolByValue } from '@/constants/schools';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/supabase';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    Alert,
    Dimensions,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

const { height: screenHeight } = Dimensions.get('window');

type CommunitySettingsPanelProps = {
  visible: boolean;
  onClose: () => void;
  communityId: string | number;
  communityName: string;
  joinedAt: string;
  onLeaveCommunity?: () => void;
};

export function CommunitySettingsPanel({
  visible,
  onClose,
  communityId,
  communityName,
  joinedAt,
  onLeaveCommunity,
}: CommunitySettingsPanelProps) {
  const { session } = useAuth();
  const currentUserId = session?.user?.id;
  const [showWebConfirm, setShowWebConfirm] = useState(false);
  const isWeb = Platform.OS === 'web';

  const handleLeaveCommunity = () => {
    if (isWeb) {
      setShowWebConfirm(true);
    } else {
      Alert.alert(
        'Leave Community',
        `Are you sure you want to leave "${communityName}"? You can rejoin later if you change your mind.`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Leave',
            style: 'destructive',
            onPress: async () => {
              await performLeaveCommunity();
            },
          },
        ]
      );
    }
  };

  const performLeaveCommunity = async () => {
    try {
      if (!currentUserId) return;

      const { error } = await supabase
        .from('user_communities')
        .delete()
        .eq('user_id', currentUserId)
        .eq('community_id', communityId);

      if (error) {
        throw error;
      }

      if (isWeb) {
        setShowWebConfirm(false);
        // Show web success message
        alert('Success: You have left the community');
      } else {
        Alert.alert('Success', 'You have left the community');
      }
      
      onClose();
      // Call the callback to handle post-leave actions
      if (onLeaveCommunity) {
        onLeaveCommunity();
      }
    } catch (error) {
      console.error('Error leaving community:', error);
      if (isWeb) {
        alert('Error: Could not leave community. Please try again.');
      } else {
        Alert.alert('Error', 'Could not leave community. Please try again.');
      }
    }
  };

  // Process community name to use proper school display name if needed
  const displayCommunityName = (() => {
    if (communityName.includes('_') && communityName !== 'All Communities') {
      const school = getSchoolByValue(communityName);
      return school ? school.name : communityName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    return communityName;
  })();

  const formatJoinedDate = (dateString: string) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Unknown';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
        statusBarTranslucent
      >
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.backdrop} onPress={onClose} />
          <View style={styles.panel}>
            {/* Handle bar */}
            <View style={styles.handleBar}>
              <View style={styles.handle} />
            </View>

            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Community Settings</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Content */}
            <View style={styles.content}>
              {/* Community Info Section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Community Information</Text>
                
                <View style={styles.infoRow}>
                  <View style={styles.infoIcon}>
                    <Ionicons name="people" size={20} color="#007AFF" />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Community Name</Text>
                    <Text style={styles.infoValue}>{displayCommunityName}</Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <View style={styles.infoIcon}>
                    <Ionicons name="calendar" size={20} color="#007AFF" />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Joined On</Text>
                    <Text style={styles.infoValue}>{formatJoinedDate(joinedAt)}</Text>
                  </View>
                </View>
              </View>

              {/* Actions Section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Actions</Text>
                
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={handleLeaveCommunity}
                >
                  <View style={styles.actionIcon}>
                    <Ionicons name="exit-outline" size={20} color="#FF3B30" />
                  </View>
                  <Text style={styles.actionText}>Leave Community</Text>
                  <Ionicons name="chevron-forward" size={16} color="#666" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Web Confirmation Dialog */}
      {isWeb && showWebConfirm && (
        <Modal
          visible={showWebConfirm}
          transparent
          animationType="fade"
          onRequestClose={() => setShowWebConfirm(false)}
        >
          <View style={styles.webConfirmOverlay}>
            <View style={styles.webConfirmDialog}>
              <Text style={styles.webConfirmTitle}>Leave Community</Text>
              <Text style={styles.webConfirmMessage}>
                Are you sure you want to leave &ldquo;{displayCommunityName}&rdquo;? You can rejoin later if you change your mind.
              </Text>
              <View style={styles.webConfirmButtons}>
                <TouchableOpacity
                  style={[styles.webConfirmButton, styles.webConfirmButtonCancel]}
                  onPress={() => setShowWebConfirm(false)}
                >
                  <Text style={styles.webConfirmButtonTextCancel}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.webConfirmButton, styles.webConfirmButtonLeave]}
                  onPress={performLeaveCommunity}
                >
                  <Text style={styles.webConfirmButtonTextLeave}>Leave</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  panel: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: screenHeight * 0.7,
    minHeight: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  handleBar: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F8FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#FFF5F5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFE5E5',
    marginTop: 8,
  },
  actionIcon: {
    marginRight: 12,
  },
  actionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#FF3B30',
  },
  // Web confirmation dialog styles
  webConfirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    ...(Platform.OS === 'web' && {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    }),
  },
  webConfirmDialog: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    maxWidth: 400,
    minWidth: 300,
    width: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  webConfirmTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
    textAlign: 'center',
  },
  webConfirmMessage: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
    marginBottom: 24,
    textAlign: 'center',
  },
  webConfirmButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  webConfirmButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  webConfirmButtonCancel: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  webConfirmButtonLeave: {
    backgroundColor: '#FF3B30',
  },
  webConfirmButtonTextCancel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  webConfirmButtonTextLeave: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
});
