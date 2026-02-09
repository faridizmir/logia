-- DATA GENERATION SCRIPT
-- RUN THIS IN THE SUPABASE SQL EDITOR

DO $$
DECLARE
    new_user_id uuid;
    i integer;
BEGIN
    FOR i IN 1..30 LOOP
        -- 1. Create a fake user in auth.users
        --    The trigger 'on_auth_user_created' will automatically create the profile!
        new_user_id := uuid_generate_v4();
        
        INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
        VALUES (
            new_user_id,
            'user' || i || '@example.com',
            crypt('password123', gen_salt('bf')), -- Password is 'password123'
            now(),
            jsonb_build_object('full_name', 'User ' || i, 'password', 'password123')
        );

        -- 2. Create 2 Attendance records for this user
        --    Day 1: Present
        INSERT INTO public.attendance (user_id, date, check_in_time, check_out_time, status)
        VALUES (
            new_user_id, 
            CURRENT_DATE - INTERVAL '1 day', 
            (CURRENT_DATE - INTERVAL '1 day') + INTERVAL '09:00:00', 
            (CURRENT_DATE - INTERVAL '1 day') + INTERVAL '17:00:00', 
            'Present'
        );

        --    Day 2: Late
        INSERT INTO public.attendance (user_id, date, check_in_time, check_out_time, status)
        VALUES (
            new_user_id, 
            CURRENT_DATE - INTERVAL '2 days', 
            (CURRENT_DATE - INTERVAL '2 days') + INTERVAL '09:30:00', -- Late check-in
            (CURRENT_DATE - INTERVAL '2 days') + INTERVAL '17:00:00', 
            'Late'
        );

        -- 3. Create 2 Absence Requests
        --    Request 1: Pending
        INSERT INTO public.absence_requests (user_id, reason, start_date, end_date, status)
        VALUES (
            new_user_id,
            'Medical Appointment',
            CURRENT_DATE + INTERVAL '5 days',
            CURRENT_DATE + INTERVAL '5 days',
            'Pending'
        );

        --    Request 2: Approved
        INSERT INTO public.absence_requests (user_id, reason, start_date, end_date, status)
        VALUES (
            new_user_id,
            'Family Event',
            CURRENT_DATE + INTERVAL '10 days',
            CURRENT_DATE + INTERVAL '12 days',
            'Approved'
        );
        
    END LOOP;
END $$;
