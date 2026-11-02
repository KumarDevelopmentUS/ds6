// utils/liveMatchJoin.ts
import { supabase } from '@/supabase';

export type JoinLiveMatchResult =
  | {
      status: 'joined';
      slot: number;
      nickname: string;
      userSlotMap: { [key: string]: string | null };
      participants: string[];
      matchSetup: any;
      livePlayerStats: any;
    }
  | { status: 'already_in_slot'; slot: number }
  | { status: 'already_joined'; slot: number }
  | { status: 'slot_taken' }
  | { status: 'not_active' };

// PostgREST error code when an RPC function doesn't exist
const FUNCTION_NOT_FOUND = 'PGRST202';

/**
 * Claim a player slot in a live match.
 *
 * Uses the `join_live_match` database function, which locks the match row so
 * two players joining at once can't overwrite each other's slot. Falls back to
 * the old client-side update if the function hasn't been deployed yet.
 */
export async function joinLiveMatch(matchId: string, slot: number): Promise<JoinLiveMatchResult> {
  const { data, error } = await supabase.rpc('join_live_match', {
    p_match_id: matchId,
    p_slot: slot,
  });

  if (!error) {
    return data as JoinLiveMatchResult;
  }

  if (error.code !== FUNCTION_NOT_FOUND) {
    throw error;
  }

  console.warn('join_live_match function not found; using non-atomic fallback. Apply the Supabase migration to fix.');
  return legacyJoinLiveMatch(matchId, slot);
}

// Pre-migration behavior: read the match, modify it, write it back. Not safe
// against concurrent joins; only kept so joining works until the migration runs.
async function legacyJoinLiveMatch(matchId: string, slot: number): Promise<JoinLiveMatchResult> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: match, error: fetchError } = await supabase
    .from('live_matches')
    .select('*')
    .eq('id', matchId)
    .single();

  if (fetchError) throw fetchError;
  if (match.status !== 'active') return { status: 'not_active' };

  const slotKey = slot.toString();
  const slotMap: { [key: string]: string | null } = match.userSlotMap || {};

  if (slotMap[slotKey] === user.id) return { status: 'already_in_slot', slot };
  if (slotMap[slotKey]) return { status: 'slot_taken' };

  const existingSlot = Object.keys(slotMap).find(key => slotMap[key] === user.id);
  if (existingSlot) return { status: 'already_joined', slot: parseInt(existingSlot, 10) };

  const { data: profileData } = await supabase
    .from('user_profiles')
    .select('nickname')
    .eq('id', user.id)
    .maybeSingle();

  const nickname = profileData?.nickname || user.email?.split('@')[0] || `Player ${slot}`;

  const userSlotMap = { ...slotMap, [slotKey]: user.id };
  const currentParticipants: string[] = match.participants || [];
  const participants = currentParticipants.includes(user.id)
    ? currentParticipants
    : [...currentParticipants, user.id];

  const playerNames = [...(match.matchSetup?.playerNames || [])];
  playerNames[slot - 1] = nickname;
  const matchSetup = { ...match.matchSetup, playerNames };

  const livePlayerStats = { ...match.livePlayerStats };
  if (livePlayerStats[slot]) {
    livePlayerStats[slot] = { ...livePlayerStats[slot], name: nickname };
  }

  const { error: updateError } = await supabase
    .from('live_matches')
    .update({ userSlotMap, participants, matchSetup, livePlayerStats })
    .eq('id', matchId);

  if (updateError) throw updateError;

  return { status: 'joined', slot, nickname, userSlotMap, participants, matchSetup, livePlayerStats };
}
