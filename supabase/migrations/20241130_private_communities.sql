-- ============================================
-- PRIVATE COMMUNITIES MIGRATION
-- Run this in the Supabase SQL Editor
-- ============================================

-- 1. Add new columns to communities table
ALTER TABLE public.communities 
ADD COLUMN IF NOT EXISTS creator_id uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS icon text DEFAULT 'people',
ADD COLUMN IF NOT EXISTS icon_color text DEFAULT '#FFFFFF',
ADD COLUMN IF NOT EXISTS background_color text DEFAULT '#007AFF',
ADD COLUMN IF NOT EXISTS is_private boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS invite_code text UNIQUE;

-- 2. Add role column to user_communities table
ALTER TABLE public.user_communities 
ADD COLUMN IF NOT EXISTS role text DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member'));

-- 3. Create community_invites table for tracking pending invitations
CREATE TABLE IF NOT EXISTS public.community_invites (
    id serial PRIMARY KEY,
    community_id integer REFERENCES public.communities(id) ON DELETE CASCADE,
    inviter_id uuid REFERENCES auth.users(id),
    invitee_id uuid REFERENCES auth.users(id),
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at timestamp with time zone DEFAULT now(),
    responded_at timestamp with time zone,
    UNIQUE(community_id, invitee_id)
);

-- 4. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_communities_creator_id ON public.communities(creator_id);
CREATE INDEX IF NOT EXISTS idx_communities_is_private ON public.communities(is_private);
CREATE INDEX IF NOT EXISTS idx_communities_invite_code ON public.communities(invite_code);
CREATE INDEX IF NOT EXISTS idx_community_invites_invitee ON public.community_invites(invitee_id);
CREATE INDEX IF NOT EXISTS idx_community_invites_status ON public.community_invites(status);
CREATE INDEX IF NOT EXISTS idx_user_communities_role ON public.user_communities(role);

-- 5. Enable RLS on community_invites
ALTER TABLE public.community_invites ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for community_invites

-- Users can view invites sent to them
CREATE POLICY "Users can view invites sent to them" ON public.community_invites
    FOR SELECT USING (auth.uid() = invitee_id);

-- Users can view invites they sent
CREATE POLICY "Users can view invites they sent" ON public.community_invites
    FOR SELECT USING (auth.uid() = inviter_id);

-- Community owners/admins can create invites
CREATE POLICY "Community owners and admins can create invites" ON public.community_invites
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_communities uc
            WHERE uc.community_id = community_invites.community_id
            AND uc.user_id = auth.uid()
            AND uc.role IN ('owner', 'admin')
        )
    );

-- Invitees can update their own invite status (accept/decline)
CREATE POLICY "Invitees can respond to their invites" ON public.community_invites
    FOR UPDATE USING (auth.uid() = invitee_id)
    WITH CHECK (auth.uid() = invitee_id);

-- Community owners can delete invites
CREATE POLICY "Community owners can delete invites" ON public.community_invites
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.user_communities uc
            WHERE uc.community_id = community_invites.community_id
            AND uc.user_id = auth.uid()
            AND uc.role = 'owner'
        )
    );

-- 7. Update communities RLS policies for private communities

-- Allow users to view communities they are members of (including private)
DROP POLICY IF EXISTS "Users can view their communities" ON public.communities;
CREATE POLICY "Users can view communities they belong to" ON public.communities
    FOR SELECT USING (
        -- Public communities
        is_private = false 
        OR 
        -- Private communities user is a member of
        EXISTS (
            SELECT 1 FROM public.user_communities uc
            WHERE uc.community_id = id AND uc.user_id = auth.uid()
        )
        OR
        -- Creator can always see their community
        creator_id = auth.uid()
    );

-- Allow authenticated users to create communities
CREATE POLICY "Authenticated users can create communities" ON public.communities
    FOR INSERT WITH CHECK (auth.uid() = creator_id);

-- Allow community owners to update their communities
CREATE POLICY "Community owners can update their communities" ON public.communities
    FOR UPDATE USING (creator_id = auth.uid())
    WITH CHECK (creator_id = auth.uid());

-- Allow community owners to delete their communities
CREATE POLICY "Community owners can delete their communities" ON public.communities
    FOR DELETE USING (creator_id = auth.uid());

-- 8. Update user_communities RLS policies

-- Allow users to join public communities or accept private community invites
DROP POLICY IF EXISTS "Users can join communities" ON public.user_communities;
CREATE POLICY "Users can join communities" ON public.user_communities
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
        AND (
            -- Public community
            EXISTS (
                SELECT 1 FROM public.communities c
                WHERE c.id = community_id AND c.is_private = false
            )
            OR
            -- Private community with accepted invite
            EXISTS (
                SELECT 1 FROM public.community_invites ci
                WHERE ci.community_id = community_id 
                AND ci.invitee_id = auth.uid()
                AND ci.status = 'accepted'
            )
            OR
            -- User is creating a new community (they become owner)
            role = 'owner'
        )
    );

