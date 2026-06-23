# 🏥 Queue Cure

**Queue Cure** is a premium, real-time Clinic Queue Management System designed to streamline patient registration, check-ins, cabin call-ups, and session reporting. Built with a React frontend and backed by Supabase (PostgreSQL with Realtime Replication), the application guarantees atomic operations and instant updates across all receptionist, doctor, and waiting room screens.

---

## 🚀 Key Features

### 1. Multi-Doctor System & Custom Tokens

- **Flexible Check-ins:** Assign patients to specific doctors. Tokens are automatically generated using a precise structural formula: `<Initials>-<Chamber>-<Slot>` (e.g., `TE-101-4`).
- **Doctor Security Pipeline:** Secure registration and authentication handled via phone number to grant localized access to personal dashboards.

### 2. Receptionist Dashboard

- **Dynamic Doctor Search:** Quick lookup by name or department.
- **Patient Management Engine:** Register patients with their Name and an optional Prescription Number, or quickly revoke accidental check-ins using Name + Token validation.
- **Consultation Controls:** Modify individual doctor consultation times on the fly to dynamically drive wait-time calculation predictions.
- **Session Archival logs:** View historical data on completed doctor shifts and directly export past session reports.

### 3. Doctor Dashboard

- **Atomic Cabin Call Control:** A single-click _Call Next Patient_ action that advances the queue atomically without manual front-desk coordination.
- **Registration Toggle:** Open or close active room check-ins instantly to control incoming patient traffic.
- **Session Termination:** Flushes active queues, resets token metrics, and automatically compiles/downloads formal session reports in Microsoft Word (`.doc`) format.

### 4. Interactive Waiting Room View

- **Room Selector Filtering:** Contextual filtering by Chamber/Room to isolate and display a specific doctor's active pipeline.
- **"Now Serving" Hero Display:** Centered display of the token currently inside the cabin, complete with a pulsing green real-time status indicator.
- **Patient Lookup Tool:** A real-time search panel allowing patients to verify their status, assigned chamber, token ranking and waiting time.
- **Next 10 Waitlist:** Displays upcoming tokens with math-driven estimated wait times.

### 5. Dev View / Production Environment Switcher

- **Developer Workspace:** Renders all three panels (Receptionist, Doctor, and Waiting Room) side-by-side in a single viewport for rapid local testing and state monitoring.
- **Production Workspace:** Implements hash-based routing (`#receptionist`, `#doctor`, `#waiting`).
- **Native Desktop Shell Simulation:** Spawns dedicated windows with customized aspect ratios and hidden navigation bars for a native display.

---

## 🛠️ Tech Stack

- **Frontend:** React (Vite), JavaScript, Tailwind CSS, Lucide React (Icons)
- **Backend Database:** Supabase (PostgreSQL)
- **Real-time Engine:** Supabase Realtime Channels (Postgres Changes)
- **Transaction Isolation:** PL/pgSQL Database Functions (RPCs)

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

1. Initialize a new project via the [Supabase Dashboard](https://supabase.com).
2. Navigate to the **SQL Editor** tab.
3. Open `backend/schema.sql` from this repository, copy its contents, and execute the query. This builds the `doctors`, `queue`, and `sessions` tables, configures Row Level Security (RLS) policies, and creates the required atomic RPC database functions.

### 2. Frontend Configuration

1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```

````

2. Install the system dependencies:
```bash
npm install

````

3. Create a `.env` file in the root of the `frontend` folder containing your target Supabase access credentials:

```env
VITE_SUPABASE_URL=[https://your-project-id.supabase.co](https://your-project-id.supabase.co)
VITE_SUPABASE_ANON_KEY=your-anon-key-here

```

### 3. Run the Development Server

1. Start the Vite dev server:

```bash
npm run dev

```

2. Open the URL provided in your terminal (typically `http://localhost:5173/`).

---

## 📦 Database Schemas & RPC Functions

### Tables

- **`doctors`:** Tracks physician profiles (`id`, `full_name`, `department`, `chamber_number`, `phone_number`, `current_serving_token`, `accepting_patients`, `initial_avg_consultation_time`).
- **`queue`:** Tracks chronological patient flow (`id`, `patient_name`, `doctor_id`, `token_string`, `slot_number`, `prescription_number`, `status` [`waiting`, `in-consultation`, `completed`], `called_at`, `created_at`).
- **`sessions`:** Archives closed logs (`id`, `doctor_id`, `session_name`, `patient_list` [JSONB summary], `report_text` [Plain text layout], `created_at`).

### Core RPC Functions

- **`add_patient_to_queue(p_name TEXT, doc_id UUID, p_prescription TEXT)`:** Handles atomic token string compilation based on physician metadata while linearly incrementing slot indexes.
- **`call_next_patient_for_doctor(doc_id UUID)`:** Performs row-locked operations (`FOR UPDATE`) to mark current consultations as complete and advance the next patient, shielding the system from double-call race conditions.
- **`end_session_for_doctor(doc_id UUID, s_name TEXT)`:** Aggregates operational analytics into JSON formats, generates a text log structure, and flushes active room targets to reset system variables.
