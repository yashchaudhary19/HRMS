const getApiBaseUrl = () => {
  if (typeof window !== "undefined") {
    if (process.env.NEXT_PUBLIC_API_URL) {
      return process.env.NEXT_PUBLIC_API_URL;
    }
    const hostname = window.location.hostname;
    // If accessing from a local network IP (e.g. 192.168.x.x), connect to the backend on the same IP
    if (hostname !== "localhost" && hostname !== "127.0.0.1" && !hostname.endsWith(".local")) {
      return `http://${hostname}:8000/api/v1`;
    }
  }
  return "https://hrms-lg07.onrender.com/api/v1";
};

const API_BASE_URL = getApiBaseUrl();


export function getToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem("hrms_token");
  }
  return null;
}

export function setToken(token: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem("hrms_token", token);
  }
}

export function removeToken() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("hrms_token");
  }
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers = new Headers(options.headers || {});
  
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  
  // Default JSON content-type if not uploading form data
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = "API Request failed";
    try {
      const errJson = await response.json();
      errorDetail = errJson.detail || errorDetail;
    } catch {
      // Ignore parser errors
    }
    throw new Error(errorDetail);
  }

  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export const api = {
  auth: {
    login: async (username: string, password: string) => {
      // Standard OAuth2 form request
      const formData = new FormData();
      formData.append("username", username);
      formData.append("password", password);
      
      const res = await apiFetch("/auth/login", {
        method: "POST",
        body: formData,
      });
      setToken(res.access_token);
      return res;
    },
    loginJson: async (payload: any) => {
      const res = await apiFetch("/auth/login-json", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setToken(res.access_token);
      return res;
    },
    registerAdmin: async (payload: any) => {
      return apiFetch("/auth/register-admin", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    logout: () => {
      removeToken();
    }
  },
  employees: {
    getMe: async () => {
      return apiFetch("/employees/me");
    },
    list: async (departmentId?: number, managerId?: number) => {
      let url = "/employees/";
      const params = new URLSearchParams();
      if (departmentId) params.append("department_id", String(departmentId));
      if (managerId) params.append("manager_id", String(managerId));
      const search = params.toString();
      if (search) url += `?${search}`;
      return apiFetch(url);
    },
    create: async (payload: any) => {
      return apiFetch("/employees/", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    update: async (id: number, payload: any) => {
      return apiFetch(`/employees/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    }
  },
  attendance: {
    getStatus: async () => {
      return apiFetch("/attendance/status");
    },
    checkIn: async (payload: { check_in_gps?: string; wifi_ssid?: string; device_info?: string }) => {
      return apiFetch("/attendance/check-in", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    checkOut: async (payload: { check_out_gps?: string }) => {
      return apiFetch("/attendance/check-out", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    getHistory: async (employeeId?: number) => {
      let url = "/attendance/history";
      if (employeeId) url += `?employee_id=${employeeId}`;
      return apiFetch(url);
    }
  },
  leaves: {
    apply: async (payload: { leave_type: string; start_date: string; end_date: string; reason?: string }) => {
      return apiFetch("/leaves/apply", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    getMyRequests: async () => {
      return apiFetch("/leaves/my-requests");
    },
    getBalances: async () => {
      return apiFetch("/leaves/balances");
    },
    getPending: async () => {
      return apiFetch("/leaves/pending");
    },
    updateStatus: async (leaveId: number, status: string) => {
      return apiFetch(`/leaves/${leaveId}/status`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
    }
  },
  salary: {
    getMySlips: async () => {
      return apiFetch("/salary/slips");
    },
    getMyHistory: async () => {
      return apiFetch("/salary/history");
    },
    listAll: async (employeeId?: number) => {
      let url = "/salary/all";
      if (employeeId) url += `?employee_id=${employeeId}`;
      return apiFetch(url);
    },
    issue: async (payload: {
      employee_id: number;
      month: string;
      payout_date: string;
      status?: string;
      gross_salary: number;
      base_salary: number;
      bonus?: number;
      federal_tax?: number;
      health_insurance?: number;
      retirement_contribution?: number;
    }) => {
      return apiFetch("/salary/issue", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    updateStatus: async (slipId: number, status: string) => {
      return apiFetch(`/salary/${slipId}/status?new_status=${encodeURIComponent(status)}`, {
        method: "PUT",
      });
    },
    delete: async (slipId: number) => {
      return apiFetch(`/salary/${slipId}`, {
        method: "DELETE",
      });
    }
  },
  companies: {
    list: async () => {
      return apiFetch("/companies/");
    },
    create: async (payload: { name: string; address?: string }) => {
      return apiFetch("/companies/", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    update: async (companyId: number, payload: {
      name?: string;
      address?: string;
      office_latitude?: number;
      office_longitude?: number;
      allowed_wifi_ssids?: string;
      max_distance_meters?: number;
    }) => {
      return apiFetch(`/companies/${companyId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    }
  },
  departments: {
    list: async () => {
      return apiFetch("/departments/");
    },
    create: async (payload: { name: string; company_id: number }) => {
      return apiFetch("/departments/", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }
  },
  dashboard: {
    getAnnouncements: async () => {
      return apiFetch("/dashboard/announcements");
    },
    createAnnouncement: async (payload: { title: string; content: string; tag?: string; is_urgent?: boolean }) => {
      return apiFetch("/dashboard/announcements", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    deleteAnnouncement: async (id: number) => {
      return apiFetch(`/dashboard/announcements/${id}`, {
        method: "DELETE",
      });
    },
    getHolidays: async () => {
      return apiFetch("/dashboard/holidays");
    },
    createHoliday: async (payload: { title: string; date: string; day_name?: string; holiday_type?: string }) => {
      return apiFetch("/dashboard/holidays", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    deleteHoliday: async (id: number) => {
      return apiFetch(`/dashboard/holidays/${id}`, {
        method: "DELETE",
      });
    }
  },
  admins: {
    list: async () => {
      return apiFetch("/admins/");
    },
    create: async (payload: any) => {
      return apiFetch("/admins/", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    update: async (id: number, payload: any) => {
      return apiFetch(`/admins/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    },
    toggleSuspension: async (id: number) => {
      return apiFetch(`/admins/${id}/suspend`, {
        method: "POST",
      });
    },
    updateSubscription: async (id: number, payload: { subscription_plan?: string; is_active?: boolean }) => {
      return apiFetch(`/admins/${id}/subscription`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    },
    getStats: async (id: number) => {
      return apiFetch(`/admins/${id}/stats`);
    }
  },
  helpdesk: {
    listAll: async () => {
      return apiFetch("/helpdesk/tickets/all");
    },
    update: async (ticketId: number, payload: { status?: string; assigned_to?: string; last_message?: string }) => {
      return apiFetch(`/helpdesk/tickets/${ticketId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    }
  }
};
