// types/social.ts

export interface Post {
  id: number;
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
}

export interface Comment {
  id: number;
  content: string;
  created_at: string;
  post_id: number;
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
  post_id: number;
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