-- Allow community owners/admins to remove members
DROP POLICY IF EXISTS "Community owners can remove members" ON public.user_communities;
CREATE POLICY "Community owners and admins can remove members" ON public.user_communities
    FOR DELETE USING (
        -- User can leave themselves
        auth.uid() = user_id
        OR
        -- Owner/admin can remove others (but not other owners)
        EXISTS (
            SELECT 1 FROM public.user_communities uc
            WHERE uc.community_id = user_communities.community_id
            AND uc.user_id = auth.uid()
            AND uc.role IN ('owner', 'admin')
        )
    );

-- 9. Function to generate unique invite codes
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS text AS $$
DECLARE
    chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    result text := '';
    i integer;
BEGIN
    FOR i IN 1..8 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 10. Function to create a private community with the creator as owner
CREATE OR REPLACE FUNCTION create_private_community(
    p_name text,
    p_description text DEFAULT NULL,
    p_icon text DEFAULT 'people',
    p_icon_color text DEFAULT '#FFFFFF',
    p_background_color text DEFAULT '#007AFF'
)
RETURNS json AS $$
DECLARE
    v_community_id integer;
    v_invite_code text;
    v_user_id uuid;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    
    -- Generate unique invite code
    LOOP
        v_invite_code := generate_invite_code();
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.communities WHERE invite_code = v_invite_code);
    END LOOP;
    
    -- Create the community
    INSERT INTO public.communities (name, description, type, creator_id, icon, icon_color, background_color, is_private, invite_code)
    VALUES (p_name, p_description, 'private', v_user_id, p_icon, p_icon_color, p_background_color, true, v_invite_code)
    RETURNING id INTO v_community_id;
    
    -- Add creator as owner
    INSERT INTO public.user_communities (user_id, community_id, role, joined_at)
    VALUES (v_user_id, v_community_id, 'owner', now());
    
    RETURN json_build_object(
        'success', true,
        'community_id', v_community_id,
        'invite_code', v_invite_code
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Function to invite a user to a private community
CREATE OR REPLACE FUNCTION invite_to_community(
    p_community_id integer,
    p_invitee_id uuid
)
RETURNS json AS $$
DECLARE
    v_user_id uuid;
    v_user_role text;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    
    -- Check if user has permission to invite
    SELECT role INTO v_user_role
    FROM public.user_communities
    WHERE community_id = p_community_id AND user_id = v_user_id;
    
    IF v_user_role IS NULL OR v_user_role NOT IN ('owner', 'admin') THEN
        RETURN json_build_object('success', false, 'error', 'Not authorized to invite');
    END IF;
    
    -- Check if invitee is already a member
    IF EXISTS (SELECT 1 FROM public.user_communities WHERE community_id = p_community_id AND user_id = p_invitee_id) THEN
        RETURN json_build_object('success', false, 'error', 'User is already a member');
    END IF;
    
    -- Create or update invite
    INSERT INTO public.community_invites (community_id, inviter_id, invitee_id, status)
    VALUES (p_community_id, v_user_id, p_invitee_id, 'pending')
    ON CONFLICT (community_id, invitee_id) 
    DO UPDATE SET status = 'pending', inviter_id = v_user_id, created_at = now(), responded_at = NULL;
    
    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Function to respond to a community invite
CREATE OR REPLACE FUNCTION respond_to_invite(
    p_community_id integer,
    p_accept boolean
)
RETURNS json AS $$
DECLARE
    v_user_id uuid;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    
    -- Check if invite exists
    IF NOT EXISTS (
        SELECT 1 FROM public.community_invites 
        WHERE community_id = p_community_id AND invitee_id = v_user_id AND status = 'pending'
    ) THEN
        RETURN json_build_object('success', false, 'error', 'No pending invite found');
    END IF;
    
    -- Update invite status
    UPDATE public.community_invites
    SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END,
        responded_at = now()
    WHERE community_id = p_community_id AND invitee_id = v_user_id;
    
    -- If accepted, add user to community
    IF p_accept THEN
        INSERT INTO public.user_communities (user_id, community_id, role, joined_at)
        VALUES (v_user_id, p_community_id, 'member', now())
        ON CONFLICT DO NOTHING;
    END IF;
    
    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. Function to kick a member from a community
CREATE OR REPLACE FUNCTION kick_community_member(
    p_community_id integer,
    p_member_id uuid
)
RETURNS json AS $$
DECLARE
    v_user_id uuid;
    v_user_role text;
    v_member_role text;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    
    -- Get the requesting user's role
    SELECT role INTO v_user_role
    FROM public.user_communities
    WHERE community_id = p_community_id AND user_id = v_user_id;
    
    IF v_user_role IS NULL OR v_user_role NOT IN ('owner', 'admin') THEN
        RETURN json_build_object('success', false, 'error', 'Not authorized to kick members');
    END IF;
    
    -- Get the target member's role
    SELECT role INTO v_member_role
    FROM public.user_communities
    WHERE community_id = p_community_id AND user_id = p_member_id;
    
    IF v_member_role IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'User is not a member');
    END IF;
    
    -- Cannot kick owners
    IF v_member_role = 'owner' THEN
        RETURN json_build_object('success', false, 'error', 'Cannot kick the community owner');
    END IF;
    
    -- Admins cannot kick other admins
    IF v_user_role = 'admin' AND v_member_role = 'admin' THEN
        RETURN json_build_object('success', false, 'error', 'Admins cannot kick other admins');
    END IF;
    
    -- Remove the member
    DELETE FROM public.user_communities
    WHERE community_id = p_community_id AND user_id = p_member_id;
    
    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 14. Function to update community details (name, icon, etc.)
