-- 20261017000000_baseline.sql
-- 正式庫 public schema 的 schema-only 快照（pg_dump 17，--schema=public --no-owner，保留權限）。
-- 傾印時間：2026-10-20，在 20261020000000_enable_rls_core_tables.sql 套用「之前」，
-- 所以下列 RLS／policy 是套用前的狀態，5 張核心表以 20261020000000 為準。
-- baseline：不套用（描述的是正式庫現況）。
-- 注意：檔案內的 \restrict / \unrestrict 是 psql meta-command（pg_dump 17.6+），
-- 若有人要在 SQL Editor 執行，必須先移除這兩行。
-- SQL 本體未修改。

--
-- PostgreSQL database dump
--

\restrict HYaHBMwWFyfW9rZhB1Qag2BtRdIxZoEPdoHXwWOhdMind6fKAa0uRvngjr49IIO

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.11 (Postgres.app)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: get_family_by_invite(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_family_by_invite(code text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  found_family families%ROWTYPE;
BEGIN
  SELECT * INTO found_family
  FROM families
  WHERE invite_code = UPPER(code)
  LIMIT 1;

  IF found_family IS NULL THEN
    RETURN NULL;
  END IF;

  -- Return only necessary fields
  RETURN json_build_object(
    'id', found_family.id,
    'name', found_family.name,
    'invite_code', found_family.invite_code,
    'created_by', found_family.created_by
  );
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: families; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.families (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    name text NOT NULL,
    invite_code text NOT NULL,
    created_by uuid
);


--
-- Name: get_family_by_invite_code(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_family_by_invite_code(code_input text) RETURNS SETOF public.families
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.families
  WHERE invite_code = code_input
  LIMIT 1;
END;
$$;


--
-- Name: get_family_members(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_family_members() RETURNS TABLE(id uuid, email text, name text, avatar_url text, family_id uuid, is_head boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  caller_family_id uuid;
  caller_id uuid;
BEGIN
  caller_id := auth.uid();
  
  -- Get caller's family_id
  SELECT p.family_id INTO caller_family_id
  FROM public.profiles p
  WHERE p.id = caller_id;

  IF caller_family_id IS NULL THEN
    RETURN; -- Return empty if no family
  END IF;

  RETURN QUERY
  SELECT 
    p.id,
    u.email::text,
    COALESCE((u.raw_user_meta_data->>'full_name')::text, (u.raw_user_meta_data->>'name')::text, u.email::text) as name,
    (u.raw_user_meta_data->>'avatar_url')::text as avatar_url,
    p.family_id,
    (f.created_by = p.id) as is_head
  FROM public.profiles p
  JOIN public.families f ON f.id = p.family_id
  JOIN auth.users u ON u.id = p.id
  WHERE p.family_id = caller_family_id;
END;
$$;


--
-- Name: kick_family_member(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.kick_family_member(target_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  caller_id uuid;
  caller_family_id uuid;
  is_head boolean;
  target_family_id uuid;
BEGIN
  caller_id := auth.uid();
  
  -- Check if caller is head of their family
  SELECT 
    p.family_id,
    (f.created_by = caller_id)
  INTO caller_family_id, is_head
  FROM public.profiles p
  JOIN public.families f ON f.id = p.family_id
  WHERE p.id = caller_id;

  IF caller_family_id IS NULL OR is_head IS NOT TRUE THEN
    RAISE EXCEPTION 'Only the family head can kick members.';
  END IF;

  -- Verify target is in the same family
  SELECT family_id INTO target_family_id
  FROM public.profiles
  WHERE id = target_user_id;

  IF target_family_id IS DISTINCT FROM caller_family_id THEN
    RAISE EXCEPTION 'Target user is not in your family.';
  END IF;

  -- Kick: Set family_id to NULL
  UPDATE public.profiles
  SET family_id = NULL
  WHERE id = target_user_id;
END;
$$;


--
-- Name: leave_family(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.leave_family() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  caller_id uuid;
BEGIN
  caller_id := auth.uid();

  UPDATE public.profiles
  SET family_id = NULL
  WHERE id = caller_id;
END;
$$;


--
-- Name: user_family_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_family_id() RETURNS uuid
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT family_id FROM public.profiles WHERE id = auth.uid();
$$;


--
-- Name: calendar_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calendar_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    title text NOT NULL,
    description text,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone NOT NULL,
    is_all_day boolean DEFAULT true,
    event_type text DEFAULT 'custom'::text,
    color text DEFAULT '#3b82f6'::text,
    family_id uuid,
    created_by uuid DEFAULT auth.uid()
);


--
-- Name: camping_gear; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.camping_gear (
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    name text NOT NULL,
    usage_count integer DEFAULT 0,
    cost integer DEFAULT 0,
    rental_price integer DEFAULT 0,
    type text DEFAULT 'other'::text,
    base_usage_count integer DEFAULT 0,
    user_id uuid,
    family_id uuid,
    image_url text,
    brand text,
    category text
);


--
-- Name: camping_gear_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.camping_gear ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.camping_gear_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: camping_trips; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.camping_trips (
    id integer NOT NULL,
    trip_date date NOT NULL,
    duration_days integer,
    companions text,
    zone text,
    road_condition integer,
    cleanliness integer,
    scenery integer,
    entertainment text,
    owner_friendliness text,
    notes text,
    is_windy boolean DEFAULT false,
    is_rainy boolean DEFAULT false,
    is_wet_tent boolean DEFAULT false,
    night_rush boolean DEFAULT false,
    tent_type text,
    has_tarp boolean DEFAULT false,
    cost integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    tent_id bigint,
    tarp_id bigint,
    start_latitude double precision,
    start_longitude double precision,
    user_id uuid,
    campsite_id bigint,
    family_id uuid,
    altitude numeric,
    price numeric DEFAULT 0,
    campsite_name text,
    location text,
    latitude double precision,
    longitude double precision,
    status text DEFAULT 'planning'::text,
    rating numeric,
    start_location text
);


--
-- Name: COLUMN camping_trips.start_latitude; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.camping_trips.start_latitude IS '行程專屬出發點緯度';


--
-- Name: COLUMN camping_trips.start_longitude; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.camping_trips.start_longitude IS '行程專屬出發點經度';


--
-- Name: COLUMN camping_trips.start_location; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.camping_trips.start_location IS 'Custom starting location address for this specific trip. Falls back to profile default if null.';


--
-- Name: camping_trips_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.camping_trips_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: camping_trips_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.camping_trips_id_seq OWNED BY public.camping_trips.id;


--
-- Name: campsites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campsites (
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    name text NOT NULL,
    city text,
    district text,
    latitude double precision,
    longitude double precision,
    altitude double precision,
    created_by uuid,
    is_verified boolean DEFAULT false,
    tags text[] DEFAULT '{}'::text[],
    phone text,
    zone_config text,
    amenities jsonb DEFAULT '{}'::jsonb,
    check_in_time text,
    check_out_time text,
    night_rush_time text,
    shower_restrictions text,
    layout_image_url text,
    playground_features text[] DEFAULT '{}'::text[],
    water_features text[] DEFAULT '{}'::text[],
    scenery_features text[] DEFAULT '{}'::text[],
    spot_types text[] DEFAULT '{}'::text[],
    booking_method text[] DEFAULT '{}'::text[],
    booking_available_until date,
    booking_timing text,
    booking_difficulty text DEFAULT 'normal'::text,
    recommended_spots text,
    campsite_notes text,
    booking_platform text,
    booking_platform_url text,
    booking_last_available_date date,
    booking_scraped_at timestamp with time zone,
    total_capacity integer,
    capacity_zones jsonb DEFAULT '[]'::jsonb
);


--
-- Name: COLUMN campsites.amenities; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campsites.amenities IS 'JSONB object storing boolean flags like has_fridge, has_water etc.';


--
-- Name: COLUMN campsites.check_in_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campsites.check_in_time IS 'General check-in time';


--
-- Name: COLUMN campsites.check_out_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campsites.check_out_time IS 'General check-out time';


--
-- Name: COLUMN campsites.night_rush_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campsites.night_rush_time IS 'Night rush entry time window';


--
-- Name: COLUMN campsites.shower_restrictions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campsites.shower_restrictions IS 'Shower availability or restrictions';


--
-- Name: COLUMN campsites.playground_features; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campsites.playground_features IS '遊樂設施標籤，如沙坑、溜滑梯';


--
-- Name: COLUMN campsites.water_features; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campsites.water_features IS '水域設施標籤，如戲水池、溪流';


--
-- Name: COLUMN campsites.scenery_features; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campsites.scenery_features IS '自然景觀標籤，如櫻花、螢火蟲';


--
-- Name: COLUMN campsites.spot_types; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campsites.spot_types IS '營位類型，如草地、棧板';


--
-- Name: COLUMN campsites.booking_method; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campsites.booking_method IS '訂位方式，如電話、FB';


--
-- Name: COLUMN campsites.booking_difficulty; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campsites.booking_difficulty IS '搶位難度：normal / moderate / hard';


--
-- Name: COLUMN campsites.booking_platform; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campsites.booking_platform IS '訂位平台：icamping / campingfun';


--
-- Name: COLUMN campsites.booking_last_available_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campsites.booking_last_available_date IS '上次爬取時平台最遠可訂日期（供偵測新訂位開放用）';


--
-- Name: campsites_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.campsites ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.campsites_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: cpbl_schedule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cpbl_schedule (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    game_sno integer NOT NULL,
    game_date date NOT NULL,
    home_team_name text NOT NULL,
    visiting_team_name text NOT NULL,
    field_abbe text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    updated_at timestamp with time zone,
    location_name text,
    latitude double precision,
    longitude double precision,
    is_admin boolean DEFAULT false,
    family_id uuid,
    onboarding_completed_at timestamp with time zone,
    campsite_quick_chips text[]
);


--
-- Name: COLUMN profiles.onboarding_completed_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.onboarding_completed_at IS '完成 onboarding 的時間戳記';


--
-- Name: system_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_assets (
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    type text NOT NULL,
    url text NOT NULL,
    name text,
    width integer,
    height integer,
    public_id text,
    brand text
);


--
-- Name: system_assets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.system_assets ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.system_assets_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: trip_photos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trip_photos (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    trip_id bigint NOT NULL,
    url text NOT NULL,
    public_id text,
    caption text,
    width integer,
    height integer,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: trip_photos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.trip_photos ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.trip_photos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: camping_trips id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camping_trips ALTER COLUMN id SET DEFAULT nextval('public.camping_trips_id_seq'::regclass);


--
-- Name: calendar_events calendar_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT calendar_events_pkey PRIMARY KEY (id);


--
-- Name: camping_gear camping_gear_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camping_gear
    ADD CONSTRAINT camping_gear_pkey PRIMARY KEY (id);


--
-- Name: camping_trips camping_trips_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camping_trips
    ADD CONSTRAINT camping_trips_pkey PRIMARY KEY (id);


--
-- Name: campsites campsites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campsites
    ADD CONSTRAINT campsites_pkey PRIMARY KEY (id);


--
-- Name: cpbl_schedule cpbl_schedule_game_sno_game_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cpbl_schedule
    ADD CONSTRAINT cpbl_schedule_game_sno_game_date_key UNIQUE (game_sno, game_date);


--
-- Name: cpbl_schedule cpbl_schedule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cpbl_schedule
    ADD CONSTRAINT cpbl_schedule_pkey PRIMARY KEY (id);


--
-- Name: families families_invite_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.families
    ADD CONSTRAINT families_invite_code_key UNIQUE (invite_code);


--
-- Name: families families_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.families
    ADD CONSTRAINT families_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: system_assets system_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_assets
    ADD CONSTRAINT system_assets_pkey PRIMARY KEY (id);


--
-- Name: trip_photos trip_photos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_photos
    ADD CONSTRAINT trip_photos_pkey PRIMARY KEY (id);


--
-- Name: calendar_events calendar_events_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT calendar_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: calendar_events calendar_events_family_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT calendar_events_family_id_fkey FOREIGN KEY (family_id) REFERENCES public.families(id) ON DELETE CASCADE;


--
-- Name: camping_gear camping_gear_family_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camping_gear
    ADD CONSTRAINT camping_gear_family_id_fkey FOREIGN KEY (family_id) REFERENCES public.families(id);


--
-- Name: camping_gear camping_gear_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camping_gear
    ADD CONSTRAINT camping_gear_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: camping_trips camping_trips_campsite_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camping_trips
    ADD CONSTRAINT camping_trips_campsite_id_fkey FOREIGN KEY (campsite_id) REFERENCES public.campsites(id);


--
-- Name: camping_trips camping_trips_family_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camping_trips
    ADD CONSTRAINT camping_trips_family_id_fkey FOREIGN KEY (family_id) REFERENCES public.families(id);


--
-- Name: camping_trips camping_trips_tarp_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camping_trips
    ADD CONSTRAINT camping_trips_tarp_id_fkey FOREIGN KEY (tarp_id) REFERENCES public.camping_gear(id) ON DELETE SET NULL;


--
-- Name: camping_trips camping_trips_tent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camping_trips
    ADD CONSTRAINT camping_trips_tent_id_fkey FOREIGN KEY (tent_id) REFERENCES public.camping_gear(id) ON DELETE SET NULL;


--
-- Name: camping_trips camping_trips_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.camping_trips
    ADD CONSTRAINT camping_trips_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: campsites campsites_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campsites
    ADD CONSTRAINT campsites_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: families families_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.families
    ADD CONSTRAINT families_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: profiles profiles_family_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_family_id_fkey FOREIGN KEY (family_id) REFERENCES public.families(id);


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id);


--
-- Name: trip_photos trip_photos_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_photos
    ADD CONSTRAINT trip_photos_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.camping_trips(id) ON DELETE CASCADE;


--
-- Name: trip_photos trip_photos_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_photos
    ADD CONSTRAINT trip_photos_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: system_assets Admins can insert/update/delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert/update/delete" ON public.system_assets USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))));


--
-- Name: campsites Allow authenticated users to update campsites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to update campsites" ON public.campsites FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: campsites Authenticated users can insert campsites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert campsites" ON public.campsites FOR INSERT WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: camping_gear Enable all access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable all access for all users" ON public.camping_gear USING (true) WITH CHECK (true);


--
-- Name: trip_photos Enable all access for now; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable all access for now" ON public.trip_photos FOR SELECT USING (true);


--
-- Name: camping_trips Enable delete access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete access for all users" ON public.camping_trips FOR DELETE USING (true);


--
-- Name: trip_photos Enable delete for owners; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable delete for owners" ON public.trip_photos FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: camping_trips Enable insert access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert access for all users" ON public.camping_trips FOR INSERT WITH CHECK (true);


--
-- Name: trip_photos Enable insert for owners; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for owners" ON public.trip_photos FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: camping_trips Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.camping_trips FOR SELECT USING (true);


--
-- Name: cpbl_schedule Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.cpbl_schedule FOR SELECT USING (true);


--
-- Name: camping_trips Enable update access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable update access for all users" ON public.camping_trips FOR UPDATE USING (true);


--
-- Name: cpbl_schedule Enable write access for authenticated users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable write access for authenticated users" ON public.cpbl_schedule USING ((auth.role() = 'authenticated'::text));


--
-- Name: camping_trips Public Access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public Access" ON public.camping_trips USING (true);


--
-- Name: campsites Public can view campsites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view campsites" ON public.campsites FOR SELECT USING (true);


--
-- Name: system_assets Public read access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read access" ON public.system_assets FOR SELECT USING (true);


--
-- Name: camping_trips Update family trips; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Update family trips" ON public.camping_trips FOR UPDATE USING (((family_id IS NOT NULL) AND (family_id = public.user_family_id())));


--
-- Name: families Users can create family; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create family" ON public.families FOR INSERT WITH CHECK ((auth.uid() = created_by));


--
-- Name: camping_gear Users can delete own gear; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own gear" ON public.camping_gear FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: camping_trips Users can delete own trips; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own trips" ON public.camping_trips FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: calendar_events Users can delete their own events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own events" ON public.calendar_events FOR DELETE USING ((created_by = auth.uid()));


--
-- Name: trip_photos Users can delete their own photos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own photos" ON public.trip_photos FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: calendar_events Users can insert events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert events" ON public.calendar_events FOR INSERT WITH CHECK (((created_by = auth.uid()) AND ((family_id IS NULL) OR (family_id IN ( SELECT profiles.family_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))))));


--
-- Name: camping_gear Users can insert own gear; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own gear" ON public.camping_gear FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: camping_trips Users can insert own trips; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own trips" ON public.camping_trips FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: trip_photos Users can insert their own photos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own photos" ON public.trip_photos FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: camping_gear Users can update own gear; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own gear" ON public.camping_gear FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: camping_trips Users can update own trips; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own trips" ON public.camping_trips FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: calendar_events Users can update their own events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own events" ON public.calendar_events FOR UPDATE USING ((created_by = auth.uid()));


--
-- Name: calendar_events Users can view family events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view family events" ON public.calendar_events FOR SELECT USING ((family_id IN ( SELECT profiles.family_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: camping_gear Users can view own gear; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own gear" ON public.camping_gear FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: camping_trips Users can view own trips; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own trips" ON public.camping_trips FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: trip_photos Users can view photos of their families or own photos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view photos of their families or own photos" ON public.trip_photos FOR SELECT USING (true);


--
-- Name: calendar_events Users can view their own events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own events" ON public.calendar_events FOR SELECT USING ((created_by = auth.uid()));


--
-- Name: families Users can view their own family; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own family" ON public.families FOR SELECT USING (((id = public.user_family_id()) OR (created_by = auth.uid())));


--
-- Name: camping_gear View family gear; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "View family gear" ON public.camping_gear FOR SELECT USING (((family_id IS NOT NULL) AND (family_id = public.user_family_id())));


--
-- Name: camping_trips View family trips; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "View family trips" ON public.camping_trips FOR SELECT USING (((family_id IS NOT NULL) AND (family_id = public.user_family_id())));


--
-- Name: calendar_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

--
-- Name: cpbl_schedule; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cpbl_schedule ENABLE ROW LEVEL SECURITY;

--
-- Name: system_assets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.system_assets ENABLE ROW LEVEL SECURITY;

--
-- Name: trip_photos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trip_photos ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION get_family_by_invite(code text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_family_by_invite(code text) TO anon;
GRANT ALL ON FUNCTION public.get_family_by_invite(code text) TO authenticated;
GRANT ALL ON FUNCTION public.get_family_by_invite(code text) TO service_role;


--
-- Name: TABLE families; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.families TO anon;
GRANT ALL ON TABLE public.families TO authenticated;
GRANT ALL ON TABLE public.families TO service_role;


--
-- Name: FUNCTION get_family_by_invite_code(code_input text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_family_by_invite_code(code_input text) TO anon;
GRANT ALL ON FUNCTION public.get_family_by_invite_code(code_input text) TO authenticated;
GRANT ALL ON FUNCTION public.get_family_by_invite_code(code_input text) TO service_role;


--
-- Name: FUNCTION get_family_members(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_family_members() TO anon;
GRANT ALL ON FUNCTION public.get_family_members() TO authenticated;
GRANT ALL ON FUNCTION public.get_family_members() TO service_role;


--
-- Name: FUNCTION kick_family_member(target_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.kick_family_member(target_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.kick_family_member(target_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.kick_family_member(target_user_id uuid) TO service_role;


--
-- Name: FUNCTION leave_family(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.leave_family() TO anon;
GRANT ALL ON FUNCTION public.leave_family() TO authenticated;
GRANT ALL ON FUNCTION public.leave_family() TO service_role;


--
-- Name: FUNCTION user_family_id(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.user_family_id() TO anon;
GRANT ALL ON FUNCTION public.user_family_id() TO authenticated;
GRANT ALL ON FUNCTION public.user_family_id() TO service_role;


--
-- Name: TABLE calendar_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.calendar_events TO anon;
GRANT ALL ON TABLE public.calendar_events TO authenticated;
GRANT ALL ON TABLE public.calendar_events TO service_role;


--
-- Name: TABLE camping_gear; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.camping_gear TO anon;
GRANT ALL ON TABLE public.camping_gear TO authenticated;
GRANT ALL ON TABLE public.camping_gear TO service_role;


--
-- Name: SEQUENCE camping_gear_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.camping_gear_id_seq TO anon;
GRANT ALL ON SEQUENCE public.camping_gear_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.camping_gear_id_seq TO service_role;


--
-- Name: TABLE camping_trips; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.camping_trips TO anon;
GRANT ALL ON TABLE public.camping_trips TO authenticated;
GRANT ALL ON TABLE public.camping_trips TO service_role;


--
-- Name: SEQUENCE camping_trips_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.camping_trips_id_seq TO anon;
GRANT ALL ON SEQUENCE public.camping_trips_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.camping_trips_id_seq TO service_role;


--
-- Name: TABLE campsites; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.campsites TO anon;
GRANT ALL ON TABLE public.campsites TO authenticated;
GRANT ALL ON TABLE public.campsites TO service_role;


--
-- Name: SEQUENCE campsites_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.campsites_id_seq TO anon;
GRANT ALL ON SEQUENCE public.campsites_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.campsites_id_seq TO service_role;


--
-- Name: TABLE cpbl_schedule; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.cpbl_schedule TO anon;
GRANT ALL ON TABLE public.cpbl_schedule TO authenticated;
GRANT ALL ON TABLE public.cpbl_schedule TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: TABLE system_assets; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.system_assets TO anon;
GRANT ALL ON TABLE public.system_assets TO authenticated;
GRANT ALL ON TABLE public.system_assets TO service_role;


--
-- Name: SEQUENCE system_assets_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.system_assets_id_seq TO anon;
GRANT ALL ON SEQUENCE public.system_assets_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.system_assets_id_seq TO service_role;


--
-- Name: TABLE trip_photos; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.trip_photos TO anon;
GRANT ALL ON TABLE public.trip_photos TO authenticated;
GRANT ALL ON TABLE public.trip_photos TO service_role;


--
-- Name: SEQUENCE trip_photos_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.trip_photos_id_seq TO anon;
GRANT ALL ON SEQUENCE public.trip_photos_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.trip_photos_id_seq TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict HYaHBMwWFyfW9rZhB1Qag2BtRdIxZoEPdoHXwWOhdMind6fKAa0uRvngjr49IIO

