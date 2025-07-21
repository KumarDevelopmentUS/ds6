// contexts/FeedContext.tsx
import React, { createContext, useContext, ReactNode } from 'react';
import { useUserCommunities } from '../hooks/useSocialFeatures';
import { Community } from '../types/social'; // Assuming you have a Community type

// Define the shape of a single community membership object
// This should match the data returned by your 'useUserCommunities' hook
export interface UserCommunityMembership {
  user_id: string;
  community_id: number;
  communities: Community; // Use the imported Community type for better safety
}

// Define the shape of the context's value for full type safety
interface FeedContextType {
  communities: UserCommunityMembership[];
  isLoading: boolean;
  error: Error | null;
}

// Create the context with `undefined` as the default value.
const FeedContext = createContext<FeedContextType | undefined>(undefined);

// Define the type for the provider's props
interface FeedProviderProps {
  children: ReactNode;
}

// Ensure the provider function is exported
export function FeedProvider({ children }: FeedProviderProps) {
  // Destructure 'error' from the useUserCommunities hook
  const { data: communities, isLoading, error } = useUserCommunities();

  const value = {
    communities: communities || [],
    isLoading,
    error,
  };

  return (
    <FeedContext.Provider value={value}>
      {children}
    </FeedContext.Provider>
  );
}

// Ensure the custom hook is exported correctly
export const useFeed = () => {
  const context = useContext(FeedContext);
  if (context === undefined) {
    throw new Error('useFeed must be used within a FeedProvider');
  }
  return context;
};