CREATE OR REPLACE FUNCTION update_community(
    p_community_id integer,
    p_name text DEFAULT NULL,
    p_description text DEFAULT NULL,
    p_icon text DEFAULT NULL,
    p_icon_color text DEFAULT NULL,
    p_background_color text DEFAULT NULL
)
RETURNS json AS $$
DECLARE
    v_user_id uuid;
    v_user_role text;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    
    -- Check if user is the owner
    SELECT role INTO v_user_role
    FROM public.user_communities
    WHERE community_id = p_community_id AND user_id = v_user_id;
    
    IF v_user_role != 'owner' THEN
        RETURN json_build_object('success', false, 'error', 'Only owners can update community details');
    END IF;
    
    -- Update community
    UPDATE public.communities
    SET 
        name = COALESCE(p_name, name),
        description = COALESCE(p_description, description),
        icon = COALESCE(p_icon, icon),
        icon_color = COALESCE(p_icon_color, icon_color),
        background_color = COALESCE(p_background_color, background_color)
    WHERE id = p_community_id;
    
    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 15. Function to get pending invites for the current user
CREATE OR REPLACE FUNCTION get_pending_invites()
RETURNS TABLE (
    invite_id integer,
    community_id integer,
    community_name text,
    community_icon text,
    community_icon_color text,
    community_background_color text,
    inviter_id uuid,
    inviter_name text,
    created_at timestamp with time zone
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ci.id as invite_id,
        ci.community_id,
        c.name as community_name,
        c.icon as community_icon,
        c.icon_color as community_icon_color,
        c.background_color as community_background_color,
        ci.inviter_id,
        COALESCE(up.nickname, up.username, 'Unknown') as inviter_name,
        ci.created_at
    FROM public.community_invites ci
    JOIN public.communities c ON c.id = ci.community_id
    LEFT JOIN public.user_profiles up ON up.id = ci.inviter_id
    WHERE ci.invitee_id = auth.uid() AND ci.status = 'pending';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 16. Function to get community members with roles
CREATE OR REPLACE FUNCTION get_community_members(p_community_id integer)
RETURNS TABLE (
    user_id uuid,
    username text,
    nickname text,
    avatar_icon text,
    avatar_icon_color text,
    avatar_background_color text,
    role text,
    joined_at timestamp with time zone
) AS $$
BEGIN
    -- Verify the requesting user is a member of the community
    IF NOT EXISTS (
        SELECT 1 FROM public.user_communities 
        WHERE community_id = p_community_id AND user_id = auth.uid()
    ) THEN
        RETURN;
    END IF;
    
    RETURN QUERY
    SELECT 
        uc.user_id,
        up.username,
        COALESCE(up.nickname, up.display_name, 'Unknown') as nickname,
        COALESCE(up.avatar_icon, 'person') as avatar_icon,
        COALESCE(up.avatar_icon_color, '#FFFFFF') as avatar_icon_color,
        COALESCE(up.avatar_background_color, '#007AFF') as avatar_background_color,
        uc.role,
        uc.joined_at
    FROM public.user_communities uc
    LEFT JOIN public.user_profiles up ON up.id = uc.user_id
    WHERE uc.community_id = p_community_id
    ORDER BY 
        CASE uc.role 
            WHEN 'owner' THEN 1 
            WHEN 'admin' THEN 2 
            ELSE 3 
        END,
        uc.joined_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION create_private_community(text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION invite_to_community(integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION respond_to_invite(integer, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION kick_community_member(integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION update_community(integer, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_invites() TO authenticated;
GRANT EXECUTE ON FUNCTION get_community_members(integer) TO authenticated;

