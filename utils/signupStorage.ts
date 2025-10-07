// utils/signupStorage.ts
/**
 * Temporary storage for signup data during magic link flow
 * This ensures user data is preserved between signup and callback
 */

const SIGNUP_DATA_KEY = 'pending_signup_data';
const SIGNUP_EMAIL_KEY = 'pending_signup_email';
const SIGNUP_TIMESTAMP_KEY = 'pending_signup_timestamp';
const EXPIRY_TIME = 30 * 60 * 1000; // 30 minutes

export interface PendingSignupData {
  email: string;
  username: string;
  nickname: string;
  firstName: string;
  school?: string;
  timestamp: number;
}

/**
 * Store signup data temporarily
 */
export const storePendingSignupData = (data: Omit<PendingSignupData, 'timestamp'>): void => {
  try {
    const signupData: PendingSignupData = {
      ...data,
      timestamp: Date.now(),
    };
    
    if (typeof window !== 'undefined') {
      localStorage.setItem(SIGNUP_DATA_KEY, JSON.stringify(signupData));
      localStorage.setItem(SIGNUP_EMAIL_KEY, data.email.toLowerCase());
      localStorage.setItem(SIGNUP_TIMESTAMP_KEY, signupData.timestamp.toString());
    }
    
    console.log('📦 Stored pending signup data for:', data.email);
  } catch (error) {
    console.error('❌ Failed to store pending signup data:', error);
  }
};

/**
 * Retrieve and clear signup data for a specific email
 */
export const retrievePendingSignupData = (email: string): PendingSignupData | null => {
  try {
    if (typeof window === 'undefined') {
      return null;
    }

    const storedData = localStorage.getItem(SIGNUP_DATA_KEY);
    const storedEmail = localStorage.getItem(SIGNUP_EMAIL_KEY);
    const storedTimestamp = localStorage.getItem(SIGNUP_TIMESTAMP_KEY);
    
    if (!storedData || !storedEmail || !storedTimestamp) {
      return null;
    }

    // Check if the email matches
    if (storedEmail.toLowerCase() !== email.toLowerCase()) {
      console.log('⚠️ Stored email does not match current user email');
      return null;
    }

    // Check if data has expired
    const timestamp = parseInt(storedTimestamp, 10);
    if (Date.now() - timestamp > EXPIRY_TIME) {
      console.log('⚠️ Pending signup data has expired');
      clearPendingSignupData();
      return null;
    }

    const data = JSON.parse(storedData) as PendingSignupData;
    console.log('✅ Retrieved pending signup data for:', email);
    
    // Clear the data after successful retrieval
    clearPendingSignupData();
    
    return data;
  } catch (error) {
    console.error('❌ Failed to retrieve pending signup data:', error);
    return null;
  }
};

/**
 * Clear pending signup data
 */
export const clearPendingSignupData = (): void => {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(SIGNUP_DATA_KEY);
      localStorage.removeItem(SIGNUP_EMAIL_KEY);
      localStorage.removeItem(SIGNUP_TIMESTAMP_KEY);
      console.log('🧹 Cleared pending signup data');
    }
  } catch (error) {
    console.error('❌ Failed to clear pending signup data:', error);
  }
};

/**
 * Check if there is pending signup data
 */
export const hasPendingSignupData = (): boolean => {
  try {
    if (typeof window === 'undefined') {
      return false;
    }

    const storedData = localStorage.getItem(SIGNUP_DATA_KEY);
    const storedTimestamp = localStorage.getItem(SIGNUP_TIMESTAMP_KEY);
    
    if (!storedData || !storedTimestamp) {
      return false;
    }

    // Check if data has expired
    const timestamp = parseInt(storedTimestamp, 10);
    if (Date.now() - timestamp > EXPIRY_TIME) {
      clearPendingSignupData();
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Failed to check pending signup data:', error);
    return false;
  }
};

