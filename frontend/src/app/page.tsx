"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, removeToken, getToken } from "@/lib/api";

// Interfaces
interface Employee {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  employee_id: string;
  role: string; // super_admin, admin, hr, manager, employee
  company_id?: number;
  is_active: boolean;
  department_id?: number;
  reporting_manager_id?: number;
  bank_name?: string;
  bank_account_no?: string;
  salary_amount?: number;
  emergency_contact?: string;
  casual_leaves_entitled?: number;
  sick_leaves_entitled?: number;
  wfh_leaves_entitled?: number;
  earned_leaves_entitled?: number;
  created_at: string;
}

interface AttendanceRecord {
  id: number;
  employee_id: number;
  date: string;
  check_in?: string;
  check_out?: string;
  check_in_gps?: string;
  check_out_gps?: string;
  wifi_ssid?: string;
  device_info?: string;
  status: string; // present, absent, late, early_departure, half_day, wfh
  working_hours: number;
  daily_summary?: string;
  task_updates?: string;
}

interface LeaveRequest {
  id: number;
  employee_id: number;
  leave_type: string;
  start_date: string;
  end_date: string;
  status: string; // pending, approved, rejected
  reason?: string;
  approved_by_id?: number;
  created_at: string;
}

interface HelpTicket {
  id: number;
  ticket_no: string;
  employee_id: number;
  category: string;
  title: string;
  description: string;
  status: string;
  last_message?: string;
  assigned_to?: string;
  created_at: string;
  closed_at?: string;
}

// Local mock data interfaces
interface ShiftAssignment {
  employeeId: number;
  employeeName: string;
  shiftType: string; // fixed_day, rotational, night
  schedule: string; // Mon-Fri 9AM-5PM, Rotational, Mon-Fri 10PM-6AM
}

// Helper: parse datetime strings from backend as UTC (they lack 'Z' suffix)
function parseUTC(dateStr: string): Date {
  if (!dateStr) return new Date(NaN);
  // If no timezone info, treat as UTC by appending 'Z'
  if (!dateStr.endsWith('Z') && !dateStr.includes('+') && !/[0-9]-[0-9]{2}:[0-9]{2}$/.test(dateStr)) {
    return new Date(dateStr + 'Z');
  }
  return new Date(dateStr);
}

