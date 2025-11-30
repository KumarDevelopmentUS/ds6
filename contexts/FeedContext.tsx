// contexts/FeedContext.tsx
import React, { createContext, ReactNode, useContext } from 'react';
import { useUserCommunities } from '../hooks/useSocialFeatures';
import { useAuth } from './AuthContext';

// Define the shape of a community
interface Community {
  id: number;
  name: string;
  type: 'general' | 'school' | 'private' | null;
  description?: string;
  created_at: string;
  // New fields for private communities
  icon?: string | null;
  icon_color?: string | null;
  background_color?: string | null;
  is_private?: boolean | null;
  creator_id?: string | null;
  invite_code?: string | null;
}

// Define the shape of a single community membership object
export interface UserCommunityMembership {
  id: number;
  user_id: string;
  community_id: number;
  joined_at: string;
  role?: string | null;
  communities: Community;
}

// Define the shape of the context's value for full type safety
interface FeedContextType {
  communities: UserCommunityMembership[] | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

// Create the context with `undefined` as the default value.
const FeedContext = createContext<FeedContextType | undefined>(undefined);

// Define the type for the provider's props
interface FeedProviderProps {
  children: ReactNode;
}

// Provider component
export function FeedProvider({ children }: FeedProviderProps) {
  // Destructure the hook results
  const { data: communities, isLoading, error, refetch } = useUserCommunities();
  const { session } = useAuth();



  const value: FeedContextType = {
    communities: communities as UserCommunityMembership[] | undefined,
    isLoading,
    error,
    refetch,
  };



  return (
    <FeedContext.Provider value={value}>
      {children}
    </FeedContext.Provider>
  );
}

// Custom hook to use the context
export const useFeed = (): FeedContextType => {
  const context = useContext(FeedContext);
  if (context === undefined) {
    throw new Error('useFeed must be used within a FeedProvider');
  }



  return context;
};