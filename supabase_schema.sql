-- Enable RLS (Row Level Security)
-- Create profiles table
create table public.profiles (
  id uuid not null references auth.users on delete cascade,
  email text,
  password text, -- Note: Real passwords are encrypted in auth.users. This column is manual/insecure if used.
  full_name text,
  avatar_url text,
  role text default 'employee' check (role in ('admin', 'employee')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (id)
);

alter table public.profiles enable row level security;

-- Create attendance table
create table public.attendance (
  id uuid not null default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  check_in_time timestamp with time zone,
  check_out_time timestamp with time zone,
  date date not null default current_date,
  status text check (status in ('Present', 'Late', 'Absent', 'On Leave')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (id)
);

alter table public.attendance enable row level security;

-- Create absence_requests table
create table public.absence_requests (
  id uuid not null default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  attachment_url text,
  start_date date not null,
  end_date date not null,
  status text default 'Pending' check (status in ('Pending', 'Approved', 'Rejected')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (id)
);

alter table public.absence_requests enable row level security;

-- Create Storage Bucket for Absences
insert into storage.buckets (id, name, public) values ('absence-proofs', 'absence-proofs', true);

-- POLICIES

-- Profiles:
-- Users can view their own profile.
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

-- Admins can view all profiles.
create policy "Admins can view all profiles" on public.profiles
  for select using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Users can update their own profile.
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Attendance:
-- Employees can view their own attendance.
create policy "Employees view own attendance" on public.attendance
  for select using (auth.uid() = user_id);

-- Admins can view all attendance.
create policy "Admins view all attendance" on public.attendance
  for select using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Employees can insert punch in/out (backend/logic handles logic, but RLS allows insert).
create policy "Employees can insert attendance" on public.attendance
  for insert with check (auth.uid() = user_id);

-- Employees can update their own attendance (e.g. check out).
create policy "Employees can update attendance" on public.attendance
  for update using (auth.uid() = user_id);

-- Admins can update/delete any attendance.
create policy "Admins manage attendance" on public.attendance
  for all using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Absence Requests:
-- Employees view own requests.
create policy "Employees view own requests" on public.absence_requests
  for select using (auth.uid() = user_id);

-- Admins view all requests.
create policy "Admins view all requests" on public.absence_requests
  for select using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Employees create requests.
create policy "Employees create requests" on public.absence_requests
  for insert with check (auth.uid() = user_id);

-- Admins update requests (approve/reject).
create policy "Admins update requests" on public.absence_requests
  for update using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Storage Policies
create policy "Any authenticated user can upload absence proofs"
on storage.objects for insert to authenticated with check (
  bucket_id = 'absence-proofs'
);

create policy "Anyone can read absence proofs"
on storage.objects for select to public using (
  bucket_id = 'absence-proofs'
);


-- Function to handle new user signup (Trigger)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role, password)
  values (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'full_name', 
    'employee',
    new.raw_user_meta_data->>'password' -- Extract password from metadata
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ADMIN CREATION FUNCTION (Run this manually in SQL Editor with your secret token)
-- Usage: select promote_to_admin('user_email@example.com', 'SUPER_SECRET_TOKEN_123');

create or replace function promote_to_admin(user_email text, secret_token text)
returns text as $$
declare
  target_user_id uuid;
begin
  -- HARDCODED SECRET FOR NOW (Requirement: restricted admin creation)
  if secret_token != 'SUPER_SECRET_TOKEN_123' then
    raise exception 'Invalid Secret Token';
  end if;

  select id into target_user_id from auth.users where email = user_email;
  
  if target_user_id is null then
    return 'User not found';
  end if;

  update public.profiles set role = 'admin' where id = target_user_id;
  
  return 'User promoted to Admin successfully';
end;
$$ language plpgsql security definer;
