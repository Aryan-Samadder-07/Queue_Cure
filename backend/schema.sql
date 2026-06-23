-- ======================================================
-- Queue Cure Multi-Doctor Database Schema & Configuration
-- Run this in your Supabase SQL Editor
-- ======================================================

-- Drop old functions and tables to avoid conflicts
DROP FUNCTION IF EXISTS call_next_patient();
DROP FUNCTION IF EXISTS end_session(text);
DROP TABLE IF EXISTS queue CASCADE;
DROP TABLE IF EXISTS settings CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS doctors CASCADE;

-- 1. Create doctors table
CREATE TABLE IF NOT EXISTS doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  department TEXT NOT NULL,
  chamber_number TEXT NOT NULL,
  phone_number TEXT UNIQUE NOT NULL,
  current_serving_token TEXT DEFAULT '--',
  accepting_patients BOOLEAN DEFAULT TRUE,
  initial_avg_consultation_time INTEGER DEFAULT 15,
  reset_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create queue table
CREATE TABLE IF NOT EXISTS queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_name TEXT NOT NULL,
  doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
  token_string TEXT NOT NULL,
  slot_number INTEGER NOT NULL,
  prescription_number TEXT,
  status TEXT CHECK (status IN ('waiting', 'in-consultation', 'completed')) DEFAULT 'waiting',
  called_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create sessions history table
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  session_name TEXT NOT NULL,
  patient_list JSONB NOT NULL,
  report_text TEXT NOT NULL
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS Policies to allow public/anonymous operations
CREATE POLICY "Allow public operations on doctors" ON doctors FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public operations on queue" ON queue FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public operations on sessions" ON sessions FOR ALL USING (true) WITH CHECK (true);

-- 6. Enable Realtime Replication
-- Note: If you get an error here, you can ignore it as long as the tables are added to realtime
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR ALL TABLES;
COMMIT;

-- 7. Database Function (RPC) to add patient atomically and generate custom token
CREATE OR REPLACE FUNCTION add_patient_to_queue(p_name TEXT, doc_id UUID, p_prescription TEXT DEFAULT NULL) RETURNS TEXT AS $$
DECLARE
    doc_name TEXT;
    doc_chamber TEXT;
    initials TEXT;
    next_slot INTEGER;
    generated_token TEXT;
BEGIN
    -- Check if doc_id is null
    IF doc_id IS NULL THEN
        RAISE EXCEPTION 'Doctor ID cannot be null';
    END IF;

    -- Get doctor details
    SELECT full_name, chamber_number INTO doc_name, doc_chamber FROM doctors WHERE id = doc_id;
    
    -- Check if doctor exists
    IF doc_name IS NULL THEN
        RAISE EXCEPTION 'Doctor with ID % not found', doc_id;
    END IF;

    -- Extract initials (first letters of first two words, or first two letters if single word)
    IF POSITION(' ' IN doc_name) > 0 THEN
        initials := UPPER(SUBSTRING(doc_name FROM 1 FOR 1) || SUBSTRING(doc_name FROM POSITION(' ' IN doc_name) + 1 FOR 1));
    ELSE
        initials := UPPER(SUBSTRING(doc_name FROM 1 FOR 2));
    END IF;
    
    -- Get next slot number for this doctor (resets to 1 when queue is cleared on end session)
    SELECT COALESCE(MAX(slot_number), 0) + 1 INTO next_slot
    FROM queue
    WHERE doctor_id = doc_id;
    
    -- Format token: <initials>-<chamber>-<slot>
    generated_token := initials || '-' || doc_chamber || '-' || next_slot;
    
    -- Insert patient into queue
    INSERT INTO queue (patient_name, doctor_id, token_string, slot_number, status, prescription_number)
    VALUES (p_name, doc_id, generated_token, next_slot, 'waiting', p_prescription);
    
    RETURN generated_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Database Function (RPC) to call next patient atomically for a specific doctor
CREATE OR REPLACE FUNCTION call_next_patient_for_doctor(doc_id UUID) RETURNS void AS $$
DECLARE
    next_patient_id UUID;
    next_token TEXT;
BEGIN
    -- Find the next waiting patient for this doctor, locking the row for transaction safety
    SELECT id, token_string INTO next_patient_id, next_token
    FROM queue 
    WHERE doctor_id = doc_id AND status = 'waiting' 
    ORDER BY slot_number ASC 
    LIMIT 1 
    FOR UPDATE;
    
    IF next_patient_id IS NOT NULL THEN
        -- Mark previous in-consultation as completed
        UPDATE queue SET status = 'completed' WHERE doctor_id = doc_id AND status = 'in-consultation';
        
        -- Mark next as in-consultation and record called_at
        UPDATE queue SET status = 'in-consultation', called_at = NOW() WHERE id = next_patient_id;
        
        -- Update doctor's current serving token
        UPDATE doctors SET current_serving_token = next_token WHERE id = doc_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Database Function (RPC) to end session atomically for a specific doctor
