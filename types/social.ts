// types/social.ts

export interface Post {
  id: number; // Numeric ID from database
  uid: string; // UUID from database
  title: string;
  content: string;
  created_at: string;
  image_url?: string;
  like_count: number;
  comment_count: number;
  user_id: string;
  community_id: number;
  author_name: string;
  author_avatar_icon: string;
  author_avatar_icon_color: string;
  author_avatar_background_color: string;
  author_profile_picture_url?: string | null;
  username?: string;
  author_username?: string;
  linked_match_id?: string; // UUID reference to saved_matches
  linked_match_data?: MatchSummaryData | null; // Full match data when linked
}

export interface Comment {
  id: number;
  content: string;
  created_at: string;
  post_uid: string; // UUID reference to posts.uid
  user_id: string;
  parent_comment_id?: number;
  author_name: string;
  author_avatar_icon: string;
  author_avatar_icon_color: string;
  author_avatar_background_color: string;
  replies?: Comment[];
}

export interface Vote {
  id: number;
  post_uid: string; // UUID reference to posts.uid
  user_id: string;
  vote_type: -1 | 1;
}

export interface Community {
  id: number;
  name: string;
  description: string;
  type: 'school' | 'general';
  created_at?: string;
}

export interface UserCommunity {
  id: number;
  user_id: string;
  community_id: number;
  joined_at: string;
  communities?: Community;
}

// Match Summary Types for Social Posts
export interface MatchSummaryData {
  id: string;
  matchSetup: {
    title: string;
    arena: string;
    playerNames: string[];
    teamNames: string[];
    gameScoreLimit: number;
    sinkPoints: number;
    winByTwo: boolean;
  };
  playerStats: { [key: number]: PlayerStats };
  teamPenalties: { 1: number; 2: number };
  userSlotMap: { [key: string]: string | null };
  winnerTeam: number | null;
  matchDuration: number;
  matchStartTime: string;
}

export interface PlayerStats {
  // EXISTING PROPERTIES (KEEP ALL)
  name: string;
  throws: number;
  hits: number;
  blunders: number;
  catches: number;
  score: number;
  aura: number;
  fifaAttempts: number;
  fifaSuccess: number;
  hitStreak: number;
  specialThrows: number;
  lineThrows: number;
  goals: number;
  onFireCount: number;
  currentlyOnFire: boolean;
  tableDie: number;
  line: number;
  hit: number;
  knicker: number;
  dink: number;
  sink: number;
  short: number;
  long: number;
  side: number;
  height: number;
  catchPlusAura: number;
  drop: number;
  miss: number;
  twoHands: number;
  body: number;
  goodKick: number;
  badKick: number;
  
  // NEW PROPERTIES (ADDED FOR BEER DIE RULESET)
  validThrows: number;
  catchAttempts: number;
  successfulCatches: number;
  redemptionShots: number;
}