import { supabase } from '@/supabase';

/**
 * Helper to safely get image URLs for display
 * Handles both public and private bucket URLs
 */
export const getSafeImageUrl = async (imageUrl: string | null): Promise<string | null> => {
  if (!imageUrl) return null;
  
  try {
    // If it's already a valid HTTP URL, return it
    if (imageUrl.startsWith('http')) {
      return imageUrl;
    }
    
    // If it looks like a storage path, try to get a signed URL
    if (imageUrl.includes('/')) {
      const parts = imageUrl.split('/');
      const fileName = parts[parts.length - 1];
      const bucketName = imageUrl.includes('profile-') ? 'profile-pictures' : 'post-images';
      
      const { data, error } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(fileName, 3600); // 1 hour expiry
      
      if (error) {
        console.warn('Failed to create signed URL for:', imageUrl, error);
        return null;
      }
      
      return data.signedUrl;
    }
    
    return imageUrl;
  } catch (error) {
    console.warn('Error processing image URL:', imageUrl, error);
    return null;
  }
};

/**
 * Fallback image URL for when images fail to load
 */
export const getFallbackImageUrl = (): string => {
  return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xMDAgNTBMMTUwIDEyNUg1MEwxMDAgNTBaIiBmaWxsPSIjOUNBM0FGIi8+CjwvZ3ZnPgo=';
};
