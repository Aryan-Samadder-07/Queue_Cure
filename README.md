# Queue Cure 🏥

**Queue Cure** is a premium, real-time Clinic Queue Management System designed to streamline patient registration, check-ins, cabin call-ups, and session reporting. Built with a React frontend and backed by Supabase (PostgreSQL with Realtime Replication), the application guarantees atomic operations and instant updates across all receptionist, doctor, and waiting room screens.

---

## 🚀 Key Features

### 1. Multi-Doctor System & Custom Tokens
* **Flexible Check-ins**: Assign patients to specific doctors. Tokens are automatically generated using the formula: `<Initials>-<Chamber>-<Slot>` (e.g. `TE-101-4`).
* **Doctor Self-Registration & Login**: Doctors register or log in securely using their phone number to access their personal dashboard.

### 2. Receptionist Dashboard
* **Doctor Search**: Quick doctor lookup by name or department.
* **Add Patient**: Register patients with their Name and optional Prescription Number.
* **Remove Patient**: Quickly delete accidental check-ins by entering Name and Token Number.
* **Consultation Settings**: Set or reset individual doctor consultation times (dynamic calculations predict waiting times automatically).
* **Logs & Session History**: View completed doctor shifts and download past session reports.

### 3. Doctor Dashboard
* **Cabin Call Control**: Press *Call Next Patient* to advance the queue atomically.
* **Registration Toggle**: Open or close check-ins for the room on the fly.
* **End Session**: Reset token counters, wipe active lists, and automatically compile/download professional Microsoft Word (`.doc`) reports.

### 4. Interactive Waiting Room
* **Room Selector Filter**: Choose a specific Chamber/Room to view that doctor's active list.
* **Centralized Now Serving Banner**: Huge centered display of the token currently inside the cabin, plus a pulsing green live status indicator.
* **Search Panel**: Patients can search their names to instantly lookup status, doctor chamber, and token number.
* **Top 10 Waitlist**: Displays upcoming patients with math-driven estimated wait times.

### 5. Dev View / Production View Switcher
* **Developer View**: Renders all 3 panels (Receptionist, Doctor, and Waiting Room) side-by-side in a single window for easy developer testing.
* **Production View**: Implements hash-based routing (`#receptionist`, `#doctor`, `#waiting`) and edge-to-edge full-screen display.
* **Standalone Popups**: Launches dedicated windows with customized dimensions and hidden browser navigation bars for a native, desktop-app feel.

---

## 🛠️ Tech Stack

* **Frontend**: React (Vite), JavaScript, Tailwind CSS, Lucide React (Icons).
* **Backend Database**: Supabase (PostgreSQL).
* **Realtime**: Supabase Postgres Changes Channels.
* **Atomicity & Transaction Safety**: Pl/pgSQL Database Functions (RPCs).

---

## 📁 Project Structure

```
Queue_Cure/
├── backend/
│   └── schema.sql              # Supabase SQL Editor setup script
└── frontend/
    ├── src/
    │   ├── App.jsx             # Main router, Dev/Prod layout toggles
    │   ├── main.jsx
    │   ├── index.css           # Styling configs
    │   ├── lib/
    │   │   └── supabase.js     # Supabase client config
    │   └── components/
    │       ├── ReceptionistView.jsx      # Receptionist controls
    │       ├── DoctorDashboardView.jsx   # Doctor dashboard
    │       └── PatientWaitingView.jsx    # Waitlist & Lookup screen
    ├── package.json
    └── tailwind.config.js
```

---

## ⚙️ Installation & Setup

### 1. Database Setup (Supabase)
1. Create a new project in your [Supabase Dashboard](https://supabase.com).
2. Go to the **SQL Editor** tab.
3. Open `backend/schema.sql` from this repository, copy its contents, and execute them in the editor. This creates the `doctors`, `queue`, and `sessions` tables, configures Row Level Security (RLS) policies, and installs the required RPC functions.

### 2. Frontend Configuration
1. Navigate into the `frontend` folder:
   ```bash
   cd frontend
   ```
2. Install the node modules:
   ```bash
   npm install
   ```
3. Create a `.env` file in the `frontend` folder containing your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

### 3. Run the Development Server
1. Start Vite:
   ```bash
   npm run dev
   ```
2. Open the URL displayed in your terminal (usually `http://localhost:5173/`).

---

## 📦 Database Schemas & RPC Functions

### Tables
* **`doctors`**: Contains fields for `id` (UUID), `full_name`, `department`, `chamber_number`, `phone_number`, `current_serving_token`, `accepting_patients`, and `initial_avg_consultation_time`.
* **`queue`**: Contains checked-in patients: `id`, `patient_name`, `doctor_id`, `token_string`, `slot_number`, `prescription_number`, `status` (`waiting`, `in-consultation`, `completed`), `called_at`, and `created_at`.
* **`sessions`**: Stored logs: `id`, `doctor_id`, `session_name`, `patient_list` (JSONB list of checked-in patients), `report_text` (plain text report layout), and `created_at`.

### RPC Functions
* **`add_patient_to_queue(p_name TEXT, doc_id UUID, p_prescription TEXT)`**: Generates custom initials, increments slot numbers atomically, and returns the token string.
* **`call_next_patient_for_doctor(doc_id UUID)`**: Performs atomic cabin call-ups using row locks (`FOR UPDATE`), flags previous sessions completed, and updates doctor serving statuses.
* **`end_session_for_doctor(doc_id UUID, s_name TEXT)`**: Compiles session JSON summaries, formats the plain text report, flushes the active queue for the doctor, and resets settings.
