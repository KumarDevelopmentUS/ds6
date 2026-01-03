import { CommunityIcon } from '@/components/CommunityIcon';
import { getSchoolByValue } from '@/constants/schools';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

const { height: screenHeight } = Dimensions.get('window');

type CommunityDetails = {
  id: number;
  name: string;
  type: string | null;
  icon: string | null;
  icon_color: string | null;
  background_color: string | null;
  is_private: boolean | null;
  creator_id: string | null;
};

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
  const router = useRouter();
  const { session } = useAuth();
  const { theme } = useTheme();
  const currentUserId = session?.user?.id;
  const [showWebConfirm, setShowWebConfirm] = useState(false);
  const isWeb = Platform.OS === 'web';

  // Community details state
  const [communityDetails, setCommunityDetails] = useState<CommunityDetails | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Animation and gesture handling
  const pan = useRef(new Animated.ValueXY()).current;
  const panelHeight = screenHeight * 0.7;
  const isClosing = useRef(false);
  const [internalVisible, setInternalVisible] = useState(visible);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 10;
      },
      onPanResponderGrant: () => {
        pan.setOffset({
          x: 0,
          y: 0,
        });
      },
      onPanResponderTerminate: () => {
        // Reset if gesture is interrupted
        pan.flattenOffset();
        Animated.spring(pan.y, {
          toValue: 0,
          useNativeDriver: false,
        }).start();
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow downward movement
        if (gestureState.dy > 0) {
          pan.y.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        pan.flattenOffset();
        
        // If dragged down more than 100px or with sufficient velocity, close the panel
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          if (!isClosing.current) {
            isClosing.current = true;
            Animated.timing(pan.y, {
              toValue: panelHeight,
              duration: 300,
              useNativeDriver: false,
            }).start(() => {
              // Reset position for next open
              pan.setValue({ x: 0, y: 0 });
              isClosing.current = false;
              // Hide internally first, then notify parent
              setInternalVisible(false);
              setTimeout(() => {
                onClose();
              }, 100);
            });
          }
        } else {
          // Snap back to original position
          Animated.spring(pan.y, {
            toValue: 0,
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  // Sync internal state with external visible prop
  useEffect(() => {
    setInternalVisible(visible);
  }, [visible]);

  // Reset panel position when modal becomes visible
  useEffect(() => {
    if (visible) {
      pan.setValue({ x: 0, y: 0 });
      isClosing.current = false;
      // Load community details when panel opens
      loadCommunityDetails();
    }
  }, [visible, pan, communityId]);

  const loadCommunityDetails = async () => {
    if (!communityId || !currentUserId) return;
    setLoadingDetails(true);

    try {
      // Load community details
      const { data: community, error: communityError } = await supabase
        .from('communities')
        .select('id, name, type, icon, icon_color, background_color, is_private, creator_id')
        .eq('id', communityId)
        .single();

      if (communityError) throw communityError;
      setCommunityDetails(community);

      // Load user's role
      const { data: membership, error: membershipError } = await supabase
        .from('user_communities')
        .select('role')
        .eq('community_id', communityId)
        .eq('user_id', currentUserId)
        .single();

      if (membershipError && membershipError.code !== 'PGRST116') {
        throw membershipError;
      }
      setUserRole(membership?.role || 'member');
    } catch (error) {
      console.error('Error loading community details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleLeaveCommunity = () => {
    // Check if user is the owner of a private community
    if (communityDetails?.is_private && userRole === 'owner') {
      if (isWeb) {
        alert('As the owner, you cannot leave this community. You can delete it from the Manage Community page.');
      } else {
        Alert.alert(
          'Cannot Leave',
          'As the owner, you cannot leave this community. You can delete it from the Manage Community page.',
          [{ text: 'OK' }]
        );
      }
      return;
    }

    if (isWeb) {
      setShowWebConfirm(true);
    } else {
      Alert.alert(
        'Leave Community',
        `Are you sure you want to leave ${displayCommunityName}? This action can not be undone.`,
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

  const handleManageCommunity = () => {
    onClose();
    router.push({
      pathname: '/manage-community',
      params: { communityId: String(communityId) }
    });
  };

  // Process community name to use proper school display name if needed
  const displayCommunityName = (() => {
    const nameToProcess = communityDetails?.name || communityName;
    if (nameToProcess.includes('_') && nameToProcess !== 'All Communities') {
      const school = getSchoolByValue(nameToProcess);
      return school ? school.name : nameToProcess.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    return nameToProcess;
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

  const isPrivateCommunity = communityDetails?.is_private || communityDetails?.type === 'private';
  const isOwnerOrAdmin = userRole === 'owner' || userRole === 'admin';

  return (
    <>
      <Modal
        visible={internalVisible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
        statusBarTranslucent
      >
        <View style={styles.overlay}>
          <TouchableOpacity 
            style={styles.backdrop} 
            onPress={() => {
              if (!isClosing.current) {
                onClose();
              }
            }} 
          />
          <Animated.View 
            style={[
              styles.panel,
              {
                transform: [{ translateY: pan.y }],
                backgroundColor: theme.colors.card,
              }
            ]}
            {...panResponder.panHandlers}
          >
            {/* Handle bar */}
            <View style={styles.handleBar}>
              <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
            </View>

            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Community Settings</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollContent}>
            {/* Content */}
            <View style={styles.content}>
                {loadingDetails ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                  </View>
                ) : (
                  <>
              {/* Community Info Section */}
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Community Information</Text>
                
                      {/* Community Icon for private communities */}
                      {isPrivateCommunity && communityDetails && (
                        <View style={[styles.communityIconRow, { backgroundColor: theme.colors.backgroundTertiary }]}>
                          <CommunityIcon
                            icon={communityDetails.icon}
                            iconColor={communityDetails.icon_color}
                            backgroundColor={communityDetails.background_color}
                            size={60}
                          />
                          <View style={styles.communityIconInfo}>
                            <Text style={[styles.communityIconName, { color: theme.colors.text }]}>{displayCommunityName}</Text>
                            <View style={[styles.privateBadge, { backgroundColor: theme.dark ? theme.colors.backgroundSecondary : '#E8F4FD' }]}>
                              <Ionicons name="lock-closed" size={12} color={theme.colors.primary} />
                              <Text style={[styles.privateBadgeText, { color: theme.colors.primary }]}>Private Community</Text>
                            </View>
                          </View>
                        </View>
                      )}

                      {!isPrivateCommunity && (
                <View style={styles.infoRow}>
                  <View style={[styles.infoIcon, { backgroundColor: theme.dark ? theme.colors.backgroundSecondary : '#F0F8FF' }]}>
                    <Ionicons name="people" size={20} color={theme.colors.primary} />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>Community Name</Text>
                    <Text style={[styles.infoValue, { color: theme.colors.text }]}>{displayCommunityName}</Text>
                  </View>
                </View>
                      )}

                <View style={styles.infoRow}>
                  <View style={[styles.infoIcon, { backgroundColor: theme.dark ? theme.colors.backgroundSecondary : '#F0F8FF' }]}>
                    <Ionicons name="calendar" size={20} color={theme.colors.primary} />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>Joined On</Text>
                    <Text style={[styles.infoValue, { color: theme.colors.text }]}>{formatJoinedDate(joinedAt)}</Text>
                  </View>
                </View>

                      {userRole && (
                        <View style={styles.infoRow}>
                          <View style={[styles.infoIcon, { backgroundColor: theme.dark ? theme.colors.backgroundSecondary : '#F0F8FF' }]}>
                            <Ionicons 
                              name={userRole === 'owner' ? 'star' : userRole === 'admin' ? 'shield' : 'person'} 
                              size={20} 
                              color={theme.colors.primary} 
                            />
                          </View>
                          <View style={styles.infoContent}>
                            <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>Your Role</Text>
                            <Text style={[styles.infoValue, { color: theme.colors.text }]}>
                              {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
                            </Text>
                          </View>
                        </View>
                      )}
              </View>

              {/* Actions Section */}
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Actions</Text>
                      
                      {/* Manage Community (for owners/admins of private communities) */}
                      {isPrivateCommunity && isOwnerOrAdmin && (
                        <TouchableOpacity
                          style={[styles.manageButton, { backgroundColor: theme.dark ? theme.colors.backgroundSecondary : '#F0F8FF', borderColor: theme.dark ? theme.colors.border : '#E0EFFF' }]}
                          onPress={handleManageCommunity}
                        >
                          <View style={styles.actionIcon}>
                            <Ionicons name="settings-outline" size={20} color={theme.colors.primary} />
                          </View>
                          <Text style={[styles.manageButtonText, { color: theme.colors.primary }]}>Manage Community</Text>
                          <Ionicons name="chevron-forward" size={16} color={theme.colors.textSecondary} />
                        </TouchableOpacity>
                      )}
                
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: theme.dark ? theme.colors.errorBackground : '#FFF5F5', borderColor: theme.dark ? theme.colors.error : '#FFE5E5' }]}
                  onPress={handleLeaveCommunity}
                >
                  <View style={styles.actionIcon}>
                    <Ionicons name="exit-outline" size={20} color={theme.colors.error} />
                  </View>
                  <Text style={[styles.actionText, { color: theme.colors.error }]}>Leave Community</Text>
                  <Ionicons name="chevron-forward" size={16} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>
                  </>
                )}
            </View>
            </ScrollView>
          </Animated.View>
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
            <View style={[styles.webConfirmDialog, { backgroundColor: theme.colors.card }]}>
              <Text style={[styles.webConfirmTitle, { color: theme.colors.text }]}>Leave Community</Text>
              <Text style={[styles.webConfirmMessage, { color: theme.colors.textSecondary }]}>
                Are you sure you want to leave {displayCommunityName}? This action can not be undone.
              </Text>
              <View style={styles.webConfirmButtons}>
                <TouchableOpacity
                  style={[styles.webConfirmButton, styles.webConfirmButtonCancel, { backgroundColor: theme.colors.backgroundTertiary, borderColor: theme.colors.border }]}
                  onPress={() => setShowWebConfirm(false)}
                >
                  <Text style={[styles.webConfirmButtonTextCancel, { color: theme.colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.webConfirmButton, styles.webConfirmButtonLeave, { backgroundColor: theme.colors.error }]}
                  onPress={performLeaveCommunity}
                >
                  <Text style={[styles.webConfirmButtonTextLeave, { color: theme.colors.textOnPrimary }]}>Leave</Text>
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
  scrollContent: {
    maxHeight: screenHeight * 0.55,
  },
  content: {
    padding: 20,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
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
  communityIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
  },
  communityIconInfo: {
    marginLeft: 16,
    flex: 1,
  },
  communityIconName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  privateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F4FD',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  privateBadgeText: {
    fontSize: 12,
    color: '#007AFF',
    marginLeft: 4,
    fontWeight: '500',
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
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#F0F8FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0EFFF',
    marginBottom: 12,
  },
  manageButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#007AFF',
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