CREATE OR REPLACE FUNCTION end_session_for_doctor(doc_id UUID, s_name TEXT) RETURNS void AS $$
DECLARE
    p_list JSONB;
    r_text TEXT;
    r_unattended TEXT;
    p_count INTEGER;
    unattended_count INTEGER;
    start_time_str TEXT;
    -- Doctor details variables
    d_name TEXT;
    d_dept TEXT;
    d_chamber TEXT;
    d_phone TEXT;
BEGIN
    -- Get doctor details
    SELECT full_name, department, chamber_number, phone_number 
    INTO d_name, d_dept, d_chamber, d_phone 
    FROM doctors 
    WHERE id = doc_id;

    -- Count total patients in queue for this doctor
    SELECT COUNT(*) INTO p_count FROM queue WHERE doctor_id = doc_id;
    
    -- Count unattended patients (still waiting)
    SELECT COUNT(*) INTO unattended_count FROM queue WHERE doctor_id = doc_id AND status = 'waiting';

    -- Get the start time of the session (earliest called_at) and end time (now)
    SELECT COALESCE(TO_CHAR(MIN(called_at), 'HH24:MI:SS'), '--:--:--') INTO start_time_str 
    FROM queue 
    WHERE doctor_id = doc_id AND called_at IS NOT NULL;
    
    -- Generate JSON list of patients in order
    SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO p_list
    FROM (
        SELECT slot_number, patient_name, status, called_at, token_string, prescription_number
        FROM queue
        WHERE doctor_id = doc_id
        ORDER BY slot_number ASC
    ) t;

    -- Generate plain text version of the report (only attended patients: status is not 'waiting')
    SELECT COALESCE(
        string_agg(slot_number || '. ' || patient_name || ' [' || token_string || '] Presc: ' || COALESCE(prescription_number, 'N/A'), E'\n'), 
        'No patients attended this session.'
    ) INTO r_text
    FROM (
        SELECT slot_number, patient_name, token_string, prescription_number
        FROM queue
        WHERE doctor_id = doc_id AND status != 'waiting'
        ORDER BY slot_number ASC
    ) t;

    -- Generate plain text version of unattended patients list
    SELECT COALESCE(
        string_agg(slot_number || '. ' || patient_name || ' [' || token_string || '] Presc: ' || COALESCE(prescription_number, 'N/A'), E'\n'), 
        'No unattended patients.'
    ) INTO r_unattended
    FROM (
        SELECT slot_number, patient_name, token_string, prescription_number
        FROM queue
        WHERE doctor_id = doc_id AND status = 'waiting'
        ORDER BY slot_number ASC
    ) t;

    -- Format the report header matching the requested template with two distinct tables
    r_text := '=========================================' || E'\n' ||
              '       QUEUE CURE - SESSION REPORT       ' || E'\n' ||
              '=========================================' || E'\n' ||
              'Doctor Name  : ' || COALESCE(d_name, 'N/A') || E'\n' ||
              'Department   : ' || COALESCE(d_dept, 'N/A') || E'\n' ||
              'Chamber No   : ' || COALESCE(d_chamber, 'N/A') || E'\n' ||
              'Phone Number : ' || COALESCE(d_phone, 'N/A') || E'\n' ||
              '-----------------------------------------' || E'\n' ||
              'Date : ' || TO_CHAR(NOW(), 'DD/MM/YYYY') || E'\n' ||
              'Time : ' || start_time_str || ' - ' || TO_CHAR(NOW(), 'HH24:MI:SS') || E'\n' ||
              'Session Name : ' || s_name || E'\n' ||
              '-----------------------------------------' || E'\n' ||
              'ATTENDED PATIENTS' || E'\n' ||
              '-----------------------------------------' || E'\n' ||
              r_text || E'\n' ||
              '-----------------------------------------' || E'\n' ||
              'UNATTENDED PATIENTS (' || unattended_count || ')' || E'\n' ||
              '-----------------------------------------' || E'\n' ||
              r_unattended || E'\n' ||
              '=========================================';

    -- Save to sessions history table if queue was not empty
    IF p_count > 0 THEN
        INSERT INTO sessions (doctor_id, session_name, patient_list, report_text)
        VALUES (doc_id, s_name, p_list, r_text);
    END IF;

    -- Clear the queue table for this doctor only (using a WHERE clause to bypass Supabase Safe Dev Mode)
    DELETE FROM queue WHERE doctor_id = doc_id AND id IS NOT NULL;

    -- Reset doctor settings
    UPDATE doctors 
    SET current_serving_token = '--', accepting_patients = TRUE 
    WHERE id = doc_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
