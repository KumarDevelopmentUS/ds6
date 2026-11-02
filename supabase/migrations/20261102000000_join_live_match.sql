-- Atomically claim a player slot in a live match.
--
-- Replaces the client-side read-modify-write join, where two players joining
-- at the same moment could overwrite each other's slot. The row is locked
-- (SELECT ... FOR UPDATE) for the duration of the check and update, so
-- concurrent joins are serialized.
--
-- Returns jsonb with a "status" of:
--   joined           -> slot claimed; includes the updated match fields
--   already_in_slot  -> caller already holds this slot
--   already_joined   -> caller holds a different slot ("slot")
--   slot_taken       -> another user holds this slot
--   not_active       -> match is finished
create or replace function public.join_live_match(p_match_id uuid, p_slot integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_slot text := p_slot::text;
  v_match public.live_matches%rowtype;
  v_slot_map jsonb;
  v_holder text;
  v_existing_slot text;
  v_nickname text;
  v_names jsonb;
  v_stats jsonb;
  -- Declared with the column's own type so this works for uuid[] or text[]
  v_participants public.live_matches.participants%type;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if p_slot is null or p_slot < 1 or p_slot > 4 then
    raise exception 'Invalid player slot' using errcode = '22023';
  end if;

  select * into v_match
  from public.live_matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'Match not found' using errcode = 'P0002';
  end if;

  if v_match.status is distinct from 'active' then
    return jsonb_build_object('status', 'not_active');
  end if;

  v_slot_map := coalesce(v_match."userSlotMap", '{}'::jsonb);
  v_holder := v_slot_map ->> v_slot;

  if v_holder = v_uid::text then
    return jsonb_build_object('status', 'already_in_slot', 'slot', p_slot);
  end if;

  if v_holder is not null then
    return jsonb_build_object('status', 'slot_taken');
  end if;

  select key into v_existing_slot
  from jsonb_each_text(v_slot_map)
  where value = v_uid::text
  limit 1;

  if v_existing_slot is not null then
    return jsonb_build_object('status', 'already_joined', 'slot', v_existing_slot::int);
  end if;

  -- Same fallback order the client used: nickname, email prefix, "Player N"
  select coalesce(nullif(trim(up.nickname), ''), nullif(split_part(au.email, '@', 1), ''), 'Player ' || p_slot)
  into v_nickname
  from auth.users au
  left join public.user_profiles up on up.id = au.id
  where au.id = v_uid;

  v_nickname := coalesce(v_nickname, 'Player ' || p_slot);

  v_names := coalesce(v_match."matchSetup" -> 'playerNames', '[]'::jsonb);
  while jsonb_array_length(v_names) < p_slot loop
    v_names := v_names || '""'::jsonb;
  end loop;
  v_names := jsonb_set(v_names, array[(p_slot - 1)::text], to_jsonb(v_nickname));

  v_stats := coalesce(v_match."livePlayerStats", '{}'::jsonb);
  if v_stats ? v_slot then
    v_stats := jsonb_set(v_stats, array[v_slot, 'name'], to_jsonb(v_nickname));
  end if;

  if v_uid::text = any (coalesce(v_match.participants::text[], '{}'::text[])) then
    v_participants := v_match.participants;
  else
    v_participants := coalesce(v_match.participants::text[], '{}'::text[]) || v_uid::text;
  end if;

  update public.live_matches
  set "userSlotMap" = v_slot_map || jsonb_build_object(v_slot, v_uid),
      participants = v_participants,
      "matchSetup" = jsonb_set(coalesce("matchSetup", '{}'::jsonb), '{playerNames}', v_names),
      "livePlayerStats" = v_stats
  where id = p_match_id
  returning * into v_match;

  return jsonb_build_object(
    'status', 'joined',
    'slot', p_slot,
    'nickname', v_nickname,
    'userSlotMap', v_match."userSlotMap",
    'participants', to_jsonb(v_match.participants),
    'matchSetup', v_match."matchSetup",
    'livePlayerStats', v_match."livePlayerStats"
  );
end;
$$;

revoke all on function public.join_live_match(uuid, integer) from public, anon;
grant execute on function public.join_live_match(uuid, integer) to authenticated;
