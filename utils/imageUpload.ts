import { supabase } from '@/supabase';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Request camera and media library permissions
 */
export const requestImagePermissions = async (): Promise<boolean> => {
  try {
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: mediaLibraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    return cameraStatus === 'granted' && mediaLibraryStatus === 'granted';
  } catch (error) {
    console.error('Error requesting permissions:', error);
    return false;
  }
};

/**
 * Show image picker options (camera or library)
 */
export const pickImage = async (): Promise<ImagePicker.ImagePickerResult | null> => {
  try {
    const hasPermissions = await requestImagePermissions();
    if (!hasPermissions) {
      throw new Error('Camera and media library permissions are required');
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1], // Square aspect ratio for profile pictures
      quality: 0.8,
      base64: false,
    });

    return result;
  } catch (error) {
    console.error('Error picking image:', error);
    return null;
  }
};

/**
 * Take a photo with camera
 */
export const takePhoto = async (): Promise<ImagePicker.ImagePickerResult | null> => {
  try {
    const hasPermissions = await requestImagePermissions();
    if (!hasPermissions) {
      throw new Error('Camera and media library permissions are required');
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1], // Square aspect ratio for profile pictures
      quality: 0.8,
      base64: false,
    });

    return result;
  } catch (error) {
    console.error('Error taking photo:', error);
    return null;
  }
};

/**
 * Upload image to Supabase Storage
 */
export const uploadProfilePicture = async (
  imageUri: string, 
  userId: string
): Promise<UploadResult> => {
  try {
    // Create a unique filename with proper path structure
    const fileExt = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `profile-${userId}-${Date.now()}.${fileExt}`;

    let uploadData;
    let uploadError;

    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      // For React Native (iOS/Android), use expo-file-system
      // Read the file as base64
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // Decode base64 to binary
      const decode = (base64: string) => {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
      };
      
      const imageData = decode(base64);
      
      // Upload to Supabase
      const result = await supabase.storage
        .from('profile-pictures')
        .upload(fileName, imageData.buffer, { 
          contentType: `image/${fileExt}`,
          upsert: true 
        });
      
      uploadData = result.data;
      uploadError = result.error;
    } else {
      // For web platform, use standard fetch
      const response = await fetch(imageUri);
      const blob = await response.blob();
      
      const result = await supabase.storage
        .from('profile-pictures')
        .upload(fileName, blob, {
          contentType: `image/${fileExt}`,
          upsert: true,
        });
      
      uploadData = result.data;
      uploadError = result.error;
    }

    const { data, error } = { data: uploadData, error: uploadError };

    if (error) {
      return { success: false, error: error.message };
    }

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from('profile-pictures')
      .getPublicUrl(fileName);

    return { 
      success: true, 
      url: urlData.publicUrl 
    };
  } catch (error) {
    console.error('Error uploading profile picture:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
};

/**
 * Delete profile picture from Supabase Storage
 */
export const deleteProfilePicture = async (profilePictureUrl: string): Promise<boolean> => {
  try {
    // Extract filename from URL
    const filename = profilePictureUrl.split('/').pop();
    if (!filename) {
      return false;
    }

    const { error } = await supabase.storage
      .from('profile-pictures')
      .remove([filename]);

    if (error) {
      console.error('Delete error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deleting profile picture:', error);
    return false;
  }
};

/**
 * Update user profile with new avatar URL
 */
export const updateUserProfilePicture = async (
  userId: string, 
  avatarUrl: string | null
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('user_profiles')
      .update({ avatar_url: avatarUrl })
      .eq('id', userId);

    if (error) {
      console.error('Error updating profile:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error updating user profile picture:', error);
    return false;
  }
};
