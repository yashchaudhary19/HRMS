# Multi-Tenant HR Management System (HRMS)

A comprehensive, enterprise-grade Multi-Tenant HR Management System consisting of a FastAPI backend, a Next.js Admin Dashboard, and a Flutter Mobile App. The system is designed to support role-based operations (Super Admin → Tenant Admin → Manager/HR → Employee) with features like geofenced office punches, remote WFH tracking, leave requests, salary slips, and helpdesk support.

---

## 🚀 Repository Structure

This repository is organized as a monorepo containing three core components:

*   **[`backend/`](file:///c:/Users/chaud/OneDrive/Desktop/hr%20system/backend)**: Python FastAPI REST API connected to a remote Supabase PostgreSQL database.
*   **[`frontend/`](file:///c:/Users/chaud/OneDrive/Desktop/hr%20system/frontend)**: Next.js Admin Dashboard for Super Admins and Company Admins to manage companies, departments, announcements, and track employee hours.
*   **[`mobile/`](file:///c:/Users/chaud/OneDrive/Desktop/hr%20system/mobile)**: Flutter Application for employee self-service (punching in, WFH sessions, requesting leaves, viewing salary history).

---

## ✨ Core Features

### 📍 Location-Verified Attendance
*   **Office Punch**: Verifies that the employee is physically present inside the designated geofence radius (e.g., 200m) and connected to the allowed office Wi-Fi SSID before permitting check-in.
*   **Work From Home (WFH)**: Allows remote sessions with periodic location tracking and geofence distance verification. Shows smart warning banners if GPS/location services are disabled.

### 💼 HR & Leaves Management
*   **Leave Applications**: Employees can apply for leaves, view balances, and check status history.
*   **Approvals**: HR and Managers receive real-time updates to approve or reject pending leave requests.

### 💰 Payroll & Salary History
*   **Salary Slips**: Admins can issue monthly salary slips. Employees can view payout details, tax deductions, and download/view salary history.

### 🏢 Multi-Tenant Architecture
*   **Super Admin**: Oversees the entire ecosystem, creates tenant companies, and registers Tenant Admins.
*   **Tenant Admin**: Manages their specific company, departments, employees, and office geofencing coordinates.
*   **Employee Self-Service**: Accesses personal records, attendance logging, and support tickets.

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Backend** | FastAPI, SQLAlchemy (ORM), Alembic (Migrations), PostgreSQL (Supabase), Uvicorn |
| **Admin Frontend** | Next.js, React, Tailwind CSS |
| **Mobile App** | Flutter, Dart, Geolocator (GPS tracking), Dio (Networking), Provider (State management) |

---

## 🔧 Getting Started

### 1. Backend Setup
1. Navigate to the `backend` folder:
    ```bash
    cd backend
    ```
2. Create and activate a Python virtual environment:
    ```bash
    python -m venv venv
    .\venv\Scripts\activate
    ```
3. Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
4. Set up environment variables in a `.env` file (refer to `.env.example`).
5. Run the development server:
    ```bash
    uvicorn app.main:app --reload
    ```

### 2. Frontend Setup
1. Navigate to the `frontend` folder:
    ```bash
    cd frontend
    ```
2. Install npm dependencies:
    ```bash
    npm install
    ```
3. Start the Next.js development server:
    ```bash
    npm run dev
    ```

### 3. Mobile App Setup
1. Navigate to the `mobile` folder:
    ```bash
    cd mobile
    ```
2. Get Flutter packages:
    ```bash
    flutter pub get
    ```
3. Run the application:
    ```bash
    flutter run
    ```

---

## ☁️ Deployment

*   **Database**: Supabase PostgreSQL database.
*   **API Hosting**: Hosted on **Render** at: `https://hrms-lg07.onrender.com/`
