// utils/profilePicturePassword.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

// 🔐 SECRET PASSWORD - CHANGE THIS TO YOUR DESIRED PASSWORD
// Store this in a secure environment variable or config file in production
const PROFILE_PICTURE_PASSWORD = 'idealTax';

// Storage key for remembering if user has entered password in this session
const PASSWORD_VERIFIED_KEY = 'profile_picture_password_verified';

/**
 * Verify the password for profile picture uploads
 * @param password - The password entered by the user
 * @returns Promise<boolean> - True if password is correct
 */
export const verifyProfilePicturePassword = async (password: string): Promise<boolean> => {
  return password === PROFILE_PICTURE_PASSWORD;
};

/**
 * Check if the user has already verified the password in this session
 * @returns Promise<boolean> - True if password was already verified
 */
export const isPasswordVerified = async (): Promise<boolean> => {
  try {
    const verified = await AsyncStorage.getItem(PASSWORD_VERIFIED_KEY);
    return verified === 'true';
  } catch (error) {
    console.error('Error checking password verification status:', error);
    return false;
  }
};

/**
 * Mark the password as verified for this session
 */
export const markPasswordVerified = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(PASSWORD_VERIFIED_KEY, 'true');
  } catch (error) {
    console.error('Error marking password as verified:', error);
  }
};

/**
 * Clear the password verification status (useful for logout)
 */
export const clearPasswordVerification = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(PASSWORD_VERIFIED_KEY);
  } catch (error) {
    console.error('Error clearing password verification:', error);
  }
};

/**
 * Get the password for development/testing purposes
 * ⚠️ REMOVE THIS IN PRODUCTION
 */
export const getPasswordForDevelopment = (): string => {
  console.warn('⚠️ getPasswordForDevelopment should not be used in production!');
  return PROFILE_PICTURE_PASSWORD;
};
