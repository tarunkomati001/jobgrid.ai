-- Database Schema Definition for Cluco.ai
-- Public Schema Definition

CREATE TABLE IF NOT EXISTS public.users (
  id text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id text NOT NULL,
  user_id text NOT NULL UNIQUE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  phone text,
  location text,
  linkedin_url text,
  github_url text,
  portfolio_url text,
  work_authorization text,
  willing_to_relocate integer DEFAULT 0,
  years_of_experience integer DEFAULT 0,
  CONSTRAINT user_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT user_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.resumes (
  id text NOT NULL,
  user_id text NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  resume_type text,
  is_active integer DEFAULT 1,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT resumes_pkey PRIMARY KEY (id),
  CONSTRAINT resumes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.jobs (
  id text NOT NULL,
  url text NOT NULL UNIQUE,
  company text,
  title text,
  description text,
  ats text DEFAULT 'UNKNOWN'::text,
  status text DEFAULT 'PENDING'::text,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT jobs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.applications (
  id text NOT NULL,
  user_id text NOT NULL,
  job_id text NOT NULL,
  resume_id text NOT NULL,
  ats text,
  status text DEFAULT 'PENDING'::text,
  submitted_at timestamp without time zone,
  confirmation text,
  error_message text,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  screenshot_path text,
  CONSTRAINT applications_pkey PRIMARY KEY (id),
  CONSTRAINT applications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT applications_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE,
  CONSTRAINT applications_resume_id_fkey FOREIGN KEY (resume_id) REFERENCES public.resumes(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.application_answers (
  id text NOT NULL,
  application_id text NOT NULL,
  question text NOT NULL,
  answer text,
  source text,
  confidence real,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT application_answers_pkey PRIMARY KEY (id),
  CONSTRAINT application_answers_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.application_events (
  id text NOT NULL,
  application_id text NOT NULL,
  event_type text NOT NULL,
  metadata text,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT application_events_pkey PRIMARY KEY (id),
  CONSTRAINT application_events_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.user_saved_answers (
  id text NOT NULL,
  user_id text NOT NULL,
  normalized_question text NOT NULL,
  original_question text NOT NULL,
  answer text NOT NULL,
  source text,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT user_saved_answers_pkey PRIMARY KEY (id),
  CONSTRAINT user_saved_answers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT user_saved_answers_user_id_question_key UNIQUE (user_id, normalized_question)
);