export default function DashboardPage() {
  const router = useRouter();
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  // Tab navigation
  const [activeTab, setActiveTab] = useState("my-portal");

  // Core API State
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [allAttendance, setAllAttendance] = useState<AttendanceRecord[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState<LeaveRequest[]>([]);
  const [allLeaves, setAllLeaves] = useState<LeaveRequest[]>([]);

  // Tenant Management State (Super Admin Only)
  const [adminsList, setAdminsList] = useState<any[]>([]);
  const [selectedTenantStats, setSelectedTenantStats] = useState<any | null>(null);
  const [showProvisionModal, setShowProvisionModal] = useState(false);
  const [provisionForm, setProvisionForm] = useState({
    company_name: "",
    company_address: "",
    subscription_plan: "basic",
    admin_email: "",
    admin_first_name: "",
    admin_last_name: "",
    admin_password: "",
    admin_employee_id: ""
  });
  const [provisionError, setProvisionError] = useState("");
  const [provisionLoading, setProvisionLoading] = useState(false);

  // Org Settings and Board data State
  const [companies, setCompanies] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);

  // Org Forms state
  const [companyForm, setCompanyForm] = useState({ name: "", address: "" });
  const [deptForm, setDeptForm] = useState({ name: "", company_id: "" });
  const [annForm, setAnnForm] = useState({ title: "", content: "", tag: "General", is_urgent: false });
  const [holidayForm, setHolidayForm] = useState({ title: "", date: "", holiday_type: "Public Holiday" });

  // Office settings state (restricted strictly to admin role)
  const [selectedOfficeCompanyId, setSelectedOfficeCompanyId] = useState<string>("");
  const [officeSettingsForm, setOfficeSettingsForm] = useState({
    office_latitude: "",
    office_longitude: "",
    allowed_wifi_ssids: "",
    allowed_wifi_bssids: "",
    max_distance_meters: ""
  });
  const [officeSettingsSuccess, setOfficeSettingsSuccess] = useState<string>("");
  const [officeSettingsError, setOfficeSettingsError] = useState<string>("");
  const [officeSettingsLoading, setOfficeSettingsLoading] = useState(false);

  // My Portal State
  const [todayPunch, setTodayPunch] = useState<AttendanceRecord | null>(null);
  const [myLeaveBalances, setMyLeaveBalances] = useState<Record<string, number>>({});
  const [myLeaveHistory, setMyLeaveHistory] = useState<LeaveRequest[]>([]);
  const [applyLeaveForm, setApplyLeaveForm] = useState({
    leave_type: "casual",
    start_date: "",
    end_date: "",
    reason: ""
  });
  const [applyLeaveMessage, setApplyLeaveMessage] = useState({ type: "", text: "" });
  const [applyLeaveLoading, setApplyLeaveLoading] = useState(false);

  // Admin: Employee Management Form State
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
  const [employeeForm, setEmployeeForm] = useState({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    employee_id: "",
    role: "employee",
    company_id: "",
    department_id: "",
    reporting_manager_id: "",
    bank_name: "",
    bank_account_no: "",
    salary_amount: "",
    emergency_contact: "",
    casual_leaves_entitled: "15",
    sick_leaves_entitled: "10",
    wfh_leaves_entitled: "30",
    earned_leaves_entitled: "12"
  });
  const [employeeFormError, setEmployeeFormError] = useState("");
  const [employeeFormLoading, setEmployeeFormLoading] = useState(false);

  // Admin: Selected Employee for Edits / Detail view
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showEditEmployeeModal, setShowEditEmployeeModal] = useState(false);

  // Admin: Attendance Correction State
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionForm, setCorrectionForm] = useState({
    employee_id: "",
    date: new Date().toISOString().split("T")[0],
    check_in_time: "09:00",
    check_out_time: "17:00",
    status: "present"
  });
  const [correctionMessage, setCorrectionMessage] = useState("");

  // Local state for Shift management (Mock)
  const [shiftAssignments, setShiftAssignments] = useState<ShiftAssignment[]>([]);
  const [showAssignShiftModal, setShowAssignShiftModal] = useState(false);
  const [assignShiftForm, setAssignShiftForm] = useState({
    employee_id: "",
    shift_type: "fixed_day"
  });

  // Local state for Payroll Integration (Real)
  const [selectedPayrollEmployee, setSelectedPayrollEmployee] = useState<Employee | null>(null);
  const [selectedEmployeeSlips, setSelectedEmployeeSlips] = useState<any[]>([]);
  const [slipForm, setSlipForm] = useState({
    month: "",
    payout_date: "",
    status: "paid", // paid | processing | pending
    base_salary: "0",
    bonus: "0",
    federal_tax: "0",
    health_insurance: "150",
    retirement_contribution: "200"
  });
  const [payrollError, setPayrollError] = useState("");
  const [payrollSuccess, setPayrollSuccess] = useState("");
  const [payrollLoading, setPayrollLoading] = useState(false);

  // Support Tickets State
  const [allTickets, setAllTickets] = useState<HelpTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<HelpTicket | null>(null);
  const [replyMessage, setReplyMessage] = useState("");
  const [assigneeName, setAssigneeName] = useState("");
  const [ticketStatus, setTicketStatus] = useState("");
  const [supportLoading, setSupportLoading] = useState(false);
  const [supportMessage, setSupportMessage] = useState("");

  // Load Dashboard
  const loadInitialData = async () => {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      // 1. Get Logged in employee
      const profile = await api.employees.getMe();
      setCurrentEmployee(profile);

      if (profile.role === "super_admin") {
        setActiveTab("employees");
      } else {
        // 2. Load personal data
        try {
          const punch = await api.attendance.getStatus();
          setTodayPunch(punch);
        } catch (e) {
          console.error("Failed to load today's punch status", e);
        }

        try {
          const balances = await api.leaves.getBalances();
          setMyLeaveBalances(balances);
        } catch (e) {
          console.error("Failed to load leave balances", e);
        }

        try {
          const history = await api.leaves.getMyRequests();
          setMyLeaveHistory(history);
        } catch (e) {
          console.error("Failed to load leave history", e);
        }
      }

      // Load announcements and holidays
      try {
        const anns = await api.dashboard.getAnnouncements();
        setAnnouncements(anns);
        const hols = await api.dashboard.getHolidays();
        setHolidays(hols);
      } catch (e) {
        console.error("Failed to load announcements/holidays", e);
      }

      // 3. Load privileged data if HR/Admin/Manager/SuperAdmin
      if (profile.role !== "employee") {
        const empList = await api.employees.list();
        setAllEmployees(empList);

        if (profile.role !== "super_admin") {
          const logs = await api.attendance.getHistory();
          setAllAttendance(logs);

          const pending = await api.leaves.getPending();
          setPendingLeaves(pending);
          setAllLeaves(pending); // fallback

          // Setup initial mock shift assignments
          const initialShifts = empList.map((emp: Employee) => ({
            employeeId: emp.id,
            employeeName: `${emp.first_name} ${emp.last_name}`,
            shiftType: ["super_admin", "admin"].includes(emp.role) ? "fixed_day" : "rotational",
            schedule: ["super_admin", "admin"].includes(emp.role) ? "Mon-Fri 9AM-5PM" : "Rotational Shift"
          }));
          setShiftAssignments(initialShifts);
        }

        if (profile.role === "admin" || profile.role === "hr") {
          try {
            const tickets = await api.helpdesk.listAll();
            setAllTickets(tickets);
          } catch (e) {
            console.error("Failed to load support tickets", e);
          }
        }
        
        // Fetch companies and departments
        try {
          const comps = await api.companies.list();
          setCompanies(comps);
          const depts = await api.departments.list();
          setDepartments(depts);
          
          if (profile.role !== "super_admin" && comps.length > 0) {
            setDeptForm(prev => ({ ...prev, company_id: String(comps[0].id) }));
          }

          if (profile.role === "admin" && comps.length > 0) {
            const myCompany = comps.find((c: any) => c.id === profile.company_id) || comps[0];
            setSelectedOfficeCompanyId(String(myCompany.id));
            setOfficeSettingsForm({
              office_latitude: String(myCompany.office_latitude ?? "28.6252"),
              office_longitude: String(myCompany.office_longitude ?? "77.3736"),
              allowed_wifi_ssids: myCompany.allowed_wifi_ssids ?? "",
              allowed_wifi_bssids: myCompany.allowed_wifi_bssids ?? "",
              max_distance_meters: String(myCompany.max_distance_meters ?? "200.0")
            });
          }
        } catch (e) {
          console.error("Failed to load companies/departments", e);
        }

        // For super admin, fetch tenant admins
        if (profile.role === "super_admin") {
          try {
            const admins = await api.admins.list();
            setAdminsList(admins);
          } catch (e) {
            console.error("Failed to load tenant admins", e);
          }
        }
      }
    } catch (err: any) {
      console.error("Failed to load initial workspace data:", err);
      removeToken();
      router.push("/login");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Sync office settings form if selected company changes
  useEffect(() => {
    if (selectedOfficeCompanyId && companies.length > 0) {
      const selectedComp = companies.find((c: any) => String(c.id) === selectedOfficeCompanyId);
      if (selectedComp) {
        setOfficeSettingsForm({
          office_latitude: String(selectedComp.office_latitude ?? "28.6252"),
          office_longitude: String(selectedComp.office_longitude ?? "77.3736"),
          allowed_wifi_ssids: selectedComp.allowed_wifi_ssids ?? "",
          allowed_wifi_bssids: selectedComp.allowed_wifi_bssids ?? "",
          max_distance_meters: String(selectedComp.max_distance_meters ?? "200.0")
        });
      }
    }
  }, [selectedOfficeCompanyId, companies]);

  const handleUpdateOfficeSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setOfficeSettingsSuccess("");
    setOfficeSettingsError("");
    setOfficeSettingsLoading(true);
    try {
      const companyId = parseInt(selectedOfficeCompanyId);
      if (!companyId) {
        throw new Error("No company selected");
      }

      const payload = {
        office_latitude: parseFloat(officeSettingsForm.office_latitude),
        office_longitude: parseFloat(officeSettingsForm.office_longitude),
        allowed_wifi_ssids: officeSettingsForm.allowed_wifi_ssids,
        allowed_wifi_bssids: officeSettingsForm.allowed_wifi_bssids,
        max_distance_meters: parseFloat(officeSettingsForm.max_distance_meters),
      };

      if (isNaN(payload.office_latitude) || isNaN(payload.office_longitude)) {
        throw new Error("Latitude and Longitude must be valid numbers");
      }
      if (isNaN(payload.max_distance_meters)) {
        throw new Error("Maximum distance must be a valid number");
      }

      const updatedComp = await api.companies.update(companyId, payload);
      
      // Update in companies state
      setCompanies(prev => prev.map((c: any) => c.id === companyId ? { ...c, ...updatedComp } : c));
      setOfficeSettingsSuccess("Office network & geolocation settings updated successfully!");
    } catch (err: any) {
      setOfficeSettingsError(err.message || "Failed to update office settings.");
    } finally {
      setOfficeSettingsLoading(false);
    }
  };

  // Core Actions
  const handleLogout = () => {
    api.auth.logout();
    router.push("/login");
  };

  const handleCheckIn = async () => {
    try {
      const record = await api.attendance.checkIn({
        wifi_ssid: "Office_Corp_Secure",
        device_info: typeof window !== "undefined" ? window.navigator.userAgent.substring(0, 100) : "Browser",
        check_in_gps: "28.6139,77.2090"
      });
      setTodayPunch(record);
      loadInitialData();
    } catch (err: any) {
      alert(err.message || "Failed to check in.");
    }
  };

  const handleCheckOut = async () => {
    try {
      const record = await api.attendance.checkOut({
        check_out_gps: "28.6139,77.2090"
      });
      setTodayPunch(record);
      loadInitialData();
    } catch (err: any) {
      alert(err.message || "Failed to check out.");
    }
  };

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    setApplyLeaveLoading(true);
    setApplyLeaveMessage({ type: "", text: "" });

    try {
      await api.leaves.apply(applyLeaveForm);
      setApplyLeaveMessage({ type: "success", text: "Leave request submitted successfully!" });
      setApplyLeaveForm({ leave_type: "casual", start_date: "", end_date: "", reason: "" });
      
      const history = await api.leaves.getMyRequests();
      setMyLeaveHistory(history);
      const balances = await api.leaves.getBalances();
      setMyLeaveBalances(balances);
    } catch (err: any) {
      setApplyLeaveMessage({ type: "error", text: err.message || "Failed to submit leave request." });
    } finally {
      setApplyLeaveLoading(false);
    }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmployeeFormLoading(true);
    setEmployeeFormError("");

    try {
      const payload = {
        ...employeeForm,
        company_id: employeeForm.company_id ? parseInt(employeeForm.company_id) : null,
        department_id: employeeForm.department_id ? parseInt(employeeForm.department_id) : null,
        reporting_manager_id: employeeForm.reporting_manager_id ? parseInt(employeeForm.reporting_manager_id) : null,
        salary_amount: employeeForm.salary_amount ? parseFloat(employeeForm.salary_amount) : null,
        casual_leaves_entitled: isNaN(parseInt(employeeForm.casual_leaves_entitled)) ? 15 : parseInt(employeeForm.casual_leaves_entitled),
        sick_leaves_entitled: isNaN(parseInt(employeeForm.sick_leaves_entitled)) ? 10 : parseInt(employeeForm.sick_leaves_entitled),
        wfh_leaves_entitled: isNaN(parseInt(employeeForm.wfh_leaves_entitled)) ? 30 : parseInt(employeeForm.wfh_leaves_entitled),
        earned_leaves_entitled: isNaN(parseInt(employeeForm.earned_leaves_entitled)) ? 12 : parseInt(employeeForm.earned_leaves_entitled)
      };

      await api.employees.create(payload);
      setShowAddEmployeeModal(false);
      setEmployeeForm({
        email: "",
        password: "",
        first_name: "",
        last_name: "",
        employee_id: "",
        role: "employee",
        company_id: "",
        department_id: "",
        reporting_manager_id: "",
        bank_name: "",
        bank_account_no: "",
        salary_amount: "",
        emergency_contact: "",
        casual_leaves_entitled: "15",
        sick_leaves_entitled: "10",
        wfh_leaves_entitled: "30",
        earned_leaves_entitled: "12"
      });
      // Refresh directory list
      const list = await api.employees.list();
      setAllEmployees(list);
    } catch (err: any) {
      setEmployeeFormError(err.message || "Failed to add employee.");
    } finally {
      setEmployeeFormLoading(false);
    }
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;

    setEmployeeFormLoading(true);
    setEmployeeFormError("");

    try {
      const payload = {
        first_name: selectedEmployee.first_name,
        last_name: selectedEmployee.last_name,
        email: selectedEmployee.email,
        role: selectedEmployee.role,
        is_active: selectedEmployee.is_active,
        bank_name: selectedEmployee.bank_name,
        bank_account_no: selectedEmployee.bank_account_no,
        salary_amount: selectedEmployee.salary_amount,
        emergency_contact: selectedEmployee.emergency_contact,
        company_id: selectedEmployee.company_id || null,
        department_id: selectedEmployee.department_id || null,
        reporting_manager_id: selectedEmployee.reporting_manager_id || null,
        casual_leaves_entitled: selectedEmployee.casual_leaves_entitled ?? 15,
        sick_leaves_entitled: selectedEmployee.sick_leaves_entitled ?? 10,
        wfh_leaves_entitled: selectedEmployee.wfh_leaves_entitled ?? 30,
        earned_leaves_entitled: selectedEmployee.earned_leaves_entitled ?? 12
      };

      await api.employees.update(selectedEmployee.id, payload);
      setShowEditEmployeeModal(false);
      setSelectedEmployee(null);

      // Refresh list
      const list = await api.employees.list();
      setAllEmployees(list);
    } catch (err: any) {
      setEmployeeFormError(err.message || "Failed to update employee details.");
    } finally {
      setEmployeeFormLoading(false);
    }
  };

  const handleLeaveApproval = async (leaveId: number, status: string) => {
    try {
      await api.leaves.updateStatus(leaveId, status);
      // Reload pending and history
      const pending = await api.leaves.getPending();
      setPendingLeaves(pending);
      loadInitialData();
    } catch (err: any) {
      alert(err.message || "Failed to update leave status.");
    }
  };

  const handleCreateCorrection = (e: React.FormEvent) => {
    e.preventDefault();
    const emp = allEmployees.find(e => e.id === parseInt(correctionForm.employee_id));
    if (!emp) return;

    const mockRecord: AttendanceRecord = {
      id: Math.floor(Math.random() * 100000),
      employee_id: emp.id,
      date: correctionForm.date,
      check_in: `${correctionForm.date}T${correctionForm.check_in_time}:00Z`,
      check_out: `${correctionForm.date}T${correctionForm.check_out_time}:00Z`,
      status: correctionForm.status,
      working_hours: 8.0
    };

    setAllAttendance(prev => [mockRecord, ...prev]);
    setCorrectionMessage("Attendance correction applied successfully!");
    setTimeout(() => {
      setShowCorrectionModal(false);
      setCorrectionMessage("");
    }, 1500);
  };

  const handleAssignShift = (e: React.FormEvent) => {
    e.preventDefault();
    const emp = allEmployees.find(e => e.id === parseInt(assignShiftForm.employee_id));
    if (!emp) return;

    let schedule = "Mon-Fri 9AM-5PM";
    if (assignShiftForm.shift_type === "rotational") schedule = "Rotational Shift (Flexible)";
    if (assignShiftForm.shift_type === "night") schedule = "Mon-Fri 10PM-6AM";

    setShiftAssignments(prev => prev.map(s => {
      if (s.employeeId === emp.id) {
        return {
          ...s,
          shiftType: assignShiftForm.shift_type,
          schedule
        };
      }
      return s;
    }));

    setShowAssignShiftModal(false);
  };

  // Org Settings Actions
  const [orgSuccess, setOrgSuccess] = useState("");
  const [orgError, setOrgError] = useState("");

  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrgSuccess("");
    setOrgError("");
    try {
      const newComp = await api.companies.create(companyForm);
      setCompanies(prev => [...prev, newComp]);
      setCompanyForm({ name: "", address: "" });
      setOrgSuccess("Company created successfully!");
    } catch (err: any) {
      setOrgError(err.message || "Failed to create company.");
    }
  };

  // Tenant Provision & Manage Actions (Super Admin Only)
  const handleProvisionTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setProvisionError("");
    setProvisionLoading(true);
    try {
      const payload = {
        company_name: provisionForm.company_name,
        company_address: provisionForm.company_address || null,
        subscription_plan: provisionForm.subscription_plan,
        admin_email: provisionForm.admin_email,
        admin_first_name: provisionForm.admin_first_name,
        admin_last_name: provisionForm.admin_last_name,
        admin_password: provisionForm.admin_password,
        admin_employee_id: provisionForm.admin_employee_id,
      };
      const newAdmin = await api.admins.create(payload);
      setAdminsList(prev => [newAdmin, ...prev]);
      
      // Refetch companies list to update assign company dropdowns
      const comps = await api.companies.list();
      setCompanies(comps);
      
      setShowProvisionModal(false);
      setProvisionForm({
        company_name: "",
        company_address: "",
        subscription_plan: "basic",
        admin_email: "",
        admin_first_name: "",
        admin_last_name: "",
        admin_password: "",
        admin_employee_id: ""
      });
      setOrgSuccess("Tenant provisioned successfully!");
    } catch (err: any) {
      setProvisionError(err.message || "Failed to provision tenant.");
    } finally {
      setProvisionLoading(false);
    }
  };

  const handleToggleSuspension = async (adminId: number) => {
    setOrgError("");
    setOrgSuccess("");
    try {
      const updatedCompany = await api.admins.toggleSuspension(adminId);
      setAdminsList(prev => prev.map(admin => {
        if (admin.id === adminId) {
          return { ...admin, company: updatedCompany };
        }
        return admin;
      }));
      setOrgSuccess(`Company ${updatedCompany.name} active status toggled!`);
    } catch (err: any) {
      setOrgError(err.message || "Failed to toggle suspension status.");
    }
  };

  const handleUpdateSubscription = async (adminId: number, plan: string) => {
    setOrgError("");
    setOrgSuccess("");
    try {
      const updatedCompany = await api.admins.updateSubscription(adminId, { subscription_plan: plan });
      setAdminsList(prev => prev.map(admin => {
        if (admin.id === adminId) {
          return { ...admin, company: updatedCompany };
        }
        return admin;
      }));
      setOrgSuccess(`Subscription plan updated to ${plan}!`);
    } catch (err: any) {
      setOrgError(err.message || "Failed to update subscription plan.");
    }
  };

  const handleLoadTenantStats = async (admin: any) => {
    setOrgError("");
    try {
      const stats = await api.admins.getStats(admin.id);
      setSelectedTenantStats(stats);
    } catch (err: any) {
      setOrgError(err.message || "Failed to load tenant stats.");
    }
  };

  const handleAddDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrgSuccess("");
    setOrgError("");
    if (!deptForm.company_id) {
      setOrgError("Please select a company.");
      return;
    }
    try {
      const payload = {
        name: deptForm.name,
        company_id: parseInt(deptForm.company_id)
      };
      const newDept = await api.departments.create(payload);
      setDepartments(prev => [...prev, newDept]);
      setDeptForm({ name: "", company_id: "" });
      setOrgSuccess("Department created successfully!");
    } catch (err: any) {
      setOrgError(err.message || "Failed to create department.");
    }
  };

  const handleAddAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrgSuccess("");
    setOrgError("");
    try {
      const newAnn = await api.dashboard.createAnnouncement(annForm);
      setAnnouncements(prev => [newAnn, ...prev]);
      setAnnForm({ title: "", content: "", tag: "General", is_urgent: false });
      setOrgSuccess("Announcement posted successfully!");
    } catch (err: any) {
      setOrgError(err.message || "Failed to post announcement.");
    }
  };

  const handleDeleteAnnouncement = async (id: number) => {
    setOrgSuccess("");
    setOrgError("");
    try {
      await api.dashboard.deleteAnnouncement(id);
      setAnnouncements(prev => prev.filter(a => a.id !== id));
      setOrgSuccess("Announcement deleted.");
    } catch (err: any) {
      setOrgError(err.message || "Failed to delete announcement.");
    }
  };

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrgSuccess("");
    setOrgError("");
    try {
      const newHol = await api.dashboard.createHoliday(holidayForm);
      setHolidays(prev => [...prev, newHol].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
      setHolidayForm({ title: "", date: "", holiday_type: "Public Holiday" });
      setOrgSuccess("Holiday added successfully!");
    } catch (err: any) {
      setOrgError(err.message || "Failed to add holiday.");
    }
  };

  const handleDeleteHoliday = async (id: number) => {
    setOrgSuccess("");
    setOrgError("");
    try {
      await api.dashboard.deleteHoliday(id);
      setHolidays(prev => prev.filter(h => h.id !== id));
      setOrgSuccess("Holiday deleted.");
    } catch (err: any) {
      setOrgError(err.message || "Failed to delete holiday.");
    }
  };

  const loadEmployeeSlips = async (employeeId: number) => {
    try {
      const slips = await api.salary.listAll(employeeId);
      setSelectedEmployeeSlips(slips);
    } catch (err: any) {
      console.error("Failed to load slips:", err);
    }
  };

  const handleCalculatePayroll = async (emp: Employee) => {
    setSelectedPayrollEmployee(emp);
    setPayrollError("");
    setPayrollSuccess("");

    const base = emp.salary_amount || 0;
    // Calculate a default monthly base: if annual tier, divide by 12, otherwise default to tier directly
    const monthlyBase = base >= 2000 ? Math.round((base / 12) * 100) / 100 : base;
    const defaultTax = Math.round((monthlyBase * 0.10) * 100) / 100; // 10% default monthly tax

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const now = new Date();
    const defaultMonth = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;

    setSlipForm({
      month: defaultMonth,
      payout_date: now.toISOString().split("T")[0],
      status: "paid",
      base_salary: String(monthlyBase),
      bonus: "0",
      federal_tax: String(defaultTax),
      health_insurance: "150",
      retirement_contribution: "200"
    });

    await loadEmployeeSlips(emp.id);
  };

  const handleIssueSalarySlip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayrollEmployee) return;

    setPayrollLoading(true);
    setPayrollError("");
    setPayrollSuccess("");

    try {
      const base = parseFloat(slipForm.base_salary) || 0;
      const bonus = parseFloat(slipForm.bonus) || 0;
      const tax = parseFloat(slipForm.federal_tax) || 0;
      const health = parseFloat(slipForm.health_insurance) || 0;
      const retirement = parseFloat(slipForm.retirement_contribution) || 0;

      const gross = base + bonus;

      const payload = {
        employee_id: selectedPayrollEmployee.id,
        month: slipForm.month,
        payout_date: slipForm.payout_date,
        status: slipForm.status,
        gross_salary: gross,
        base_salary: base,
        bonus: bonus,
        federal_tax: tax,
        health_insurance: health,
        retirement_contribution: retirement
      };

      await api.salary.issue(payload);
      setPayrollSuccess(`Successfully issued salary slip for ${slipForm.month}!`);
      
      // Reload history/slips
      await loadEmployeeSlips(selectedPayrollEmployee.id);
    } catch (err: any) {
      setPayrollError(err.message || "Failed to issue salary slip.");
    } finally {
      setPayrollLoading(false);
    }
  };

  const handleUpdateSlipStatus = async (slipId: number, status: string) => {
    try {
      await api.salary.updateStatus(slipId, status);
      if (selectedPayrollEmployee) {
        await loadEmployeeSlips(selectedPayrollEmployee.id);
      }
    } catch (err: any) {
      alert(err.message || "Failed to update slip status.");
    }
  };

  const handleDeleteSlip = async (slipId: number) => {
    if (!confirm("Are you sure you want to delete this salary slip?")) return;
    try {
      await api.salary.delete(slipId);
      if (selectedPayrollEmployee) {
        await loadEmployeeSlips(selectedPayrollEmployee.id);
      }
    } catch (err: any) {
      alert(err.message || "Failed to delete salary slip.");
    }
  };

  const handleSelectTicket = (ticket: HelpTicket) => {
    setSelectedTicket(ticket);
    setReplyMessage(ticket.last_message || "");
    setAssigneeName(ticket.assigned_to || "");
    setTicketStatus(ticket.status || "open");
    setSupportMessage("");
  };

  const handleUpdateTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;
    setSupportLoading(true);
    setSupportMessage("");
    try {
      const updated = await api.helpdesk.update(selectedTicket.id, {
        status: ticketStatus,
        assigned_to: assigneeName,
        last_message: replyMessage
      });
      setAllTickets(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t));
      setSelectedTicket(prev => prev ? { ...prev, ...updated } : null);
      setSupportMessage("Ticket updated successfully!");
    } catch (err: any) {
      console.error(err);
      setSupportMessage(`Error: ${err.message || "Failed to update ticket"}`);
    } finally {
      setSupportLoading(false);
    }
  };

  // CSV Report exporter helper
  const handleExportCSV = (reportType: string) => {
    let headers: string[] = [];
    let rows: string[][] = [];
    let filename = `${reportType}_report.csv`;

    if (reportType === "employees") {
      headers = ["Employee ID", "First Name", "Last Name", "Email", "Role", "Salary", "Bank", "Account No"];
      rows = allEmployees.map(emp => [
        emp.employee_id,
        emp.first_name,
        emp.last_name,
        emp.email,
        emp.role,
        String(emp.salary_amount || 0),
        emp.bank_name || "N/A",
        emp.bank_account_no || "N/A"
      ]);
    } else if (reportType === "attendance") {
      headers = ["Employee ID", "Date", "Check In", "Check Out", "Working Hours", "Status"];
      rows = allAttendance.map(log => {
        const emp = allEmployees.find(e => e.id === log.employee_id);
        return [
          emp?.employee_id || String(log.employee_id),
          log.date,
          log.check_in ? parseUTC(log.check_in).toLocaleTimeString() : "--:--",
          log.check_out ? parseUTC(log.check_out).toLocaleTimeString() : "--:--",
          String(log.working_hours),
          log.status
        ];
      });
    } else if (reportType === "leaves") {
      headers = ["Leave Type", "Start Date", "End Date", "Reason", "Status"];
      rows = myLeaveHistory.map(req => [
        req.leave_type,
        req.start_date,
        req.end_date,
        req.reason || "N/A",
        req.status
      ]);
    }

    const csvContent = [headers.join(","), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-brand-bg text-brand-text">
        <div className="absolute inset-0 bg-mesh opacity-40 pointer-events-none z-0"></div>
        <div className="relative z-10 text-center animate-pulse">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-t-brand-primary border-r-brand-secondary border-b-brand-success border-l-transparent mx-auto"></div>
          <p className="mt-5 text-brand-muted text-xs font-semibold tracking-wider uppercase">Loading HRMS Workspace...</p>
        </div>
      </div>
    );
  }

  // Visual metrics calculation
  const totalEmpCount = allEmployees.length || 1;
  const presentCount = allAttendance.filter(l => l.date === new Date().toISOString().split("T")[0] && l.status === "present").length;
  const absentCount = allEmployees.length - presentCount;
  const leavesCount = pendingLeaves.filter(l => l.status === "approved").length; // Approved leaves count
  const wfhCount = allAttendance.filter(l => l.date === new Date().toISOString().split("T")[0] && l.wifi_ssid === "Home_WiFi").length;

  return (
    <div className="relative min-h-screen bg-brand-bg text-brand-text flex font-sans overflow-hidden">
      {/* Background ambient glow mesh */}
      <div className="absolute inset-0 bg-mesh opacity-35 pointer-events-none z-0"></div>
      
      {/* Sidebar Layout */}
      <aside className="relative z-10 w-64 border-r border-brand-border bg-brand-sidebar/80 backdrop-blur-xl flex flex-col justify-between select-none">
        <div>
          {/* Workspace Title */}
          <div className="px-6 py-6 border-b border-brand-border flex items-center gap-3">
            <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-gradient-to-tr from-brand-primary to-brand-secondary text-white font-black text-xl shadow-lg shadow-brand-primary/20">
              HR
            </div>
            <div>
              <h1 className="text-md font-bold tracking-tight bg-gradient-to-r from-brand-text to-brand-muted bg-clip-text text-transparent">
                HRMS Portal
              </h1>
              <p className="text-[10px] text-brand-muted/70 font-semibold uppercase tracking-wider">Enterprise Workspace</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            {currentEmployee?.role !== "super_admin" && (
              <button
                onClick={() => setActiveTab("my-portal")}
                className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold rounded-xl transition-all duration-200 border-l-4 ${
                  activeTab === "my-portal"
                    ? "bg-brand-primary/10 border-brand-primary text-brand-primary font-extrabold shadow-sm"
                    : "border-transparent text-brand-muted hover:text-brand-text hover:bg-brand-primary/5 hover:border-brand-primary/30"
                }`}
              >
                <span>👤</span> My Portal
              </button>
            )}

            {currentEmployee && currentEmployee.role !== "employee" && (
              <>
                <div className="pt-4 pb-2 px-4 text-[9px] font-bold uppercase tracking-widest text-brand-muted/50">
                  Management
                </div>
                {currentEmployee.role !== "super_admin" && (
                  <button
                    onClick={() => setActiveTab("overview")}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold rounded-xl transition-all duration-200 border-l-4 ${
                      activeTab === "overview"
                        ? "bg-brand-primary/10 border-brand-primary text-brand-primary font-extrabold shadow-sm"
                        : "border-transparent text-brand-muted hover:text-brand-text hover:bg-brand-primary/5 hover:border-brand-primary/30"
                    }`}
                  >
                    <span>📊</span> Overview Dashboard
                  </button>
                )}
                <button
                  onClick={() => setActiveTab("employees")}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold rounded-xl transition-all duration-200 border-l-4 ${
                    activeTab === "employees"
                      ? "bg-brand-primary/10 border-brand-primary text-brand-primary font-extrabold shadow-sm"
                      : "border-transparent text-brand-muted hover:text-brand-text hover:bg-brand-primary/5 hover:border-brand-primary/30"
                  }`}
                >
                  <span>👥</span> {currentEmployee.role === "super_admin" ? "Admins Directory" : "Employee Directory"}
                </button>
                {currentEmployee.role !== "super_admin" && (
                  <>
                    <button
                      onClick={() => setActiveTab("attendance")}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold rounded-xl transition-all duration-200 border-l-4 ${
                        activeTab === "attendance"
                          ? "bg-brand-primary/10 border-brand-primary text-brand-primary font-extrabold shadow-sm"
                          : "border-transparent text-brand-muted hover:text-brand-text hover:bg-brand-primary/5 hover:border-brand-primary/30"
                      }`}
                    >
                      <span>📅</span> Attendance Logs
                    </button>
                    <button
                      onClick={() => setActiveTab("wfh")}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold rounded-xl transition-all duration-200 border-l-4 ${
                        activeTab === "wfh"
                          ? "bg-brand-primary/10 border-brand-primary text-brand-primary font-extrabold shadow-sm"
                          : "border-transparent text-brand-muted hover:text-brand-text hover:bg-brand-primary/5 hover:border-brand-primary/30"
                      }`}
                    >
                      <span>🏡</span> WFH Sessions
                    </button>
                    <button
                      onClick={() => setActiveTab("leaves")}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold rounded-xl transition-all duration-200 border-l-4 ${
                        activeTab === "leaves"
                          ? "bg-brand-primary/10 border-brand-primary text-brand-primary font-extrabold shadow-sm"
                          : "border-transparent text-brand-muted hover:text-brand-text hover:bg-brand-primary/5 hover:border-brand-primary/30"
                      }`}
                    >
                      <span>📝</span> Leave Requests
                      {pendingLeaves.length > 0 && (
                        <span className="ml-auto bg-brand-warning/20 text-brand-warning border border-brand-warning/30 text-[9px] font-black px-1.5 py-0.5 rounded-md">
                          {pendingLeaves.length}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => setActiveTab("shifts")}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold rounded-xl transition-all duration-200 border-l-4 ${
                        activeTab === "shifts"
                          ? "bg-brand-primary/10 border-brand-primary text-brand-primary font-extrabold shadow-sm"
                          : "border-transparent text-brand-muted hover:text-brand-text hover:bg-brand-primary/5 hover:border-brand-primary/30"
                      }`}
                    >
                      <span>🔄</span> Shift Scheduling
                    </button>
                    <button
                      onClick={() => setActiveTab("payroll")}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold rounded-xl transition-all duration-200 border-l-4 ${
                        activeTab === "payroll"
                          ? "bg-brand-primary/10 border-brand-primary text-brand-primary font-extrabold shadow-sm"
                          : "border-transparent text-brand-muted hover:text-brand-text hover:bg-brand-primary/5 hover:border-brand-primary/30"
                      }`}
                    >
                      <span>💵</span> Payroll calculator
                    </button>
                    <button
                      onClick={() => setActiveTab("reports")}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold rounded-xl transition-all duration-200 border-l-4 ${
                        activeTab === "reports"
                          ? "bg-brand-primary/10 border-brand-primary text-brand-primary font-extrabold shadow-sm"
                          : "border-transparent text-brand-muted hover:text-brand-text hover:bg-brand-primary/5 hover:border-brand-primary/30"
                      }`}
                    >
                      <span>🗂️</span> Reports & Export
                    </button>
                    {["admin", "hr"].includes(currentEmployee?.role || "") && (
                      <button
                        onClick={() => setActiveTab("support")}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold rounded-xl transition-all duration-200 border-l-4 ${
                          activeTab === "support"
                            ? "bg-brand-primary/10 border-brand-primary text-brand-primary font-extrabold shadow-sm"
                            : "border-transparent text-brand-muted hover:text-brand-text hover:bg-brand-primary/5 hover:border-brand-primary/30"
                        }`}
                      >
                        <span>🎫</span> Support Tickets
                        {allTickets.filter(t => t.status === "open").length > 0 && (
                          <span className="ml-auto bg-brand-danger/20 text-brand-danger border border-brand-danger/30 text-[9px] font-black px-1.5 py-0.5 rounded-md animate-pulse">
                            {allTickets.filter(t => t.status === "open").length}
                          </span>
                        )}
                      </button>
                    )}
                  </>
                )}
                {currentEmployee?.role === "super_admin" && (
                  <button
                    onClick={() => setActiveTab("tenants")}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold rounded-xl transition-all duration-200 border-l-4 ${
                      activeTab === "tenants"
                        ? "bg-brand-primary/10 border-brand-primary text-brand-primary font-extrabold shadow-sm"
                        : "border-transparent text-brand-muted hover:text-brand-text hover:bg-brand-primary/5 hover:border-brand-primary/30"
                    }`}
                  >
                    <span>🏢</span> Tenant Management
                  </button>
                )}
                {["admin", "hr"].includes(currentEmployee?.role || "") && (
                  <button
                    onClick={() => setActiveTab("org-settings")}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold rounded-xl transition-all duration-200 border-l-4 ${
                      activeTab === "org-settings"
                        ? "bg-brand-primary/10 border-brand-primary text-brand-primary font-extrabold shadow-sm"
                        : "border-transparent text-brand-muted hover:text-brand-text hover:bg-brand-primary/5 hover:border-brand-primary/30"
                    }`}
                  >
                    <span>⚙️</span> Org Settings
                  </button>
                )}
                {currentEmployee?.role === "admin" && (
                  <button
                    onClick={() => setActiveTab("office-settings")}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold rounded-xl transition-all duration-200 border-l-4 ${
                      activeTab === "office-settings"
                        ? "bg-brand-primary/10 border-brand-primary text-brand-primary font-extrabold shadow-sm"
                        : "border-transparent text-brand-muted hover:text-brand-text hover:bg-brand-primary/5 hover:border-brand-primary/30"
                    }`}
                  >
                    <span>📶</span> Office & Wifi Settings
                  </button>
                )}
              </>
            )}
          </nav>
        </div>

        {/* User Card footer */}
        {currentEmployee && (
          <div className="p-4 border-t border-brand-border bg-brand-sidebar/40">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-brand-primary to-brand-secondary text-white flex items-center justify-center font-bold text-sm shadow-md">
                {currentEmployee.first_name[0]}{currentEmployee.last_name[0]}
              </div>
              <div className="truncate flex-1">
                <p className="text-xs font-bold text-brand-text">{currentEmployee.first_name} {currentEmployee.last_name}</p>
                <p className="text-[10px] text-brand-muted/70 font-semibold uppercase">{currentEmployee.role.replace("_", " ")}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="mt-3 w-full rounded-xl border border-brand-border hover:border-brand-danger/30 hover:bg-brand-danger/5 py-2 text-[10px] font-bold text-brand-muted hover:text-brand-danger transition-all cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        )}
      </aside>

      {/* Main Workspace Panels */}
      <main className="relative z-10 flex-1 flex flex-col min-h-screen overflow-y-auto">
        <header className="sticky top-0 z-40 bg-brand-bg/85 backdrop-blur-md border-b border-brand-border px-8 py-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-brand-text capitalize">
              {activeTab.replace("-", " ")}
            </h2>
            <p className="text-xs text-brand-muted">Welcome to your central workspace dashboard</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-success/10 border border-brand-success/20 text-brand-success font-bold uppercase tracking-wider text-[9px]">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-success/70 animate-ping"></span> Live Database
            </span>
          </div>
        </header>

        <div className="p-8 flex-1 max-w-6xl w-full mx-auto space-y-8">
          
          {/* TAB 1: MY PORTAL */}
          {activeTab === "my-portal" && (
            <div className="space-y-6">
              
              {/* Profile Greeting */}
              <div className="relative overflow-hidden rounded-2xl border border-brand-border bg-gradient-to-br from-brand-primary/10 to-brand-card/40 p-6 shadow-xl hover-glow">
                <div className="absolute top-0 right-0 h-48 w-48 rounded-full bg-brand-primary/5 blur-3xl"></div>
                <h3 className="text-xl font-bold text-brand-text">Welcome back, {currentEmployee?.first_name}!</h3>
                <p className="text-xs text-brand-muted mt-1">Here is your central attendance, leave balance, and schedule summary.</p>
              </div>

              {/* Info Cards Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Profile Card */}
                <div className="rounded-2xl border border-brand-border bg-brand-card p-6 backdrop-blur-md shadow-xl flex flex-col justify-between hover-glow">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-brand-muted mb-4">Profile Information</h4>
                    <div className="space-y-2.5 text-xs">
                      <p className="flex justify-between"><span className="text-brand-muted">Employee ID</span> <span className="font-bold text-brand-text">{currentEmployee?.employee_id}</span></p>
                      <p className="flex justify-between"><span className="text-brand-muted">Email</span> <span className="font-medium text-brand-text truncate max-w-[150px]">{currentEmployee?.email}</span></p>
                      <p className="flex justify-between"><span className="text-brand-muted">Salary Tier</span> <span className="font-bold text-brand-success">₹{currentEmployee?.salary_amount || "0.00"} / yr</span></p>
                      <p className="flex justify-between"><span className="text-brand-muted">Bank Account</span> <span className="font-medium text-brand-text/80">{currentEmployee?.bank_account_no || "Not Setup"}</span></p>
                    </div>
                  </div>
                  <p className="text-[10px] text-brand-muted/70 text-center border-t border-brand-border pt-3 mt-4 font-medium tracking-wide">
                    For profile updates, contact your HR rep.
                  </p>
                </div>

                {/* Leave Balances Card */}
                <div className="rounded-2xl border border-brand-border bg-brand-card p-6 backdrop-blur-md shadow-xl flex flex-col justify-between hover-glow">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-brand-muted mb-4">Leave Balances</h4>
                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div className="bg-brand-sidebar/40 border border-brand-border rounded-xl p-2.5">
                        <p className="text-lg font-black text-brand-primary">{myLeaveBalances.casual ?? 0}</p>
                        <p className="text-[9px] uppercase tracking-wider text-brand-muted/70 font-bold">Casual</p>
                      </div>
                      <div className="bg-brand-sidebar/40 border border-brand-border rounded-xl p-2.5">
                        <p className="text-lg font-black text-brand-secondary">{myLeaveBalances.sick ?? 0}</p>
                        <p className="text-[9px] uppercase tracking-wider text-brand-muted/70 font-bold">Sick</p>
                      </div>
                      <div className="bg-brand-sidebar/40 border border-brand-border rounded-xl p-2.5">
                        <p className="text-lg font-black text-brand-success">{myLeaveBalances.wfh ?? 0}</p>
                        <p className="text-[9px] uppercase tracking-wider text-brand-muted/70 font-bold">WFH Days</p>
                      </div>
                      <div className="bg-brand-sidebar/40 border border-brand-border rounded-xl p-2.5">
                        <p className="text-lg font-black text-purple-400">{myLeaveBalances.earned ?? 0}</p>
                        <p className="text-[9px] uppercase tracking-wider text-brand-muted/70 font-bold">Earned</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>


              {/* Form & Table Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Apply Leave Form */}
                <div className="lg:col-span-1 rounded-2xl border border-brand-border bg-brand-card p-6 backdrop-blur-md shadow-xl hover-glow">
                  <h4 className="text-md font-bold text-brand-text mb-4">Apply for Leave</h4>
                  {applyLeaveMessage.text && (
                    <div className={`mb-4 p-3 rounded-xl text-xs font-semibold text-center border ${
                      applyLeaveMessage.type === "success" 
                        ? "bg-brand-success/10 border-brand-success/20 text-brand-success" 
                        : "bg-brand-danger/10 border-brand-danger/20 text-brand-danger"
                    }`}>
                      {applyLeaveMessage.text}
                    </div>
                  )}
                  <form onSubmit={handleApplyLeave} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-muted mb-1.5">Leave Type</label>
                      <select
                        value={applyLeaveForm.leave_type}
                        onChange={(e) => setApplyLeaveForm(prev => ({ ...prev, leave_type: e.target.value }))}
                        className="w-full text-xs rounded-xl border border-brand-border bg-brand-sidebar/55 px-3 py-2.5 text-brand-text outline-none focus:border-brand-primary/60"
                      >
                        <option value="casual">Casual Leave</option>
                        <option value="sick">Sick Leave</option>
                        <option value="wfh">Work From Home (WFH)</option>
                        <option value="earned">Earned Leave</option>
                        <option value="half_day">Half Day Leave</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-muted mb-1.5">Start Date</label>
                        <input
                          type="date"
                          required
                          value={applyLeaveForm.start_date}
                          onChange={(e) => setApplyLeaveForm(prev => ({ ...prev, start_date: e.target.value }))}
                          className="w-full text-xs rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-muted mb-1.5">End Date</label>
                        <input
                          type="date"
                          required
                          value={applyLeaveForm.end_date}
                          onChange={(e) => setApplyLeaveForm(prev => ({ ...prev, end_date: e.target.value }))}
                          className="w-full text-xs rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-muted mb-1.5">Reason</label>
                      <textarea
                        rows={3}
                        placeholder="State reason here..."
                        value={applyLeaveForm.reason}
                        onChange={(e) => setApplyLeaveForm(prev => ({ ...prev, reason: e.target.value }))}
                        className="w-full text-xs rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={applyLeaveLoading}
                      className="w-full rounded-xl bg-gradient-to-r from-brand-primary to-brand-primary/80 py-3.5 text-xs font-bold text-white shadow-lg shadow-brand-primary/20 hover:shadow-brand-primary/30 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                    >
                      {applyLeaveLoading ? "Submitting..." : "Apply Leave"}
                    </button>
                  </form>
                </div>

                {/* Personal Leave History */}
                <div className="lg:col-span-2 rounded-2xl border border-brand-border bg-brand-card p-6 backdrop-blur-md shadow-xl flex flex-col justify-between hover-glow">
                  <div>
                    <h4 className="text-md font-bold text-brand-text mb-4">My Leave History</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-brand-sidebar/70 text-[10px] uppercase font-bold text-brand-muted border-b border-brand-border">
                          <tr>
                            <th className="px-4 py-3.5">Leave Type</th>
                            <th className="px-4 py-3.5">Start Date</th>
                            <th className="px-4 py-3.5">End Date</th>
                            <th className="px-4 py-3.5">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-brand-border">
                          {myLeaveHistory.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="px-4 py-6 text-center text-brand-muted/70 text-xs">
                                No leave requests recorded.
                              </td>
                            </tr>
                          ) : (
                            myLeaveHistory.map((req) => (
                              <tr key={req.id} className="hover:bg-brand-primary/[0.02] transition-colors">
                                <td className="px-4 py-3 font-semibold uppercase text-brand-text">{req.leave_type}</td>
                                <td className="px-4 py-3 text-brand-muted">{req.start_date}</td>
                                <td className="px-4 py-3 text-brand-muted">{req.end_date}</td>
                                <td className="px-4 py-3">
                                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                                    req.status === "approved"
                                      ? "bg-brand-success/10 text-brand-success border-brand-success/20"
                                      : req.status === "rejected"
                                      ? "bg-brand-danger/10 text-brand-danger border-brand-danger/20"
                                      : "bg-brand-warning/10 text-brand-warning border-brand-warning/20"
                                  }`}>
                                    {req.status}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* TAB 2: OVERVIEW DASHBOARD */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              
              {/* Metrics Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="rounded-2xl border border-brand-border bg-brand-card p-4 text-center hover-glow">
                  <p className="text-3xl font-black text-brand-primary">{allEmployees.length}</p>
                  <p className="text-[10px] uppercase font-bold text-brand-muted mt-1">Total Employees</p>
                </div>
                <div className="rounded-2xl border border-brand-border bg-brand-card p-4 text-center hover-glow">
                  <p className="text-3xl font-black text-brand-success">{presentCount}</p>
                  <p className="text-[10px] uppercase font-bold text-brand-muted mt-1">Present Today</p>
                </div>
                <div className="rounded-2xl border border-brand-border bg-brand-card p-4 text-center hover-glow">
                  <p className="text-3xl font-black text-brand-danger">{absentCount}</p>
                  <p className="text-[10px] uppercase font-bold text-brand-muted mt-1">Absent Today</p>
                </div>
                <div className="rounded-2xl border border-brand-border bg-brand-card p-4 text-center hover-glow">
                  <p className="text-3xl font-black text-brand-warning">{leavesCount}</p>
                  <p className="text-[10px] uppercase font-bold text-brand-muted mt-1">On Approved Leave</p>
                </div>
                <div className="rounded-2xl border border-brand-border bg-brand-card p-4 text-center hover-glow">
                  <p className="text-3xl font-black text-brand-secondary">{wfhCount}</p>
                  <p className="text-[10px] uppercase font-bold text-brand-muted mt-1">Working WFH</p>
                </div>
              </div>

              {/* Attendance & Reminders Section */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Attendance rate chart mock */}
                <div className="lg:col-span-2 rounded-2xl border border-brand-border bg-brand-card p-6 shadow-xl hover-glow">
                  <h4 className="text-md font-bold text-brand-text mb-4">Daily Attendance Overview</h4>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-xs text-brand-muted mb-1.5">
                        <span>Attendance rate</span>
                        <span className="font-bold text-brand-primary">{Math.round((presentCount / totalEmpCount) * 100)}%</span>
                      </div>
                      <div className="h-3 w-full bg-brand-sidebar/65 rounded-full overflow-hidden border border-brand-border">
                        <div 
                          className="h-full bg-gradient-to-r from-brand-primary to-brand-secondary rounded-full" 
                          style={{ width: `${(presentCount / totalEmpCount) * 100}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-brand-border text-xs text-brand-muted">
                      <div>
                        <span className="font-bold text-brand-text/90">Late Arrivals:</span>
                        <span className="ml-2 text-brand-danger font-black">0</span>
                      </div>
                      <div>
                        <span className="font-bold text-brand-text/90">Early Departures:</span>
                        <span className="ml-2 text-brand-warning font-black">0</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Birthday & Anniversary Reminders */}
                <div className="rounded-2xl border border-brand-border bg-brand-card p-6 shadow-xl flex flex-col justify-between hover-glow">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-brand-muted mb-4">Birthdays & Anniversaries</h4>
                    <div className="space-y-3 text-xs text-brand-text">
                      <div className="flex items-center gap-3 p-2.5 rounded-xl bg-brand-sidebar/45 border border-brand-border">
                        <span className="text-lg">🎂</span>
                        <div>
                          <p className="font-semibold text-brand-text/90">No birthdays today</p>
                          <p className="text-[10px] text-brand-muted">Next: Jane Doe (July 12)</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-2.5 rounded-xl bg-brand-sidebar/45 border border-brand-border">
                        <span className="text-lg">🎉</span>
                        <div>
                          <p className="font-semibold text-brand-text/90">No work anniversaries</p>
                          <p className="text-[10px] text-brand-muted">Next: EMP-002 (3 Years, Aug 1)</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* TAB 3: EMPLOYEE DIRECTORY */}
          {activeTab === "employees" && (
            <div className="space-y-6">
              
              {/* Directory Filter / Add row */}
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-brand-sidebar/45 p-4 border border-brand-border rounded-2xl">
                <p className="text-xs text-brand-muted font-medium">
                  {currentEmployee?.role === "super_admin" 
                    ? "Manage and view all registered company administrators" 
                    : "Manage and view all registered employee records"}
                </p>
                <button
                  onClick={() => {
                    setEmployeeForm(p => ({ ...p, role: currentEmployee?.role === "super_admin" ? "admin" : "employee" }));
                    setShowAddEmployeeModal(true);
                  }}
                  className="rounded-xl bg-gradient-to-r from-brand-success to-brand-success/80 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-brand-success/20 hover:shadow-brand-success/30 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                >
                  {currentEmployee?.role === "super_admin" ? "➕ Add New Admin" : "➕ Add New Employee"}
                </button>
              </div>

              {/* Employees List */}
              <div className="rounded-2xl border border-brand-border bg-brand-card p-6 shadow-xl hover-glow">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-brand-sidebar/70 text-[10px] uppercase font-bold text-brand-muted border-b border-brand-border">
                      <tr>
                        <th className="px-4 py-3.5">Employee ID</th>
                        <th className="px-4 py-3.5">Full Name</th>
                        <th className="px-4 py-3.5">Email Address</th>
                        <th className="px-4 py-3.5">Designation / Role</th>
                        <th className="px-4 py-3.5">Status</th>
                        <th className="px-4 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-border">
                      {allEmployees.filter((emp) => currentEmployee?.role !== "super_admin" || emp.role === "admin").length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-brand-muted/70 text-xs">
                            {currentEmployee?.role === "super_admin" 
                              ? "No company administrators registered yet." 
                              : "No employee directories created."}
                          </td>
                        </tr>
                      ) : (
                        allEmployees
                          .filter((emp) => currentEmployee?.role !== "super_admin" || emp.role === "admin")
                          .map((emp) => (
                          <tr key={emp.id} className="hover:bg-brand-primary/[0.02] transition-colors">
                            <td className="px-4 py-3 font-semibold text-brand-text/90">{emp.employee_id}</td>
                            <td className="px-4 py-3 font-bold text-brand-text">{emp.first_name} {emp.last_name}</td>
                            <td className="px-4 py-3 text-brand-muted">{emp.email}</td>
                            <td className="px-4 py-3 capitalize text-brand-primary font-semibold">{emp.role.replace("_", " ")}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                                  emp.is_active
                                    ? "bg-brand-success/10 text-brand-success border-brand-success/20"
                                    : "bg-brand-sidebar/60 text-brand-muted/60 border-brand-border"
                              }`}>
                                {emp.is_active ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => {
                                  setSelectedEmployee(emp);
                                  setShowEditEmployeeModal(true);
                                }}
                                className="rounded-xl border border-brand-border hover:border-brand-primary/45 px-3 py-1.5 text-[10px] font-bold text-brand-text hover:text-brand-primary hover:bg-brand-primary/5 transition-all cursor-pointer"
                              >
                                Edit Profile
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* TAB 4: ATTENDANCE LOGS */}
          {activeTab === "attendance" && (
            <div className="space-y-6">
              
              {/* Correct logs / Filter row */}
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-brand-sidebar/45 p-4 border border-brand-border rounded-2xl">
                <p className="text-xs text-brand-muted font-medium">Verify employee logins, location coordinates, SSID network and GPS details</p>
                <button
                  onClick={() => setShowCorrectionModal(true)}
                  className="rounded-xl bg-gradient-to-r from-brand-primary to-brand-secondary px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-brand-primary/20 hover:shadow-brand-primary/30 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                >
                  📝 Manual Correction Adjust
                </button>
              </div>

              {/* Attendance Log Table */}
              <div className="rounded-2xl border border-brand-border bg-brand-card p-6 shadow-xl hover-glow">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-brand-sidebar/70 text-[10px] uppercase font-bold text-brand-muted border-b border-brand-border">
                      <tr>
                        <th className="px-4 py-3.5">Employee</th>
                        <th className="px-4 py-3.5">Date</th>
                        <th className="px-4 py-3.5">Check In</th>
                        <th className="px-4 py-3.5">Check Out</th>
                        <th className="px-4 py-3.5">WiFi / Device info</th>
                        <th className="px-4 py-3.5">GPS</th>
                        <th className="px-4 py-3.5">Hours</th>
                        <th className="px-4 py-3.5 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-border">
                      {allAttendance.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center text-brand-muted/70 text-xs">
                            No attendance punches recorded yet.
                          </td>
                        </tr>
                      ) : (
                        allAttendance.map((log) => {
                          const emp = allEmployees.find(e => e.id === log.employee_id);
                          return (
                            <tr key={log.id} className="hover:bg-brand-primary/[0.02] transition-colors">
                              <td className="px-4 py-3 font-semibold text-brand-text/90">
                                {emp ? `${emp.first_name} ${emp.last_name}` : `User ID: ${log.employee_id}`}
                              </td>
                              <td className="px-4 py-3 text-brand-muted">{log.date}</td>
                              <td className="px-4 py-3 text-brand-text font-medium">
                                {log.check_in ? parseUTC(log.check_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--:--"}
                              </td>
                              <td className="px-4 py-3 text-brand-text font-medium">
                                {log.check_out ? parseUTC(log.check_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--:--"}
                              </td>
                              <td className="px-4 py-3 text-[10px] text-brand-muted/70 truncate max-w-[150px]">
                                {log.wifi_ssid || "Direct login"} | {log.device_info || "Web"}
                              </td>
                              <td className="px-4 py-3 text-[10px] text-brand-secondary font-mono">
                                {log.check_in_gps || "N/A"}
                              </td>
                              <td className="px-4 py-3 text-brand-text font-bold">{log.working_hours}</td>
                              <td className="px-4 py-3 text-right">
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                                  log.status === "present"
                                    ? "bg-brand-success/10 text-brand-success border-brand-success/20"
                                    : log.status === "late"
                                    ? "bg-brand-warning/10 text-brand-warning border-brand-warning/20"
                                    : "bg-brand-danger/10 text-brand-danger border-brand-danger/20"
                                }`}>
                                  {log.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* TAB: WORK FROM HOME (WFH) SESSIONS */}
          {activeTab === "wfh" && (
            <div className="space-y-6">
              
              {/* Header Info */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-brand-sidebar/45 p-5 border border-brand-border rounded-2xl">
                <div>
                  <h3 className="text-lg font-bold text-brand-text flex items-center gap-2">🏡 WFH Sessions & Daily Summaries</h3>
                  <p className="text-xs text-brand-muted mt-1">Track remote working hours, GPS locations, daily summaries, and task lists submitted by employees.</p>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="rounded-2xl border border-brand-border bg-brand-card p-6 shadow-xl hover-glow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-brand-muted tracking-wider">Active WFH Today</p>
                      <h3 className="text-3xl font-black text-brand-success mt-2">
                        {allAttendance.filter(l => l.status === "wfh" && !l.check_out && l.date === new Date().toISOString().split("T")[0]).length}
                      </h3>
                    </div>
                    <span className="text-3xl">🟢</span>
                  </div>
                </div>

                <div className="rounded-2xl border border-brand-border bg-brand-card p-6 shadow-xl hover-glow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-brand-muted tracking-wider">Total WFH Sessions</p>
                      <h3 className="text-3xl font-black text-brand-primary mt-2">
                        {allAttendance.filter(l => l.status === "wfh").length}
                      </h3>
                    </div>
                    <span className="text-3xl">🏡</span>
                  </div>
                </div>

                <div className="rounded-2xl border border-brand-border bg-brand-card p-6 shadow-xl hover-glow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-brand-muted tracking-wider">Total WFH Hours logged</p>
                      <h3 className="text-3xl font-black text-brand-secondary mt-2">
                        {allAttendance.filter(l => l.status === "wfh").reduce((sum, log) => sum + (log.working_hours || 0), 0).toFixed(1)} hrs
                      </h3>
                    </div>
                    <span className="text-3xl">⏱️</span>
                  </div>
                </div>
              </div>

              {/* WFH Session Details List */}
              <div className="space-y-6">
                {allAttendance.filter(l => l.status === "wfh").length === 0 ? (
                  <div className="rounded-2xl border border-brand-border bg-brand-card p-12 text-center text-brand-muted shadow-xl">
                    <p className="text-sm">No Work From Home sessions found.</p>
                  </div>
                ) : (
                  allAttendance.filter(l => l.status === "wfh").map((log) => {
                    const emp = allEmployees.find(e => e.id === log.employee_id);
                    
                    // Parse task updates
                    let tasks: { title: string; completed: boolean }[] = [];
                    if (log.task_updates) {
                      try {
                        const parsed = JSON.parse(log.task_updates);
                        if (Array.isArray(parsed)) {
                          tasks = parsed;
                        }
                      } catch (e) {
                        // fallback or handle plain string
                      }
                    }

                    return (
                      <div key={log.id} className="rounded-2xl border border-brand-border bg-brand-card p-6 shadow-xl hover-glow space-y-4">
                        {/* Header Details */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-brand-border">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-brand-primary/10 flex items-center justify-center text-sm font-bold text-brand-primary">
                              {emp ? `${emp.first_name[0]}${emp.last_name[0]}` : "U"}
                            </div>
                            <div>
                              <h4 className="font-bold text-brand-text">
                                {emp ? `${emp.first_name} ${emp.last_name}` : `Employee ID: ${log.employee_id}`}
                              </h4>
                              <p className="text-[10px] text-brand-muted uppercase font-bold tracking-wider">{emp?.employee_id || "N/A"}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 self-stretch sm:self-auto justify-between sm:justify-start">
                            <span className="text-xs text-brand-muted font-medium">📅 {log.date}</span>
                            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                              !log.check_out
                                ? "bg-brand-success/10 text-brand-success border-brand-success/20 animate-pulse"
                                : "bg-brand-muted/10 text-brand-muted border-brand-border"
                            }`}>
                              {!log.check_out ? "Active Session" : "Completed"}
                            </span>
                          </div>
                        </div>

                        {/* Session Details grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                          <div>
                            <p className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">Check In</p>
                            <p className="mt-1 font-semibold text-brand-text">
                              {log.check_in ? parseUTC(log.check_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--:--"}
                            </p>
                            <p className="text-[9px] text-brand-muted mt-0.5 truncate max-w-[200px]" title={log.wifi_ssid || "Home WiFi"}>
                              📶 {log.wifi_ssid || "Home WiFi"}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">Check Out</p>
                            <p className="mt-1 font-semibold text-brand-text">
                              {log.check_out ? parseUTC(log.check_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--:--"}
                            </p>
                            <p className="text-[9px] text-brand-muted mt-0.5 truncate max-w-[200px]" title={log.device_info || "Mobile Device"}>
                              📱 {log.device_info || "Mobile"}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">Hours Worked</p>
                            <p className="mt-1 font-bold text-brand-secondary">
                              {log.working_hours ? `${log.working_hours.toFixed(1)} hours` : "--"}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">Location / GPS</p>
                            <div className="mt-1 font-mono text-[10px] text-brand-text flex flex-col gap-0.5">
                              {log.check_in_gps && (
                                <a
                                  href={`https://www.google.com/maps/search/?api=1&query=${log.check_in_gps}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-brand-primary hover:underline"
                                >
                                  📍 Check In Location
                                </a>
                              )}
                              {log.check_out_gps && (
                                <a
                                  href={`https://www.google.com/maps/search/?api=1&query=${log.check_out_gps}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-brand-primary hover:underline"
                                >
                                  📍 Check Out Location
                                </a>
                              )}
                              {!log.check_in_gps && !log.check_out_gps && (
                                <span className="text-brand-muted">GPS N/A</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Daily summary / Task updates block */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-brand-border text-xs">
                          {/* Left Column: Daily Work Summary */}
                          <div className="space-y-2">
                            <h5 className="font-bold text-brand-text flex items-center gap-1.5">
                              <span>📝</span> Daily Work Summary
                            </h5>
                            <div className="rounded-xl border border-brand-border bg-brand-sidebar/30 p-4 min-h-[80px]">
                              {log.daily_summary ? (
                                <p className="text-brand-text leading-relaxed italic">"{log.daily_summary}"</p>
                              ) : !log.check_out ? (
                                <p className="text-brand-muted italic">Session in progress. Daily summary will be submitted at check-out.</p>
                              ) : (
                                <p className="text-brand-muted italic">No daily summary submitted.</p>
                              )}
                            </div>
                          </div>

                          {/* Right Column: Task Updates */}
                          <div className="space-y-2">
                            <h5 className="font-bold text-brand-text flex items-center gap-1.5">
                              <span>✅</span> Task Checklist ({tasks.filter(t => t.completed).length} / {tasks.length} Completed)
                            </h5>
                            <div className="rounded-xl border border-brand-border bg-brand-sidebar/30 p-4 min-h-[80px] max-h-[160px] overflow-y-auto space-y-2">
                              {tasks.length === 0 ? (
                                <p className="text-brand-muted italic">No tasks logged for this session.</p>
                              ) : (
                                tasks.map((task, idx) => (
                                  <div key={idx} className="flex items-center gap-2">
                                    <span className={task.completed ? "text-brand-success text-sm" : "text-brand-muted text-sm"}>
                                      {task.completed ? "☑" : "☐"}
                                    </span>
                                    <span className={task.completed ? "text-brand-text/50 line-through font-medium" : "text-brand-text font-semibold"}>
                                      {task.title}
                                    </span>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>

                      </div>
                    );
                  })
                )}
              </div>

            </div>
          )}

          {/* TAB 5: LEAVE APPROVALS */}
          {activeTab === "leaves" && (
            <div className="space-y-6">
              
              {/* Approvals Grid */}
              <div className="rounded-2xl border border-brand-border bg-brand-card p-6 shadow-xl hover-glow">
                <h4 className="text-md font-bold text-brand-text mb-4">Pending Leave Applications</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-brand-sidebar/70 text-[10px] uppercase font-bold text-brand-muted border-b border-brand-border">
                      <tr>
                        <th className="px-4 py-3.5">Employee</th>
                        <th className="px-4 py-3.5">Leave Type</th>
                        <th className="px-4 py-3.5">Remaining Balances</th>
                        <th className="px-4 py-3.5">Dates</th>
                        <th className="px-4 py-3.5">Reason</th>
                        <th className="px-4 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-border">
                      {pendingLeaves.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-brand-muted/70 text-xs">
                            No pending leave applications.
                          </td>
                        </tr>
                      ) : (
                        pendingLeaves.map((req) => {
                          const emp = allEmployees.find(e => e.id === req.employee_id);
                          return (
                            <tr key={req.id} className="hover:bg-brand-primary/[0.02] transition-colors">
                              <td className="px-4 py-3 font-semibold text-brand-text">
                                {emp ? `${emp.first_name} ${emp.last_name}` : `User ID: ${req.employee_id}`}
                              </td>
                              <td className="px-4 py-3 font-semibold uppercase text-brand-primary">{req.leave_type}</td>
                              <td className="px-4 py-3 text-brand-muted">
                                {(req as any).employee_balances ? (
                                  <div className="flex flex-wrap gap-2 text-[9px]">
                                    <span className="bg-brand-sidebar border border-brand-border px-1.5 py-0.5 rounded text-brand-primary font-bold">Casual: {(req as any).employee_balances.casual ?? 0}</span>
                                    <span className="bg-brand-sidebar border border-brand-border px-1.5 py-0.5 rounded text-brand-secondary font-bold">Sick: {(req as any).employee_balances.sick ?? 0}</span>
                                    <span className="bg-brand-sidebar border border-brand-border px-1.5 py-0.5 rounded text-purple-400 font-bold">Earned: {(req as any).employee_balances.earned ?? 0}</span>
                                  </div>
                                ) : (
                                  <span className="text-brand-muted/50">Unavailable</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-brand-muted whitespace-nowrap">{req.start_date} to {req.end_date}</td>
                              <td className="px-4 py-3 text-brand-muted whitespace-pre-wrap max-w-xs break-words">{req.reason || "No Reason"}</td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex justify-end items-center gap-2 whitespace-nowrap">
                                  <button
                                    onClick={() => handleLeaveApproval(req.id, "approved")}
                                    className="rounded-xl bg-brand-success hover:bg-brand-success/90 px-3.5 py-1.5 text-[10px] font-bold text-white shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => handleLeaveApproval(req.id, "rejected")}
                                    className="rounded-xl bg-brand-danger hover:bg-brand-danger/90 px-3.5 py-1.5 text-[10px] font-bold text-white shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                                  >
                                    Reject
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* TAB 6: SHIFT SCHEDULING */}
          {activeTab === "shifts" && (
            <div className="space-y-6">
              
              {/* Actions row */}
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-brand-sidebar/45 p-4 border border-brand-border rounded-2xl">
                <p className="text-xs text-brand-muted font-medium">Assign rotational shifts, night rosters, and fixed hours weekly schedules</p>
                <button
                  onClick={() => setShowAssignShiftModal(true)}
                  className="rounded-xl bg-gradient-to-r from-brand-success to-brand-success/80 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-brand-success/20 hover:shadow-brand-success/30 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                >
                  🔄 Assign Shift Roster
                </button>
              </div>

              {/* Roster list */}
              <div className="rounded-2xl border border-brand-border bg-brand-card p-6 shadow-xl hover-glow">
                <h4 className="text-md font-bold text-brand-text mb-4">Shift Rosters Directory</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-brand-sidebar/70 text-[10px] uppercase font-bold text-brand-muted border-b border-brand-border">
                      <tr>
                        <th className="px-4 py-3.5">Employee Name</th>
                        <th className="px-4 py-3.5">Shift Type</th>
                        <th className="px-4 py-3.5">Schedule / Timings</th>
                        <th className="px-4 py-3.5 text-right">Roster Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-border">
                      {shiftAssignments.map((shift) => (
                        <tr key={shift.employeeId} className="hover:bg-brand-primary/[0.02] transition-colors">
                          <td className="px-4 py-3 font-semibold text-brand-text/90">{shift.employeeName}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                              shift.shiftType === "fixed_day"
                                ? "bg-brand-primary/10 text-brand-primary border-brand-primary/20"
                                : shift.shiftType === "night"
                                ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                                : "bg-brand-secondary/10 text-brand-secondary border-brand-secondary/20"
                            }`}>
                              {shift.shiftType.replace("_", " ")}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-brand-muted">{shift.schedule}</td>
                          <td className="px-4 py-3 text-right text-brand-success font-bold">Assigned</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* TAB 7: PAYROLL CALCULATOR */}
          {activeTab === "payroll" && (
            <div className="space-y-6">
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Employee Salaries selection */}
                <div className="lg:col-span-1 rounded-2xl border border-brand-border bg-brand-card p-6 shadow-xl hover-glow">
                  <h4 className="text-md font-bold text-brand-text mb-4">Select Employee</h4>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                    {allEmployees.map((emp) => (
                      <button
                        key={emp.id}
                        onClick={() => handleCalculatePayroll(emp)}
                        className={`w-full text-left p-3 rounded-xl border text-xs font-semibold transition-all duration-200 ${
                          selectedPayrollEmployee?.id === emp.id
                            ? "bg-brand-primary/15 border-brand-primary text-brand-primary font-bold shadow-sm"
                            : "bg-brand-sidebar/45 border-brand-border text-brand-muted hover:text-brand-text hover:bg-brand-sidebar/70"
                        }`}
                      >
                        <p className="font-bold">{emp.first_name} {emp.last_name}</p>
                        <p className="text-[10px] text-brand-muted/70 uppercase mt-0.5">{emp.employee_id} | {emp.role}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Calculation breakdown & History */}
                {selectedPayrollEmployee ? (
                  <div className="lg:col-span-2 space-y-6">
                    {/* Error / Success alert */}
                    {payrollError && (
                      <div className="p-4 bg-brand-danger/10 border border-brand-danger/20 text-brand-danger text-xs rounded-xl font-bold">
                        {payrollError}
                      </div>
                    )}
                    {payrollSuccess && (
                      <div className="p-4 bg-brand-success/10 border border-brand-success/20 text-brand-success text-xs rounded-xl font-bold">
                        {payrollSuccess}
                      </div>
                    )}

                    {/* Issue Payslip Form */}
                    <div className="rounded-2xl border border-brand-border bg-brand-card p-6 shadow-xl hover-glow">
                      <h4 className="text-md font-bold text-brand-text mb-4">Issue New Payslip for {selectedPayrollEmployee.first_name} {selectedPayrollEmployee.last_name}</h4>
                      <form onSubmit={handleIssueSalarySlip} className="space-y-4 text-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1.5">Month</label>
                            <input
                              type="text"
                              required
                              value={slipForm.month}
                              onChange={(e) => setSlipForm(p => ({ ...p, month: e.target.value }))}
                              placeholder="June 2026"
                              className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1.5">Payout Date</label>
                            <input
                              type="date"
                              required
                              value={slipForm.payout_date}
                              onChange={(e) => setSlipForm(p => ({ ...p, payout_date: e.target.value }))}
                              className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1.5">Payment Status</label>
                            <select
                              value={slipForm.status}
                              onChange={(e) => setSlipForm(p => ({ ...p, status: e.target.value }))}
                              className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60"
                            >
                              <option value="paid">Paid</option>
                              <option value="processing">Processing</option>
                              <option value="pending">Pending</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1.5">Base Salary</label>
                            <input
                              type="number"
                              required
                              step="0.01"
                              value={slipForm.base_salary}
                              onChange={(e) => setSlipForm(p => ({ ...p, base_salary: e.target.value }))}
                              className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1.5">Bonus</label>
                            <input
                              type="number"
                              step="0.01"
                              value={slipForm.bonus}
                              onChange={(e) => setSlipForm(p => ({ ...p, bonus: e.target.value }))}
                              className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1.5">Income Tax</label>
                            <input
                              type="number"
                              step="0.01"
                              value={slipForm.federal_tax}
                              onChange={(e) => setSlipForm(p => ({ ...p, federal_tax: e.target.value }))}
                              className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1.5">Health Ins.</label>
                            <input
                              type="number"
                              step="0.01"
                              value={slipForm.health_insurance}
                              onChange={(e) => setSlipForm(p => ({ ...p, health_insurance: e.target.value }))}
                              className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1.5">Retirement / PF</label>
                            <input
                              type="number"
                              step="0.01"
                              value={slipForm.retirement_contribution}
                              onChange={(e) => setSlipForm(p => ({ ...p, retirement_contribution: e.target.value }))}
                              className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60"
                            />
                          </div>
                        </div>

                        <div className="pt-2 flex justify-between items-center">
                          <div className="text-xs text-brand-muted">
                            Net calculated payout: <span className="font-bold text-brand-success">₹{(
                              (parseFloat(slipForm.base_salary) || 0) +
                              (parseFloat(slipForm.bonus) || 0) -
                              (parseFloat(slipForm.federal_tax) || 0) -
                              (parseFloat(slipForm.health_insurance) || 0) -
                              (parseFloat(slipForm.retirement_contribution) || 0)
                            ).toFixed(2)}</span>
                          </div>
                          <button
                            type="submit"
                            disabled={payrollLoading}
                            className="rounded-xl bg-gradient-to-r from-brand-primary to-brand-secondary px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-brand-primary/20 hover:shadow-brand-primary/30 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                          >
                            {payrollLoading ? "Issuing..." : "✉️ Issue & Dispatch Payslip"}
                          </button>
                        </div>
                      </form>
                    </div>

                    {/* Payslip History List */}
                    <div className="rounded-2xl border border-brand-border bg-brand-card p-6 shadow-xl hover-glow">
                      <h4 className="text-md font-bold text-brand-text mb-4">Payment History ({selectedPayrollEmployee.first_name})</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-brand-sidebar/70 text-[10px] uppercase font-bold text-brand-muted border-b border-brand-border">
                            <tr>
                              <th className="px-4 py-3.5">Month</th>
                              <th className="px-4 py-3.5">Payout Date</th>
                              <th className="px-4 py-3.5">Gross Salary</th>
                              <th className="px-4 py-3.5">Deductions</th>
                              <th className="px-4 py-3.5">Net Payout</th>
                              <th className="px-4 py-3.5">Status</th>
                              <th className="px-4 py-3.5 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-brand-border">
                            {selectedEmployeeSlips.length === 0 ? (
                              <tr>
                                <td colSpan={7} className="px-4 py-8 text-center text-brand-muted/70 text-xs">
                                  No payslips issued yet for this employee.
                                </td>
                              </tr>
                            ) : (
                              selectedEmployeeSlips.map((slip) => (
                                <tr key={slip.id} className="hover:bg-brand-primary/[0.02] transition-colors">
                                  <td className="px-4 py-3 font-semibold text-brand-text/90">{slip.month}</td>
                                  <td className="px-4 py-3 text-brand-muted">{slip.payout_date}</td>
                                  <td className="px-4 py-3 text-brand-muted">₹{slip.gross_salary.toFixed(2)}</td>
                                  <td className="px-4 py-3 text-brand-danger">-₹{slip.total_deductions.toFixed(2)}</td>
                                  <td className="px-4 py-3 font-bold text-brand-success">₹{slip.net_payout.toFixed(2)}</td>
                                  <td className="px-4 py-3">
                                    <select
                                      value={slip.status}
                                      onChange={(e) => handleUpdateSlipStatus(slip.id, e.target.value)}
                                      className="rounded bg-brand-sidebar text-[10px] font-bold border border-brand-border px-1 py-0.5 text-brand-text outline-none focus:border-brand-primary/60 cursor-pointer"
                                    >
                                      <option value="paid">Paid</option>
                                      <option value="processing">Processing</option>
                                      <option value="pending">Pending</option>
                                    </select>
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <button
                                      onClick={() => handleDeleteSlip(slip.id)}
                                      className="rounded-xl bg-brand-danger/20 hover:bg-brand-danger/30 px-3 py-1.5 text-[10px] font-bold text-brand-danger transition-all cursor-pointer"
                                    >
                                      Delete
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="lg:col-span-2 rounded-2xl border border-brand-border bg-brand-card p-6 shadow-xl flex flex-col justify-center items-center py-20 text-center hover-glow">
                    <span className="text-4xl mb-4">💵</span>
                    <h4 className="text-md font-bold text-brand-text mb-2">No Employee Selected</h4>
                    <p className="text-xs text-brand-muted/75 max-w-sm">Select an employee from the list on the left to manage their salary slips, calculate payouts, and view payment history.</p>
                  </div>
                )}

              </div>

            </div>
          )}

          {/* TAB 8: REPORTS & EXPORT */}
          {activeTab === "reports" && (
            <div className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                <div className="rounded-2xl border border-brand-border bg-brand-card p-6 text-center flex flex-col justify-between hover-glow">
                  <div>
                    <span className="text-2xl">👥</span>
                    <h4 className="text-md font-bold text-brand-text mt-3 mb-2">Employees Directory</h4>
                    <p className="text-xs text-brand-muted">Download registration profiles, contact tiers, bank details and roles.</p>
                  </div>
                  <button
                    onClick={() => handleExportCSV("employees")}
                    className="mt-6 rounded-xl bg-brand-sidebar border border-brand-border hover:border-brand-primary/45 py-2.5 text-xs font-bold text-brand-text hover:text-brand-primary hover:bg-brand-primary/5 transition-all cursor-pointer"
                  >
                    📥 Export CSV
                  </button>
                </div>

                <div className="rounded-2xl border border-brand-border bg-brand-card p-6 text-center flex flex-col justify-between hover-glow">
                  <div>
                    <span className="text-2xl">📆</span>
                    <h4 className="text-md font-bold text-brand-text mt-3 mb-2">Attendance Summary</h4>
                    <p className="text-xs text-brand-muted">Download complete timing logs, GPS locations and SSID metrics logs.</p>
                  </div>
                  <button
                    onClick={() => handleExportCSV("attendance")}
                    className="mt-6 rounded-xl bg-brand-sidebar border border-brand-border hover:border-brand-primary/45 py-2.5 text-xs font-bold text-brand-text hover:text-brand-primary hover:bg-brand-primary/5 transition-all cursor-pointer"
                  >
                    📥 Export CSV
                  </button>
                </div>

                <div className="rounded-2xl border border-brand-border bg-brand-card p-6 text-center flex flex-col justify-between hover-glow">
                  <div>
                    <span className="text-2xl">📝</span>
                    <h4 className="text-md font-bold text-brand-text mt-3 mb-2">Leave Roster</h4>
                    <p className="text-xs text-brand-muted">Download leave history logs, casual and sick approvals and balances.</p>
                  </div>
                  <button
                    onClick={() => handleExportCSV("leaves")}
                    className="mt-6 rounded-xl bg-brand-sidebar border border-brand-border hover:border-brand-primary/45 py-2.5 text-xs font-bold text-brand-text hover:text-brand-primary hover:bg-brand-primary/5 transition-all cursor-pointer"
                  >
                    📥 Export CSV
                  </button>
                </div>

              </div>

            </div>
          )}

          {/* TAB: SUPPORT & HELPDESK TICKETS */}
          {activeTab === "support" && (
            <div className="space-y-6">
              
              {/* Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-brand-sidebar/45 p-5 border border-brand-border rounded-2xl">
                <div>
                  <h3 className="text-lg font-bold text-brand-text flex items-center gap-2">🎫 Support & Helpdesk Tickets</h3>
                  <p className="text-xs text-brand-muted mt-1">Review, assign, and respond to support tickets submitted by employees.</p>
                </div>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="rounded-2xl border border-brand-border bg-brand-card p-6 shadow-xl hover-glow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-brand-muted tracking-wider">Total Tickets</p>
                      <h3 className="text-3xl font-black text-brand-primary mt-2">{allTickets.length}</h3>
                    </div>
                    <span className="text-3xl">🎫</span>
                  </div>
                </div>

                <div className="rounded-2xl border border-brand-border bg-brand-card p-6 shadow-xl hover-glow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-brand-muted tracking-wider">Open Tickets</p>
                      <h3 className="text-3xl font-black text-brand-danger mt-2">
                        {allTickets.filter(t => t.status === "open").length}
                      </h3>
                    </div>
                    <span className="text-3xl animate-pulse">🔴</span>
                  </div>
                </div>

                <div className="rounded-2xl border border-brand-border bg-brand-card p-6 shadow-xl hover-glow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-brand-muted tracking-wider">Resolved Tickets</p>
                      <h3 className="text-3xl font-black text-brand-success mt-2">
                        {allTickets.filter(t => t.status === "resolved").length}
                      </h3>
                    </div>
                    <span className="text-3xl">🟢</span>
                  </div>
                </div>
              </div>

              {/* Detail & Listing Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Tickets list (Left Column) */}
                <div className="lg:col-span-5 rounded-2xl border border-brand-border bg-brand-card p-6 shadow-xl hover-glow flex flex-col space-y-4">
                  <h4 className="text-md font-bold text-brand-text">Ticket List</h4>
                  
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                    {allTickets.length === 0 ? (
                      <p className="text-xs text-brand-muted italic text-center py-8">No support tickets found.</p>
                    ) : (
                      allTickets.map((ticket) => {
                        const emp = allEmployees.find(e => e.id === ticket.employee_id);
                        
                        let catName = ticket.category;
                        if (ticket.category === "payroll") catName = "💵 Payroll";
                        if (ticket.category === "benefits") catName = "❤️ Benefits";
                        if (ticket.category === "it_tech") catName = "💻 IT Tech";
                        if (ticket.category === "policy") catName = "📋 Policy";

                        return (
                          <button
                            key={ticket.id}
                            onClick={() => handleSelectTicket(ticket)}
                            className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${
                              selectedTicket?.id === ticket.id
                                ? "bg-brand-primary/10 border-brand-primary/45 shadow-sm"
                                : "bg-brand-sidebar/35 border-brand-border hover:bg-brand-sidebar/70"
                            }`}
                          >
                            <div className="flex justify-between items-start gap-2">
                              <span className="font-mono text-[10px] font-bold text-brand-muted">{ticket.ticket_no}</span>
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                                ticket.status === "open"
                                  ? "bg-brand-danger/10 text-brand-danger border-brand-danger/20"
                                  : ticket.status === "resolved"
                                  ? "bg-brand-muted/10 text-brand-muted border-brand-border"
                                  : "bg-brand-warning/10 text-brand-warning border-brand-warning/20"
                              }`}>
                                {ticket.status}
                              </span>
                            </div>
                            <h5 className="font-bold text-brand-text mt-1 text-xs truncate" title={ticket.title}>{ticket.title}</h5>
                            <p className="text-[10px] text-brand-muted mt-1">
                              👤 {emp ? `${emp.first_name} ${emp.last_name}` : `ID: ${ticket.employee_id}`}
                            </p>
                            <div className="flex justify-between items-center mt-3 text-[10px] text-brand-muted/70">
                              <span>{catName}</span>
                              <span>{new Date(ticket.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Details and Response Form (Right Column) */}
                <div className="lg:col-span-7">
                  {selectedTicket ? (
                    <div className="rounded-2xl border border-brand-border bg-brand-card p-6 shadow-xl hover-glow space-y-6">
                      
                      {/* Ticket Title & Status */}
                      <div className="pb-4 border-b border-brand-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                          <span className="font-mono text-xs text-brand-muted font-bold">{selectedTicket.ticket_no}</span>
                          <h4 className="text-base font-bold text-brand-text mt-1">{selectedTicket.title}</h4>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                          selectedTicket.status === "open"
                            ? "bg-brand-danger/10 text-brand-danger border-brand-danger/20"
                            : selectedTicket.status === "resolved"
                            ? "bg-brand-muted/10 text-brand-muted border-brand-border"
                            : "bg-brand-warning/10 text-brand-warning border-brand-warning/20"
                        }`}>
                          {selectedTicket.status}
                        </span>
                      </div>

                      {/* Ticket Details */}
                      <div className="space-y-4 text-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <p className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">Employee</p>
                            <p className="mt-1 font-semibold text-brand-text">
                              {(() => {
                                const emp = allEmployees.find(e => e.id === selectedTicket.employee_id);
                                return emp ? `${emp.first_name} ${emp.last_name} (${emp.employee_id})` : `Employee ID: ${selectedTicket.employee_id}`;
                              })()}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">Category</p>
                            <p className="mt-1 font-semibold text-brand-text uppercase">{selectedTicket.category}</p>
                          </div>
                        </div>

                        <div>
                          <p className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">Description</p>
                          <div className="mt-1.5 rounded-xl border border-brand-border bg-brand-sidebar/35 p-4 text-brand-text leading-relaxed">
                            {selectedTicket.description}
                          </div>
                        </div>
                      </div>

                      {/* Action Update Form */}
                      <form onSubmit={handleUpdateTicketSubmit} className="space-y-4 pt-4 border-t border-brand-border text-xs">
                        <h5 className="font-bold text-brand-text flex items-center gap-1.5">
                          <span>🛠️</span> Action & Reply
                        </h5>

                        {supportMessage && (
                          <div className={`p-3 rounded-xl border text-xs font-semibold ${
                            supportMessage.startsWith("Error")
                              ? "bg-brand-danger/10 border-brand-danger/20 text-brand-danger"
                              : "bg-brand-success/10 border-brand-success/20 text-brand-success"
                          }`}>
                            {supportMessage}
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1.5">Assignee</label>
                            <input
                              type="text"
                              value={assigneeName}
                              onChange={(e) => setAssigneeName(e.target.value)}
                              placeholder="e.g. HR Manager / Support Tech"
                              className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1.5">Status</label>
                            <select
                              value={ticketStatus}
                              onChange={(e) => setTicketStatus(e.target.value)}
                              className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60 cursor-pointer"
                            >
                              <option value="open">Open</option>
                              <option value="pending">In Progress</option>
                              <option value="resolved">Resolved</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1.5">Reply / Status Update Message</label>
                          <textarea
                            value={replyMessage}
                            onChange={(e) => setReplyMessage(e.target.value)}
                            rows={3}
                            placeholder="Type a response to the employee..."
                            className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60 resize-none"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={supportLoading}
                          className="w-full rounded-xl bg-brand-primary hover:bg-brand-primary/95 text-white py-3 text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                        >
                          {supportLoading ? "Updating..." : "💾 Update & Send Reply"}
                        </button>
                      </form>

                    </div>
                  ) : (
                    <div className="rounded-2xl border border-brand-border bg-brand-card p-12 text-center text-brand-muted shadow-xl flex flex-col items-center justify-center min-h-[300px]">
                      <span className="text-4xl mb-4">🎫</span>
                      <p className="text-xs font-semibold">Select a support ticket from the list to view details, assign, and reply.</p>
                    </div>
                  )}
                </div>

              </div>

            </div>
          )}

          {/* TAB: TENANT MANAGEMENT (Super Admin Only) */}
          {activeTab === "tenants" && (
            <div className="space-y-6">
              
              {/* Header / Provision Button */}
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-brand-sidebar/45 p-4 border border-brand-border rounded-2xl">
                <div>
                  <h3 className="text-sm font-bold text-brand-text">SaaS Tenants Directory</h3>
                  <p className="text-xs text-brand-muted font-medium mt-0.5">Provision and manage active customer companies, admins, and subscription plans.</p>
                </div>
                <button
                  onClick={() => setShowProvisionModal(true)}
                  className="rounded-xl bg-gradient-to-r from-brand-primary to-brand-secondary px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-brand-primary/20 hover:shadow-brand-primary/30 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                >
                  ➕ Provision New Tenant
                </button>
              </div>

              {/* Grid Layout: Main Tenant Table & Stats Side Panel */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                
                {/* Tenant List Table */}
                <div className="xl:col-span-2 rounded-2xl border border-brand-border bg-brand-card p-6 shadow-xl hover-glow space-y-4">
                  <h4 className="text-xs font-bold text-brand-muted uppercase tracking-wider">All Customer Companies</h4>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-brand-sidebar/70 text-[10px] uppercase font-bold text-brand-muted border-b border-brand-border">
                        <tr>
                          <th className="px-4 py-3.5">Company Name</th>
                          <th className="px-4 py-3.5">Admin Account</th>
                          <th className="px-4 py-3.5">Subscription Plan</th>
                          <th className="px-4 py-3.5">Tenant Status</th>
                          <th className="px-4 py-3.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-brand-border">
                        {adminsList.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-brand-muted/70 text-xs">
                              No tenants provisioned yet. Click "Provision New Tenant" to get started.
                            </td>
                          </tr>
                        ) : (
                          adminsList.map((admin) => {
                            const comp = admin.company;
                            if (!comp) return null;
                            return (
                              <tr key={admin.id} className="hover:bg-brand-primary/[0.02] transition-colors">
                                <td className="px-4 py-3">
                                  <p className="font-bold text-brand-text">{comp.name}</p>
                                  <p className="text-[10px] text-brand-muted">{comp.address || "No Address"}</p>
                                </td>
                                <td className="px-4 py-3">
                                  <p className="font-semibold text-brand-text/90">{admin.first_name} {admin.last_name}</p>
                                  <p className="text-[10px] text-brand-muted">{admin.email} | ID: {admin.employee_id}</p>
                                </td>
                                <td className="px-4 py-3">
                                  <select
                                    value={comp.subscription_plan}
                                    onChange={(e) => handleUpdateSubscription(admin.id, e.target.value)}
                                    className="rounded-lg border border-brand-border bg-brand-sidebar/40 px-2.5 py-1 text-[11px] font-semibold text-brand-text outline-none cursor-pointer focus:border-brand-primary/60"
                                  >
                                    <option value="basic">Basic</option>
                                    <option value="pro">Pro</option>
                                    <option value="enterprise">Enterprise</option>
                                  </select>
                                </td>
                                <td className="px-4 py-3">
                                  <button
                                    onClick={() => handleToggleSuspension(admin.id)}
                                    className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase border cursor-pointer transition-all hover:scale-[1.03] ${
                                      comp.is_active
                                        ? "bg-brand-success/10 text-brand-success border-brand-success/20 hover:bg-brand-success/20"
                                        : "bg-brand-danger/10 text-brand-danger border-brand-danger/20 hover:bg-brand-danger/20"
                                    }`}
                                  >
                                    {comp.is_active ? "Active" : "Suspended"}
                                  </button>
                                </td>
                                <td className="px-4 py-3 text-right space-x-2">
                                  <button
                                    onClick={() => handleLoadTenantStats(admin)}
                                    className="rounded-xl border border-brand-border hover:border-brand-primary/45 px-2.5 py-1.5 text-[10px] font-bold text-brand-text hover:text-brand-primary hover:bg-brand-primary/5 transition-all cursor-pointer"
                                  >
                                    📊 Stats
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Tenant Stats / Details Panel */}
                <div className="rounded-2xl border border-brand-border bg-brand-card p-6 shadow-xl hover-glow space-y-4">
                  <h4 className="text-xs font-bold text-brand-muted uppercase tracking-wider">Tenant Overview & Statistics</h4>
                  
                  {selectedTenantStats ? (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-brand-sidebar/60 border border-brand-border space-y-1">
                        <p className="text-[10px] text-brand-muted uppercase font-black">Company Name</p>
                        <p className="text-md font-extrabold text-brand-text">{selectedTenantStats.company_name}</p>
                        <span className={`inline-flex mt-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                          selectedTenantStats.subscription_plan === "enterprise"
                            ? "bg-brand-primary/10 text-brand-primary border border-brand-primary/20"
                            : selectedTenantStats.subscription_plan === "pro"
                            ? "bg-brand-secondary/10 text-brand-secondary border border-brand-secondary/20"
                            : "bg-brand-sidebar/60 text-brand-muted border border-brand-border"
                        }`}>
                          👑 {selectedTenantStats.subscription_plan} plan
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 text-center rounded-xl bg-brand-sidebar/40 border border-brand-border">
                          <p className="text-[10px] font-bold text-brand-muted uppercase mb-1">Employees</p>
                          <p className="text-xl font-black text-brand-primary">{selectedTenantStats.total_employees}</p>
                        </div>
                        <div className="p-3 text-center rounded-xl bg-brand-sidebar/40 border border-brand-border">
                          <p className="text-[10px] font-bold text-brand-muted uppercase mb-1">Departments</p>
                          <p className="text-xl font-black text-brand-secondary">{selectedTenantStats.total_departments}</p>
                        </div>
                        <div className="p-3 text-center rounded-xl bg-brand-sidebar/40 border border-brand-border">
                          <p className="text-[10px] font-bold text-brand-muted uppercase mb-1">Admins</p>
                          <p className="text-xl font-black text-brand-success">{selectedTenantStats.total_admins}</p>
                        </div>
                      </div>

                      <div className="p-4 rounded-xl bg-brand-sidebar/30 border border-brand-border text-xs space-y-2 text-brand-muted font-medium">
                        <div className="flex justify-between">
                          <span>Tenant ID:</span>
                          <span className="font-bold text-brand-text">{selectedTenantStats.company_id}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Provisioned At:</span>
                          <span className="font-bold text-brand-text">{new Date(selectedTenantStats.created_at).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Billing Status:</span>
                          <span className={`font-black ${selectedTenantStats.is_active ? "text-brand-success" : "text-brand-danger"}`}>
                            {selectedTenantStats.is_active ? "ACTIVE & BILLABLE" : "SUSPENDED"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-48 rounded-xl border border-dashed border-brand-border flex flex-col items-center justify-center text-center p-6 text-brand-muted">
                      <span className="text-3xl mb-2">📊</span>
                      <p className="text-xs font-semibold">Click the "Stats" button next to any tenant to inspect their stats here.</p>
                    </div>
                  )}
                </div>

              </div>

            </div>
          )}

          {/* TAB 9: ORG SETTINGS */}
          {activeTab === "org-settings" && (
            <div className="space-y-6">
              
              {/* Notification Banner */}
              {orgSuccess && (
                <div className="rounded-xl border border-brand-success/20 bg-brand-success/10 p-3 text-xs font-semibold text-brand-success">
                  ✅ {orgSuccess}
                </div>
              )}
              {orgError && (
                <div className="rounded-xl border border-brand-danger/20 bg-brand-danger/10 p-3 text-xs font-semibold text-brand-danger">
                  ❌ {orgError}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* COLUMN 1: STRUCTURE */}
                <div className="space-y-6">
                  
                  {/* Companies section */}
                  {currentEmployee?.role === "super_admin" && (
                    <div className="rounded-2xl border border-brand-border bg-brand-card p-6 shadow-xl space-y-4 hover-glow">
                      <h3 className="text-md font-bold text-brand-text flex items-center gap-2">🏢 Manage Companies</h3>
                      
                      {/* Add Company Form */}
                      <form onSubmit={handleAddCompany} className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <input
                          type="text"
                          required
                          placeholder="Company Name"
                          value={companyForm.name}
                          onChange={(e) => setCompanyForm(p => ({ ...p, name: e.target.value }))}
                          className="md:col-span-1 rounded-xl border border-brand-border bg-brand-sidebar/55 px-3 py-2 text-xs text-brand-text outline-none focus:border-brand-primary/60"
                        />
                        <input
                          type="text"
                          placeholder="Address (Optional)"
                          value={companyForm.address || ""}
                          onChange={(e) => setCompanyForm(p => ({ ...p, address: e.target.value }))}
                          className="md:col-span-1 rounded-xl border border-brand-border bg-brand-sidebar/55 px-3 py-2 text-xs text-brand-text outline-none focus:border-brand-primary/60"
                        />
                        <button
                          type="submit"
                          className="rounded-xl bg-brand-primary hover:bg-brand-primary/90 py-2 text-xs font-bold text-white transition-all cursor-pointer shadow-md shadow-brand-primary/10"
                        >
                          + Add Company
                        </button>
                      </form>

                      {/* Companies List */}
                      <div className="border-t border-brand-border pt-3 max-h-48 overflow-y-auto space-y-2">
                        {companies.length === 0 ? (
                          <p className="text-[11px] text-brand-muted italic text-center py-2">No companies added yet.</p>
                        ) : (
                          companies.map((comp) => (
                            <div key={comp.id} className="flex justify-between items-center p-2.5 rounded-xl bg-brand-sidebar/45 border border-brand-border text-xs">
                              <span className="font-semibold text-brand-text/90">{comp.name}</span>
                              <span className="text-brand-muted text-[10px]">{comp.address || "No address"}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* Departments section */}
                  <div className="rounded-2xl border border-brand-border bg-brand-card p-6 shadow-xl space-y-4 hover-glow">
                    <h3 className="text-md font-bold text-brand-text flex items-center gap-2">📂 Manage Departments</h3>
                    
                    {/* Add Department Form */}
                    <form onSubmit={handleAddDepartment} className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <input
                        type="text"
                        required
                        placeholder="Dept Name"
                        value={deptForm.name}
                        onChange={(e) => setDeptForm(p => ({ ...p, name: e.target.value }))}
                        className={`rounded-xl border border-brand-border bg-brand-sidebar/55 px-3 py-2 text-xs text-brand-text outline-none focus:border-brand-primary/60 ${
                          currentEmployee?.role === "super_admin" ? "" : "md:col-span-2"
                        }`}
                      />
                      {currentEmployee?.role === "super_admin" ? (
                        <select
                          required
                          value={deptForm.company_id}
                          onChange={(e) => setDeptForm(p => ({ ...p, company_id: e.target.value }))}
                          className="rounded-xl border border-brand-border bg-brand-sidebar/55 px-3 py-2 text-xs text-brand-text outline-none focus:border-brand-primary/60 cursor-pointer"
                        >
                          <option value="">Select Company</option>
                          {companies.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      ) : null}
                      <button
                        type="submit"
                        className="rounded-xl bg-brand-primary hover:bg-brand-primary/90 py-2 text-xs font-bold text-white transition-all cursor-pointer shadow-md shadow-brand-primary/10"
                      >
                        + Add Dept
                      </button>
                    </form>

                    {/* Departments List */}
                    <div className="border-t border-brand-border pt-3 max-h-48 overflow-y-auto space-y-2">
                      {departments.length === 0 ? (
                        <p className="text-[11px] text-brand-muted italic text-center py-2">No departments added yet.</p>
                      ) : (
                        departments.map((dept) => {
                          const compName = companies.find(c => c.id === dept.company_id)?.name || "Unknown Company";
                          return (
                            <div key={dept.id} className="flex justify-between items-center p-2.5 rounded-xl bg-brand-sidebar/45 border border-brand-border text-xs">
                              <span className="font-semibold text-brand-text/90">{dept.name}</span>
                              <span className="text-brand-muted text-[10px] uppercase font-bold bg-brand-sidebar/60 border border-brand-border px-2 py-0.5 rounded-md">{compName}</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                </div>

                {/* COLUMN 2: BOARD CONTENT */}
                <div className="space-y-6">
                  
                  {/* Announcements Section */}
                  <div className="rounded-2xl border border-brand-border bg-brand-card p-6 shadow-xl space-y-4 hover-glow">
                    <h3 className="text-md font-bold text-brand-text flex items-center gap-2">📢 Post Announcements</h3>
                    
                    {/* Add Announcement Form */}
                    <form onSubmit={handleAddAnnouncement} className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          required
                          placeholder="Title"
                          value={annForm.title}
                          onChange={(e) => setAnnForm(p => ({ ...p, title: e.target.value }))}
                          className="rounded-xl border border-brand-border bg-brand-sidebar/55 px-3 py-2 text-xs text-brand-text outline-none focus:border-brand-primary/60"
                        />
                        <select
                          value={annForm.tag}
                          onChange={(e) => setAnnForm(p => ({ ...p, tag: e.target.value }))}
                          className="rounded-xl border border-brand-border bg-brand-sidebar/55 px-3 py-2 text-xs text-brand-text outline-none focus:border-brand-primary/60 cursor-pointer"
                        >
                          <option value="General">General</option>
                          <option value="Event">Event</option>
                          <option value="New Policy">New Policy</option>
                          <option value="Holiday Notice">Holiday Notice</option>
                        </select>
                      </div>
                      <textarea
                        required
                        placeholder="Content message..."
                        rows={2}
                        value={annForm.content}
                        onChange={(e) => setAnnForm(p => ({ ...p, content: e.target.value }))}
                        className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3 py-2 text-xs text-brand-text outline-none focus:border-brand-primary/60"
                      />
                      <div className="flex justify-between items-center">
                        <label className="flex items-center gap-2 text-xs text-brand-muted cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={annForm.is_urgent}
                            onChange={(e) => setAnnForm(p => ({ ...p, is_urgent: e.target.checked }))}
                            className="rounded accent-brand-primary cursor-pointer"
                          />
                          Mark as Urgent
                        </label>
                        <button
                          type="submit"
                          className="rounded-xl bg-gradient-to-r from-brand-primary to-brand-secondary px-4 py-2 text-xs font-bold text-white shadow shadow-brand-primary/10 hover:scale-[1.01] transition-all"
                        >
                          Post Announcement
                        </button>
                      </div>
                    </form>

                    {/* Announcements List */}
                    <div className="border-t border-brand-border pt-3 max-h-48 overflow-y-auto space-y-2">
                      {announcements.length === 0 ? (
                        <p className="text-[11px] text-brand-muted italic text-center py-2">No announcements posted.</p>
                      ) : (
                        announcements.map((ann) => (
                          <div key={ann.id} className="flex justify-between items-start p-3 rounded-xl bg-brand-sidebar/45 border border-brand-border text-xs">
                            <div className="space-y-1 flex-1 pr-2">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-brand-text/90">{ann.title}</span>
                                {ann.is_urgent && <span className="text-[9px] font-bold text-brand-danger bg-brand-danger/10 px-1 py-0.5 rounded">URGENT</span>}
                              </div>
                              <p className="text-[10px] text-brand-muted line-clamp-1">{ann.content}</p>
                            </div>
                            <button
                              onClick={() => handleDeleteAnnouncement(ann.id)}
                              className="text-brand-danger hover:text-brand-danger/80 font-bold px-1.5 py-0.5 text-[10px] border border-brand-danger/20 rounded bg-brand-danger/5 cursor-pointer transition-colors"
                            >
                              ✕
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Holidays Section */}
                  <div className="rounded-2xl border border-brand-border bg-brand-card p-6 shadow-xl space-y-4 hover-glow">
                    <h3 className="text-md font-bold text-brand-text flex items-center gap-2">📅 Schedule Holidays</h3>
                    
                    {/* Add Holiday Form */}
                    <form onSubmit={handleAddHoliday} className="grid grid-cols-1 md:grid-cols-4 gap-2">
                      <input
                        type="text"
                        required
                        placeholder="Holiday Title"
                        value={holidayForm.title}
                        onChange={(e) => setHolidayForm(p => ({ ...p, title: e.target.value }))}
                        className="rounded-xl border border-brand-border bg-brand-sidebar/55 px-3 py-2 text-xs text-brand-text outline-none focus:border-brand-primary/60"
                      />
                      <input
                        type="date"
                        required
                        value={holidayForm.date}
                        onChange={(e) => setHolidayForm(p => ({ ...p, date: e.target.value }))}
                        className="rounded-xl border border-brand-border bg-brand-sidebar/55 px-3 py-2 text-xs text-brand-text outline-none focus:border-brand-primary/60 cursor-pointer"
                      />
                      <select
                        value={holidayForm.holiday_type}
                        onChange={(e) => setHolidayForm(p => ({ ...p, holiday_type: e.target.value }))}
                        className="rounded-xl border border-brand-border bg-brand-sidebar/55 px-3 py-2 text-xs text-brand-text outline-none focus:border-brand-primary/60 cursor-pointer"
                      >
                        <option value="Public Holiday">Public Holiday</option>
                        <option value="Optional Holiday">Optional Holiday</option>
                        <option value="Regional Holiday">Regional Holiday</option>
                      </select>
                      <button
                        type="submit"
                        className="rounded-xl bg-brand-primary hover:bg-brand-primary/90 py-2 text-xs font-bold text-white transition-all cursor-pointer shadow-md shadow-brand-primary/10"
                      >
                        + Add
                      </button>
                    </form>

                    {/* Holidays List */}
                    <div className="border-t border-brand-border pt-3 max-h-48 overflow-y-auto space-y-2">
                      {holidays.length === 0 ? (
                        <p className="text-[11px] text-brand-muted italic text-center py-2">No holidays scheduled.</p>
                      ) : (
                        holidays.map((hol) => (
                          <div key={hol.id} className="flex justify-between items-center p-2.5 rounded-xl bg-brand-sidebar/45 border border-brand-border text-xs">
                            <div className="flex items-center gap-3">
                              <span className="bg-brand-sidebar/85 border border-brand-border text-brand-muted text-[10px] px-2 py-0.5 rounded-md font-bold">{hol.date}</span>
                              <span className="font-semibold text-brand-text/90">{hol.title}</span>
                              <span className="text-[9px] text-brand-muted/70 font-bold uppercase">{hol.holiday_type}</span>
                            </div>
                            <button
                              onClick={() => handleDeleteHoliday(hol.id)}
                              className="text-brand-danger hover:text-brand-danger/80 font-bold px-1.5 py-0.5 text-[10px] border border-brand-danger/20 rounded bg-brand-danger/5 cursor-pointer transition-colors"
                            >
                              ✕
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                </div>

              </div>

            </div>
          )}

          {/* TAB 10: OFFICE & WIFI SETTINGS */}
          {activeTab === "office-settings" && currentEmployee?.role === "admin" && (
            <div className="space-y-6">
              
              {/* Notification Banner */}
              {officeSettingsSuccess && (
                <div className="rounded-xl border border-brand-success/20 bg-brand-success/10 p-3 text-xs font-semibold text-brand-success animate-fadeIn">
                  ✅ {officeSettingsSuccess}
                </div>
              )}
              {officeSettingsError && (
                <div className="rounded-xl border border-brand-danger/20 bg-brand-danger/10 p-3 text-xs font-semibold text-brand-danger animate-fadeIn">
                  ❌ {officeSettingsError}
                </div>
              )}

              <div className="max-w-2xl rounded-2xl border border-brand-border bg-brand-card p-6 shadow-xl space-y-6 hover-glow">
                <div className="border-b border-brand-border pb-4">
                  <h3 className="text-lg font-bold text-brand-text flex items-center gap-2">📶 Office Network & Geolocation</h3>
                  <p className="text-xs text-brand-muted mt-1">Configure company network boundaries, coordinates and allowed Wi-Fi networks for employee attendance punches.</p>
                </div>
                
                <form onSubmit={handleUpdateOfficeSettings} className="space-y-4">
                  {/* Company display */}
                  <div>
                    <label className="block text-xs font-bold text-brand-muted uppercase mb-1.5">Company Name</label>
                    <input
                      type="text"
                      disabled
                      value={companies.find(c => String(c.id) === selectedOfficeCompanyId)?.name || "Your Company"}
                      className="w-full rounded-xl border border-brand-border bg-brand-sidebar/35 px-4 py-2.5 text-xs text-brand-muted outline-none cursor-not-allowed font-semibold"
                    />
                  </div>

                  {/* Wi-Fi SSIDs */}
                  <div>
                    <label className="block text-xs font-bold text-brand-muted uppercase mb-1.5 flex items-center gap-2">
                      <span>📡 Allowed Wi-Fi SSIDs</span>
                      <span className="text-[10px] text-brand-muted/70 font-normal normal-case">(Comma-separated, e.g. office_wifi, office-5g)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. office_wifi, office-5g, hr_connect_wifi"
                      value={officeSettingsForm.allowed_wifi_ssids}
                      onChange={(e) => setOfficeSettingsForm(p => ({ ...p, allowed_wifi_ssids: e.target.value }))}
                      className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-4 py-2.5 text-xs text-brand-text outline-none focus:border-brand-primary/60 placeholder-brand-muted/40 transition-colors"
                    />
                  </div>

                  {/* Wi-Fi BSSIDs */}
                  <div>
                    <label className="block text-xs font-bold text-brand-muted uppercase mb-1.5 flex items-center gap-2">
                      <span>🔒 Allowed Router MAC Addresses (BSSIDs)</span>
                      <span className="text-[10px] text-brand-muted/70 font-normal normal-case">(Comma-separated, e.g. 11:22:33:44:55:66)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 11:22:33:44:55:66, a1:b2:c3:d4:e5:f6"
                      value={officeSettingsForm.allowed_wifi_bssids}
                      onChange={(e) => setOfficeSettingsForm(p => ({ ...p, allowed_wifi_bssids: e.target.value }))}
                      className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-4 py-2.5 text-xs text-brand-text outline-none focus:border-brand-primary/60 placeholder-brand-muted/40 transition-colors"
                    />
                  </div>

                  {/* Geolocation coords grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-brand-muted uppercase mb-1.5">📍 Office Latitude</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 28.6252"
                        value={officeSettingsForm.office_latitude}
                        onChange={(e) => setOfficeSettingsForm(p => ({ ...p, office_latitude: e.target.value }))}
                        className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-4 py-2.5 text-xs text-brand-text outline-none focus:border-brand-primary/60 placeholder-brand-muted/40 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-brand-muted uppercase mb-1.5">📍 Office Longitude</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 77.3736"
                        value={officeSettingsForm.office_longitude}
                        onChange={(e) => setOfficeSettingsForm(p => ({ ...p, office_longitude: e.target.value }))}
                        className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-4 py-2.5 text-xs text-brand-text outline-none focus:border-brand-primary/60 placeholder-brand-muted/40 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Distance radius */}
                  <div>
                    <label className="block text-xs font-bold text-brand-muted uppercase mb-1.5 flex items-center gap-2">
                      <span>📏 Allowed Distance Range (Meters)</span>
                      <span className="text-[10px] text-brand-muted/70 font-normal normal-case">(Max allowed distance from office coordinates for GPS punches)</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="10000"
                      placeholder="e.g. 200"
                      value={officeSettingsForm.max_distance_meters}
                      onChange={(e) => setOfficeSettingsForm(p => ({ ...p, max_distance_meters: e.target.value }))}
                      className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-4 py-2.5 text-xs text-brand-text outline-none focus:border-brand-primary/60 placeholder-brand-muted/40 transition-colors"
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={officeSettingsLoading}
                      className="rounded-xl bg-gradient-to-r from-brand-primary to-brand-secondary px-6 py-2.5 text-xs font-bold text-white shadow shadow-brand-primary/10 hover:scale-[1.01] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {officeSettingsLoading ? "Saving Settings..." : "💾 Save Network Settings"}
                    </button>
                  </div>
                </form>
              </div>

            </div>
          )}

        </div>
      </main>

      {/* MODAL: PROVISION NEW TENANT */}
      {showProvisionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl border border-brand-border bg-brand-sidebar/95 backdrop-blur-xl p-6 shadow-2xl space-y-4 hover-glow max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-brand-border pb-3">
              <div>
                <h3 className="text-md font-bold text-brand-text">Provision New SaaS Tenant</h3>
                <p className="text-[10px] text-brand-muted mt-0.5">Creates a Company & Admin account atomically in one transaction.</p>
              </div>
              <button 
                onClick={() => setShowProvisionModal(false)}
                className="text-brand-muted hover:text-brand-text text-md font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
            
            {provisionError && (
              <p className="p-3 bg-brand-danger/10 border border-brand-danger/20 text-brand-danger text-xs text-center rounded-xl font-bold">
                {provisionError}
              </p>
            )}

            <form onSubmit={handleProvisionTenant} className="space-y-4 text-xs">
              
              {/* Company Info section */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-brand-primary">1. Company Profile Details</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1">Company Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Acme Corp"
                      value={provisionForm.company_name}
                      onChange={(e) => setProvisionForm(p => ({ ...p, company_name: e.target.value }))}
                      className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1">Subscription Plan</label>
                    <select
                      value={provisionForm.subscription_plan}
                      onChange={(e) => setProvisionForm(p => ({ ...p, subscription_plan: e.target.value }))}
                      className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60 cursor-pointer"
                    >
                      <option value="basic">Basic Plan</option>
                      <option value="pro">Pro Plan</option>
                      <option value="enterprise">Enterprise Plan</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1">Company Address (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. 123 Innovation Way, Tech District"
                    value={provisionForm.company_address}
                    onChange={(e) => setProvisionForm(p => ({ ...p, company_address: e.target.value }))}
                    className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60"
                  />
                </div>
              </div>

              {/* Admin Info section */}
              <div className="space-y-3 pt-2 border-t border-brand-border">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-brand-secondary">2. Admin User Details</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1">First Name</label>
                    <input
                      type="text"
                      required
                      placeholder="Sundar"
                      value={provisionForm.admin_first_name}
                      onChange={(e) => setProvisionForm(p => ({ ...p, admin_first_name: e.target.value }))}
                      className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1">Last Name</label>
                    <input
                      type="text"
                      required
                      placeholder="Pichai"
                      value={provisionForm.admin_last_name}
                      onChange={(e) => setProvisionForm(p => ({ ...p, admin_last_name: e.target.value }))}
                      className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1">Admin Employee ID</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. ADM-001"
                      value={provisionForm.admin_employee_id}
                      onChange={(e) => setProvisionForm(p => ({ ...p, admin_employee_id: e.target.value }))}
                      className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1">Admin Email</label>
                    <input
                      type="email"
                      required
                      placeholder="admin@acme.com"
                      value={provisionForm.admin_email}
                      onChange={(e) => setProvisionForm(p => ({ ...p, admin_email: e.target.value }))}
                      className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1">Admin Password</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={provisionForm.admin_password}
                    onChange={(e) => setProvisionForm(p => ({ ...p, admin_password: e.target.value }))}
                    className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60"
                  />
                </div>
              </div>

              {/* Form buttons */}
              <div className="flex gap-3 justify-end pt-3 border-t border-brand-border">
                <button
                  type="button"
                  onClick={() => setShowProvisionModal(false)}
                  className="rounded-xl border border-brand-border px-4 py-2.5 font-bold hover:bg-brand-sidebar/40 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={provisionLoading}
                  className="rounded-xl bg-gradient-to-r from-brand-primary to-brand-secondary px-5 py-2.5 font-bold text-white shadow-lg shadow-brand-primary/20 hover:scale-[1.01] transition-all cursor-pointer disabled:opacity-50"
                >
                  {provisionLoading ? "Provisioning..." : "🚀 Provision Tenant"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL 1: ADD EMPLOYEE */}
      {showAddEmployeeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl border border-brand-border bg-brand-sidebar/95 backdrop-blur-xl p-6 shadow-2xl space-y-4 hover-glow">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-brand-text">Create Employee Profile</h3>
              <button 
                onClick={() => setShowAddEmployeeModal(false)}
                className="text-brand-muted hover:text-brand-text text-md font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
            
            {employeeFormError && (
              <p className="p-3 bg-brand-danger/10 border border-brand-danger/20 text-brand-danger text-xs text-center rounded-xl font-bold">
                {employeeFormError}
              </p>
            )}

            <form onSubmit={handleAddEmployee} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    value={employeeForm.first_name}
                    onChange={(e) => setEmployeeForm(p => ({ ...p, first_name: e.target.value }))}
                    placeholder="John"
                    className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1">Last Name</label>
                  <input
                    type="text"
                    required
                    value={employeeForm.last_name}
                    onChange={(e) => setEmployeeForm(p => ({ ...p, last_name: e.target.value }))}
                    placeholder="Doe"
                    className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1">Employee ID</label>
                  <input
                    type="text"
                    required
                    value={employeeForm.employee_id}
                    onChange={(e) => setEmployeeForm(p => ({ ...p, employee_id: e.target.value }))}
                    placeholder="EMP-002"
                    className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1">Role / Tier</label>
                  <select
                    value={employeeForm.role}
                    onChange={(e) => setEmployeeForm(p => ({ ...p, role: e.target.value }))}
                    className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60"
                  >
                    {currentEmployee?.role === "super_admin" ? (
                      <option value="admin">Company Administrator</option>
                    ) : currentEmployee?.role === "admin" ? (
                      <>
                        <option value="employee">Employee</option>
                        <option value="manager">Manager</option>
                        <option value="hr">HR Personnel</option>
                      </>
                    ) : (
                      <>
                        <option value="employee">Employee</option>
                        <option value="manager">Manager</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {currentEmployee?.role === "super_admin" && (
                <div>
                  <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1">Assign Company</label>
                  <select
                    required
                    value={employeeForm.company_id}
                    onChange={(e) => setEmployeeForm(p => ({ ...p, company_id: e.target.value }))}
                    className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60 cursor-pointer"
                  >
                    <option value="">Select Company</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1">Email</label>
                  <input
                    type="email"
                    required
                    autoComplete="new-email"
                    value={employeeForm.email}
                    onChange={(e) => setEmployeeForm(p => ({ ...p, email: e.target.value }))}
                    placeholder="name@company.com"
                    className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1">Password</label>
                  <input
                    type="password"
                    required
                    autoComplete="new-password"
                    value={employeeForm.password}
                    onChange={(e) => setEmployeeForm(p => ({ ...p, password: e.target.value }))}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60"
                  />
                </div>
              </div>

              {currentEmployee?.role !== "super_admin" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1">Department</label>
                      <select
                        value={employeeForm.department_id}
                        onChange={(e) => setEmployeeForm(p => ({ ...p, department_id: e.target.value }))}
                        className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60 cursor-pointer"
                      >
                        <option value="">Select Department (None)</option>
                        {departments.map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1">Reporting Manager</label>
                      <select
                        value={employeeForm.reporting_manager_id}
                        onChange={(e) => setEmployeeForm(p => ({ ...p, reporting_manager_id: e.target.value }))}
                        className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60 cursor-pointer"
                      >
                        <option value="">Select Manager (None)</option>
                        {allEmployees.filter(emp => ["manager", "hr", "admin"].includes(emp.role)).map(mgr => (
                          <option key={mgr.id} value={mgr.id}>{mgr.first_name} {mgr.last_name} ({mgr.role.replace("_", " ")})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="border-t border-brand-border pt-3">
                    <h4 className="font-bold text-brand-text mb-2 uppercase text-[9px] tracking-wider">Financial & Emergency Details</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1">Salary Amount ($/yr)</label>
                        <input
                          type="number"
                          value={employeeForm.salary_amount}
                          onChange={(e) => setEmployeeForm(p => ({ ...p, salary_amount: e.target.value }))}
                          placeholder="60000"
                          className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1">Emergency Contact</label>
                        <input
                          type="text"
                          value={employeeForm.emergency_contact}
                          onChange={(e) => setEmployeeForm(p => ({ ...p, emergency_contact: e.target.value }))}
                          placeholder="Name / Phone"
                          className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1">Bank Name</label>
                        <input
                          type="text"
                          value={employeeForm.bank_name}
                          onChange={(e) => setEmployeeForm(p => ({ ...p, bank_name: e.target.value }))}
                          placeholder="Chase / Wells Fargo"
                          className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1">Account Number</label>
                        <input
                          type="text"
                          value={employeeForm.bank_account_no}
                          onChange={(e) => setEmployeeForm(p => ({ ...p, bank_account_no: e.target.value }))}
                          placeholder="1234567890"
                          className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Leave Entitlements Section - Admin/HR Only */}
                  {["admin", "hr"].includes(currentEmployee?.role || "") && (
                    <div className="border-t border-brand-border pt-3">
                      <h4 className="font-bold text-brand-text mb-2 uppercase text-[9px] tracking-wider">Leave Balance Entitlements</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1">Casual Leaves</label>
                          <input
                            type="number"
                            value={employeeForm.casual_leaves_entitled}
                            onChange={(e) => setEmployeeForm(p => ({ ...p, casual_leaves_entitled: e.target.value }))}
                            className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1">Sick Leaves</label>
                          <input
                            type="number"
                            value={employeeForm.sick_leaves_entitled}
                            onChange={(e) => setEmployeeForm(p => ({ ...p, sick_leaves_entitled: e.target.value }))}
                            className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1">WFH Days</label>
                          <input
                            type="number"
                            value={employeeForm.wfh_leaves_entitled}
                            onChange={(e) => setEmployeeForm(p => ({ ...p, wfh_leaves_entitled: e.target.value }))}
                            className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1">Earned Leaves</label>
                          <input
                            type="number"
                            value={employeeForm.earned_leaves_entitled}
                            onChange={(e) => setEmployeeForm(p => ({ ...p, earned_leaves_entitled: e.target.value }))}
                            className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              <button
                type="submit"
                disabled={employeeFormLoading}
                className="w-full rounded-xl bg-gradient-to-r from-brand-success to-brand-success/80 py-3 text-xs font-bold text-white shadow-lg shadow-brand-success/20 hover:shadow-brand-success/30 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
              >
                {employeeFormLoading ? "Creating..." : "Save Profile"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT EMPLOYEE */}
      {showEditEmployeeModal && selectedEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl border border-brand-border bg-brand-sidebar/95 backdrop-blur-xl p-6 shadow-2xl space-y-4 hover-glow">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-brand-text">Edit Employee Profile</h3>
              <button 
                onClick={() => {
                  setShowEditEmployeeModal(false);
                  setSelectedEmployee(null);
                }}
                className="text-brand-muted hover:text-brand-text text-md font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
            
            {employeeFormError && (
              <p className="p-3 bg-brand-danger/10 border border-brand-danger/20 text-brand-danger text-xs text-center rounded-xl font-bold">
                {employeeFormError}
              </p>
            )}

            <form onSubmit={handleUpdateEmployee} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    value={selectedEmployee.first_name}
                    onChange={(e) => setSelectedEmployee(p => p ? ({ ...p, first_name: e.target.value }) : null)}
                    className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1">Last Name</label>
                  <input
                    type="text"
                    required
                    value={selectedEmployee.last_name}
                    onChange={(e) => setSelectedEmployee(p => p ? ({ ...p, last_name: e.target.value }) : null)}
                    className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1">Email</label>
                  <input
                    type="email"
                    required
                    autoComplete="new-email"
                    value={selectedEmployee.email}
                    onChange={(e) => setSelectedEmployee(p => p ? ({ ...p, email: e.target.value }) : null)}
                    className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1">Role / Tier</label>
                  <select
                    value={selectedEmployee.role}
                    onChange={(e) => setSelectedEmployee(p => p ? ({ ...p, role: e.target.value }) : null)}
                    className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60"
                  >
                    {currentEmployee?.role === "super_admin" ? (
                      <option value="admin">Company Administrator</option>
                    ) : currentEmployee?.role === "admin" ? (
                      <>
                        <option value="employee">Employee</option>
                        <option value="manager">Manager</option>
                        <option value="hr">HR Personnel</option>
                      </>
                    ) : (
                      <>
                        <option value="employee">Employee</option>
                        <option value="manager">Manager</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {currentEmployee?.role === "super_admin" && (
                <div>
                  <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1">Assign Company</label>
                  <select
                    required
                    value={selectedEmployee.company_id || ""}
                    onChange={(e) => setSelectedEmployee(p => p ? ({ ...p, company_id: e.target.value ? parseInt(e.target.value) : undefined }) : null)}
                    className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60 cursor-pointer"
                  >
                    <option value="">Select Company</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1">Status</label>
                  <select
                    value={selectedEmployee.is_active ? "true" : "false"}
                    onChange={(e) => setSelectedEmployee(p => p ? ({ ...p, is_active: e.target.value === "true" }) : null)}
                    className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60"
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1">Salary Tier ($/yr)</label>
                  <input
                    type="number"
                    value={selectedEmployee.salary_amount || ""}
                    onChange={(e) => setSelectedEmployee(p => p ? ({ ...p, salary_amount: parseFloat(e.target.value) || 0 }) : null)}
                    className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1">Department</label>
                  <select
                    value={selectedEmployee.department_id || ""}
                    onChange={(e) => setSelectedEmployee(p => p ? ({ ...p, department_id: e.target.value ? parseInt(e.target.value) : undefined }) : null)}
                    className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60 cursor-pointer"
                  >
                    <option value="">Select Department (None)</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1">Reporting Manager</label>
                  <select
                    value={selectedEmployee.reporting_manager_id || ""}
                    onChange={(e) => setSelectedEmployee(p => p ? ({ ...p, reporting_manager_id: e.target.value ? parseInt(e.target.value) : undefined }) : null)}
                    className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60 cursor-pointer"
                  >
                    <option value="">Select Manager (None)</option>
                    {allEmployees.filter(emp => emp.id !== selectedEmployee.id && ["manager", "hr", "admin"].includes(emp.role)).map(mgr => (
                      <option key={mgr.id} value={mgr.id}>{mgr.first_name} {mgr.last_name} ({mgr.role.replace("_", " ")})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="border-t border-brand-border pt-3">
                <h4 className="font-bold text-brand-text mb-2 uppercase text-[9px] tracking-wider">Financial & Emergency Details</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1">Bank Name</label>
                    <input
                      type="text"
                      value={selectedEmployee.bank_name || ""}
                      onChange={(e) => setSelectedEmployee(p => p ? ({ ...p, bank_name: e.target.value }) : null)}
                      className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1">Account Number</label>
                    <input
                      type="text"
                      value={selectedEmployee.bank_account_no || ""}
                      onChange={(e) => setSelectedEmployee(p => p ? ({ ...p, bank_account_no: e.target.value }) : null)}
                      className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1">Emergency Contact</label>
                    <input
                      type="text"
                      value={selectedEmployee.emergency_contact || ""}
                      onChange={(e) => setSelectedEmployee(p => p ? ({ ...p, emergency_contact: e.target.value }) : null)}
                      className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60"
                    />
                  </div>
                </div>
              </div>

              {/* Leave Entitlements Section - Admin/HR Only */}
              {["super_admin", "admin", "hr"].includes(currentEmployee?.role || "") && (
                <div className="border-t border-brand-border pt-3">
                  <h4 className="font-bold text-brand-text mb-2 uppercase text-[9px] tracking-wider">Leave Balance Entitlements</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1">Casual Leaves</label>
                      <input
                        type="number"
                        value={selectedEmployee.casual_leaves_entitled ?? 15}
                        onChange={(e) => setSelectedEmployee(p => p ? ({ ...p, casual_leaves_entitled: parseInt(e.target.value) || 0 }) : null)}
                        className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1">Sick Leaves</label>
                      <input
                        type="number"
                        value={selectedEmployee.sick_leaves_entitled ?? 10}
                        onChange={(e) => setSelectedEmployee(p => p ? ({ ...p, sick_leaves_entitled: parseInt(e.target.value) || 0 }) : null)}
                        className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1">WFH Days</label>
                      <input
                        type="number"
                        value={selectedEmployee.wfh_leaves_entitled ?? 30}
                        onChange={(e) => setSelectedEmployee(p => p ? ({ ...p, wfh_leaves_entitled: parseInt(e.target.value) || 0 }) : null)}
                        className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1">Earned Leaves</label>
                      <input
                        type="number"
                        value={selectedEmployee.earned_leaves_entitled ?? 12}
                        onChange={(e) => setSelectedEmployee(p => p ? ({ ...p, earned_leaves_entitled: parseInt(e.target.value) || 0 }) : null)}
                        className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60"
                      />
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={employeeFormLoading}
                className="w-full rounded-xl bg-gradient-to-r from-brand-success to-brand-success/80 py-3 text-xs font-bold text-white shadow-lg shadow-brand-success/20 hover:shadow-brand-success/30 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
              >
                {employeeFormLoading ? "Saving Changes..." : "Save Profile Details"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: MANUAL ATTENDANCE CORRECTION */}
      {showCorrectionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl border border-brand-border bg-brand-sidebar/95 backdrop-blur-xl p-6 shadow-2xl space-y-4 hover-glow">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-brand-text">Manual Punch Adjustment</h3>
              <button 
                onClick={() => setShowCorrectionModal(false)}
                className="text-brand-muted hover:text-brand-text text-md font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
            
            {correctionMessage && (
              <p className="p-3 bg-brand-success/10 border border-brand-success/20 text-brand-success text-xs text-center rounded-xl font-bold">
                {correctionMessage}
              </p>
            )}

            <form onSubmit={handleCreateCorrection} className="space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1">Select Employee</label>
                <select
                  required
                  value={correctionForm.employee_id}
                  onChange={(e) => setCorrectionForm(p => ({ ...p, employee_id: e.target.value }))}
                  className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60"
                >
                  <option value="">Choose employee...</option>
                  {allEmployees.map(e => (
                    <option key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.employee_id})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={correctionForm.date}
                  onChange={(e) => setCorrectionForm(p => ({ ...p, date: e.target.value }))}
                  className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1">Check In Time</label>
                  <input
                    type="time"
                    required
                    value={correctionForm.check_in_time}
                    onChange={(e) => setCorrectionForm(p => ({ ...p, check_in_time: e.target.value }))}
                    className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1">Check Out Time</label>
                  <input
                    type="time"
                    required
                    value={correctionForm.check_out_time}
                    onChange={(e) => setCorrectionForm(p => ({ ...p, check_out_time: e.target.value }))}
                    className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1">Punch Status</label>
                <select
                  value={correctionForm.status}
                  onChange={(e) => setCorrectionForm(p => ({ ...p, status: e.target.value }))}
                  className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60"
                >
                  <option value="present">Present (Standard)</option>
                  <option value="late">Late Arrival</option>
                  <option value="half_day">Half Day</option>
                  <option value="absent">Absent</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-gradient-to-r from-brand-primary to-brand-secondary py-3.5 text-xs font-bold text-white shadow-lg shadow-brand-primary/20 hover:shadow-brand-primary/30 transition-all hover:scale-[1.01] active:scale-[0.99]"
              >
                Apply Punch Modification
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: ASSIGN SHIFT ROSTER */}
      {showAssignShiftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl border border-brand-border bg-brand-sidebar/95 backdrop-blur-xl p-6 shadow-2xl space-y-4 hover-glow">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-brand-text">Assign Shift Assignment</h3>
              <button 
                onClick={() => setShowAssignShiftModal(false)}
                className="text-brand-muted hover:text-brand-text text-md font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAssignShift} className="space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1">Select Employee</label>
                <select
                  required
                  value={assignShiftForm.employee_id}
                  onChange={(e) => setAssignShiftForm(p => ({ ...p, employee_id: e.target.value }))}
                  className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60"
                >
                  <option value="">Choose employee...</option>
                  {allEmployees.map(e => (
                    <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-brand-muted mb-1">Roster Shift Type</label>
                <select
                  value={assignShiftForm.shift_type}
                  onChange={(e) => setAssignShiftForm(p => ({ ...p, shift_type: e.target.value }))}
                  className="w-full rounded-xl border border-brand-border bg-brand-sidebar/55 px-3.5 py-2.5 text-brand-text outline-none focus:border-brand-primary/60"
                >
                  <option value="fixed_day">Fixed Day Shift (9AM - 5PM)</option>
                  <option value="rotational">Rotational Hours</option>
                  <option value="night">Night shift (10PM - 6AM)</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-gradient-to-r from-brand-success to-brand-success/80 py-3 text-xs font-bold text-white shadow-lg shadow-brand-success/20 hover:shadow-brand-success/30 transition-all hover:scale-[1.01] active:scale-[0.99]"
              >
                Assign Shift timing
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
