--
-- PostgreSQL database dump
--

-- Dumped from database version 13.0 (Debian 13.0-1.pgdg100+1)
-- Dumped by pg_dump version 13.0 (Debian 13.0-1.pgdg100+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _sc_config; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._sc_config (
    key text NOT NULL,
    value jsonb NOT NULL
);


ALTER TABLE public._sc_config OWNER TO postgres;

--
-- Name: _sc_errors; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._sc_errors (
    id integer NOT NULL,
    stack text NOT NULL,
    message text NOT NULL,
    occur_at timestamp without time zone NOT NULL,
    tenant text NOT NULL,
    user_id integer,
    url text NOT NULL,
    headers jsonb NOT NULL,
    body jsonb
);


ALTER TABLE public._sc_errors OWNER TO postgres;

--
-- Name: _sc_errors_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public._sc_errors_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public._sc_errors_id_seq OWNER TO postgres;

--
-- Name: _sc_errors_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public._sc_errors_id_seq OWNED BY public._sc_errors.id;


--
-- Name: _sc_fields; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._sc_fields (
    id integer NOT NULL,
    table_id integer NOT NULL,
    name text NOT NULL,
    label text,
    type text,
    reftable_name text,
    attributes jsonb,
    required boolean DEFAULT false NOT NULL,
    is_unique boolean DEFAULT false NOT NULL,
    calculated boolean DEFAULT false NOT NULL,
    stored boolean DEFAULT false NOT NULL,
    expression text
);


ALTER TABLE public._sc_fields OWNER TO postgres;

--
-- Name: _sc_fields_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public._sc_fields_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public._sc_fields_id_seq OWNER TO postgres;

--
-- Name: _sc_fields_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public._sc_fields_id_seq OWNED BY public._sc_fields.id;


--
-- Name: _sc_files; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._sc_files (
    id integer NOT NULL,
    filename text NOT NULL,
    location text NOT NULL,
    uploaded_at timestamp without time zone NOT NULL,
    size_kb integer NOT NULL,
    user_id integer,
    mime_super text NOT NULL,
    mime_sub text NOT NULL,
    min_role_read integer NOT NULL
);


ALTER TABLE public._sc_files OWNER TO postgres;

--
-- Name: _sc_files_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public._sc_files_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public._sc_files_id_seq OWNER TO postgres;

--
-- Name: _sc_files_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public._sc_files_id_seq OWNED BY public._sc_files.id;


--
-- Name: _sc_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._sc_migrations (
    migration text NOT NULL
);


ALTER TABLE public._sc_migrations OWNER TO postgres;

--
-- Name: _sc_pages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._sc_pages (
    id integer NOT NULL,
    name text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    min_role integer NOT NULL,
    layout jsonb NOT NULL,
    fixed_states jsonb NOT NULL
);


ALTER TABLE public._sc_pages OWNER TO postgres;

--
-- Name: _sc_pages_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public._sc_pages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public._sc_pages_id_seq OWNER TO postgres;

--
-- Name: _sc_pages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public._sc_pages_id_seq OWNED BY public._sc_pages.id;


--
-- Name: _sc_plugins; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._sc_plugins (
    id integer NOT NULL,
    name character varying(128),
    source character varying(128),
    location character varying(128),
    version text DEFAULT 'latest'::text,
    configuration jsonb
);


ALTER TABLE public._sc_plugins OWNER TO postgres;

--
-- Name: _sc_plugins_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public._sc_plugins_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public._sc_plugins_id_seq OWNER TO postgres;

--
-- Name: _sc_plugins_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public._sc_plugins_id_seq OWNED BY public._sc_plugins.id;


--
-- Name: _sc_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._sc_roles (
    id integer NOT NULL,
    role character varying(50)
);


ALTER TABLE public._sc_roles OWNER TO postgres;

--
-- Name: _sc_roles_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public._sc_roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public._sc_roles_id_seq OWNER TO postgres;

--
-- Name: _sc_roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public._sc_roles_id_seq OWNED BY public._sc_roles.id;


--
-- Name: _sc_session; Type: TABLE; Schema: public; Owner: postgres
--

CREATE UNLOGGED TABLE public._sc_session (
    sid character varying NOT NULL,
    sess json NOT NULL,
    expire timestamp(6) without time zone NOT NULL
);


ALTER TABLE public._sc_session OWNER TO postgres;

--
-- Name: _sc_tables; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._sc_tables (
    id integer NOT NULL,
    name text NOT NULL,
    min_role_read integer DEFAULT 1 NOT NULL,
    min_role_write integer DEFAULT 1 NOT NULL,
    versioned boolean DEFAULT false NOT NULL
);


ALTER TABLE public._sc_tables OWNER TO postgres;

--
-- Name: _sc_tables_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public._sc_tables_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public._sc_tables_id_seq OWNER TO postgres;

--
-- Name: _sc_tables_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public._sc_tables_id_seq OWNED BY public._sc_tables.id;


--
-- Name: _sc_tenants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._sc_tenants (
    subdomain text NOT NULL,
    email text NOT NULL
);


ALTER TABLE public._sc_tenants OWNER TO postgres;

--
-- Name: _sc_views; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._sc_views (
    id integer NOT NULL,
    viewtemplate text NOT NULL,
    name text NOT NULL,
    table_id integer,
    configuration jsonb NOT NULL,
    on_root_page boolean DEFAULT false NOT NULL,
    min_role integer DEFAULT 10 NOT NULL
);


ALTER TABLE public._sc_views OWNER TO postgres;

--
-- Name: _sc_views_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public._sc_views_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public._sc_views_id_seq OWNER TO postgres;

--
-- Name: _sc_views_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public._sc_views_id_seq OWNED BY public._sc_views.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email character varying(128),
    password character varying(60),
    role_id integer NOT NULL,
    reset_password_token text,
    reset_password_expiry timestamp without time zone,
    language text,
    disabled boolean DEFAULT false NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: _sc_errors id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._sc_errors ALTER COLUMN id SET DEFAULT nextval('public._sc_errors_id_seq'::regclass);


--
-- Name: _sc_fields id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._sc_fields ALTER COLUMN id SET DEFAULT nextval('public._sc_fields_id_seq'::regclass);


--
-- Name: _sc_files id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._sc_files ALTER COLUMN id SET DEFAULT nextval('public._sc_files_id_seq'::regclass);


--
-- Name: _sc_pages id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._sc_pages ALTER COLUMN id SET DEFAULT nextval('public._sc_pages_id_seq'::regclass);


--
-- Name: _sc_plugins id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._sc_plugins ALTER COLUMN id SET DEFAULT nextval('public._sc_plugins_id_seq'::regclass);


--
-- Name: _sc_roles id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._sc_roles ALTER COLUMN id SET DEFAULT nextval('public._sc_roles_id_seq'::regclass);


--
-- Name: _sc_tables id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._sc_tables ALTER COLUMN id SET DEFAULT nextval('public._sc_tables_id_seq'::regclass);


--
-- Name: _sc_views id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._sc_views ALTER COLUMN id SET DEFAULT nextval('public._sc_views_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: _sc_config; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._sc_config (key, value) FROM stdin;
\.


--
-- Data for Name: _sc_errors; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._sc_errors (id, stack, message, occur_at, tenant, user_id, url, headers, body) FROM stdin;
\.


--
-- Data for Name: _sc_fields; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._sc_fields (id, table_id, name, label, type, reftable_name, attributes, required, is_unique, calculated, stored, expression) FROM stdin;
\.


--
-- Data for Name: _sc_files; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._sc_files (id, filename, location, uploaded_at, size_kb, user_id, mime_super, mime_sub, min_role_read) FROM stdin;
\.


--
-- Data for Name: _sc_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._sc_migrations (migration) FROM stdin;
202005141503
202005241712
202005251037
202005282134
202006022156
202006051507
202006240906
202007091707
202007202144
202008031500
202008051415
202008121149
202009112140
202009181655
202009221105
202009231331
202009301531
202010231444
\.


--
-- Data for Name: _sc_pages; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._sc_pages (id, name, title, description, min_role, layout, fixed_states) FROM stdin;
\.


--
-- Data for Name: _sc_plugins; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._sc_plugins (id, name, source, location, version, configuration) FROM stdin;
1	base	npm	@saltcorn/base-plugin	latest	\N
2	sbadmin2	npm	@saltcorn/sbadmin2	latest	\N
\.


--
-- Data for Name: _sc_roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._sc_roles (id, role) FROM stdin;
1	admin
10	public
8	user
4	staff
\.


--
-- Data for Name: _sc_session; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._sc_session (sid, sess, expire) FROM stdin;
\.


--
-- Data for Name: _sc_tables; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._sc_tables (id, name, min_role_read, min_role_write, versioned) FROM stdin;
\.


--
-- Data for Name: _sc_tenants; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._sc_tenants (subdomain, email) FROM stdin;
\.


--
-- Data for Name: _sc_views; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._sc_views (id, viewtemplate, name, table_id, configuration, on_root_page, min_role) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, email, password, role_id, reset_password_token, reset_password_expiry, language, disabled) FROM stdin;
\.


--
-- Name: _sc_errors_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public._sc_errors_id_seq', 1, false);


--
-- Name: _sc_fields_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public._sc_fields_id_seq', 1, false);


--
-- Name: _sc_files_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public._sc_files_id_seq', 1, false);


--
-- Name: _sc_pages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public._sc_pages_id_seq', 1, false);


--
-- Name: _sc_plugins_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public._sc_plugins_id_seq', 2, true);


--
-- Name: _sc_roles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public._sc_roles_id_seq', 1, false);


--
-- Name: _sc_tables_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public._sc_tables_id_seq', 1, false);


--
-- Name: _sc_views_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public._sc_views_id_seq', 1, false);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 1, false);


--
-- Name: _sc_config _sc_config_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._sc_config
    ADD CONSTRAINT _sc_config_pkey PRIMARY KEY (key);


--
-- Name: _sc_errors _sc_errors_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._sc_errors
    ADD CONSTRAINT _sc_errors_pkey PRIMARY KEY (id);


--
-- Name: _sc_fields _sc_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._sc_fields
    ADD CONSTRAINT _sc_fields_pkey PRIMARY KEY (id);


--
-- Name: _sc_files _sc_files_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._sc_files
    ADD CONSTRAINT _sc_files_pkey PRIMARY KEY (id);


--
-- Name: _sc_migrations _sc_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._sc_migrations
    ADD CONSTRAINT _sc_migrations_pkey PRIMARY KEY (migration);


--
-- Name: _sc_pages _sc_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._sc_pages
    ADD CONSTRAINT _sc_pages_pkey PRIMARY KEY (id);


--
-- Name: _sc_plugins _sc_plugins_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._sc_plugins
    ADD CONSTRAINT _sc_plugins_pkey PRIMARY KEY (id);


--
-- Name: _sc_roles _sc_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._sc_roles
    ADD CONSTRAINT _sc_roles_pkey PRIMARY KEY (id);


--
-- Name: _sc_session _sc_session_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._sc_session
    ADD CONSTRAINT _sc_session_pkey PRIMARY KEY (sid);


--
-- Name: _sc_tables _sc_tables_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._sc_tables
    ADD CONSTRAINT _sc_tables_name_key UNIQUE (name);


--
-- Name: _sc_tables _sc_tables_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._sc_tables
    ADD CONSTRAINT _sc_tables_pkey PRIMARY KEY (id);


--
-- Name: _sc_tenants _sc_tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._sc_tenants
    ADD CONSTRAINT _sc_tenants_pkey PRIMARY KEY (subdomain);


--
-- Name: _sc_views _sc_views_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._sc_views
    ADD CONSTRAINT _sc_views_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_unique_email; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_unique_email UNIQUE (email);


--
-- Name: _sc_IDX_session_expire; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "_sc_IDX_session_expire" ON public._sc_session USING btree (expire);


--
-- Name: _sc_idx_field_table; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX _sc_idx_field_table ON public._sc_fields USING btree (table_id);


--
-- Name: _sc_idx_table_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX _sc_idx_table_name ON public._sc_tables USING btree (name);


--
-- Name: _sc_idx_view_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX _sc_idx_view_name ON public._sc_views USING btree (name);


--
-- Name: _sc_fields _sc_fields_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._sc_fields
    ADD CONSTRAINT _sc_fields_table_id_fkey FOREIGN KEY (table_id) REFERENCES public._sc_tables(id);


--
-- Name: _sc_files _sc_files_min_role_read_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._sc_files
    ADD CONSTRAINT _sc_files_min_role_read_fkey FOREIGN KEY (min_role_read) REFERENCES public._sc_roles(id);


--
-- Name: _sc_files _sc_files_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._sc_files
    ADD CONSTRAINT _sc_files_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: _sc_pages _sc_pages_min_role_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._sc_pages
    ADD CONSTRAINT _sc_pages_min_role_fkey FOREIGN KEY (min_role) REFERENCES public._sc_roles(id);


--
-- Name: _sc_tables _sc_tables_min_role_read_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._sc_tables
    ADD CONSTRAINT _sc_tables_min_role_read_fkey FOREIGN KEY (min_role_read) REFERENCES public._sc_roles(id);


--
-- Name: _sc_tables _sc_tables_min_role_write_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._sc_tables
    ADD CONSTRAINT _sc_tables_min_role_write_fkey FOREIGN KEY (min_role_write) REFERENCES public._sc_roles(id);


--
-- Name: _sc_views _sc_views_min_role_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._sc_views
    ADD CONSTRAINT _sc_views_min_role_fkey FOREIGN KEY (min_role) REFERENCES public._sc_roles(id);


--
-- Name: _sc_views _sc_views_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._sc_views
    ADD CONSTRAINT _sc_views_table_id_fkey FOREIGN KEY (table_id) REFERENCES public._sc_tables(id);


--
-- Name: users users_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_role_id_fkey FOREIGN KEY (role_id) REFERENCES public._sc_roles(id);


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: postgres
--

GRANT ALL ON SCHEMA public TO PUBLIC;


--
-- PostgreSQL database dump complete
--

