import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../models/employee.dart';
import '../models/attendance.dart';
import '../models/leave_request.dart';

class ApiService {
  static const String _baseUrlKey = 'api_base_url';
  static const String _tokenKey = 'auth_token';
  
  // Default base URL pointing to the host machine's IP (since phone is on the same local network)
  String baseUrl = 'http://127.0.0.1:8000/api/v1';
  bool useMock = false; // Always connect to real API!

  // Singleton instance
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal() {
    _loadSettings();
  }

  // Local Mock State variables for demo/fallback purposes
  late Employee _mockEmployee;
  List<Attendance> _mockAttendanceHistory = [];
  Attendance? _mockTodayAttendance;
  List<LeaveRequest> _mockLeaveRequests = [];
  Map<String, int> _mockLeaveBalances = {
    'sick': 6,
    'casual': 4,
    'earned': 14,
    'wfh': 28,
  };

  void _initializeMockData() {
    _mockEmployee = Employee(
      id: 101,
      email: 'a.sterling@hrconnect.com',
      firstName: 'Alex',
      lastName: 'Sterling',
      employeeId: 'EMP-2024-0892',
      role: 'employee',
      isActive: true,
      departmentId: 5,
      reportingManagerId: 42,
      bankName: 'Chase Manhattan',
      bankAccountNo: '**** 8829',
      salaryAmount: 8500.0,
      emergencyContact: 'Sarah Sterling (Spouse) • +1 (555) 012-3456',
    );

    // Initial leave history
    _mockLeaveRequests = [
      LeaveRequest(
        id: 1,
        employeeId: 101,
        leaveType: 'earned',
        startDate: DateTime.now().subtract(const Duration(days: 260)), // Oct 12, 2023 approx
        endDate: DateTime.now().subtract(const Duration(days: 256)),
        status: 'approved',
        reason: 'Annual Family Vacation',
      ),
      LeaveRequest(
        id: 2,
        employeeId: 101,
        leaveType: 'sick',
        startDate: DateTime.now().subtract(const Duration(days: 235)), // Nov 2, 2023 approx
        endDate: DateTime.now().subtract(const Duration(days: 235)),
        status: 'pending',
        reason: 'Dental Appointment',
      ),
      LeaveRequest(
        id: 3,
        employeeId: 101,
        leaveType: 'casual',
        startDate: DateTime.now().subtract(const Duration(days: 278)), // Sep 20, 2023 approx
        endDate: DateTime.now().subtract(const Duration(days: 277)),
        status: 'rejected',
        reason: 'Personal Emergency',
      ),
    ];

    // Initial attendance history
    _mockAttendanceHistory = [
      Attendance(
        id: 10,
        employeeId: 101,
        date: DateTime.now().subtract(const Duration(days: 1)),
        checkIn: DateTime.now().subtract(const Duration(days: 1, hours: 9)),
        checkOut: DateTime.now().subtract(const Duration(days: 1, hours: 1)),
        checkInGps: '37.7749,-122.4194',
        checkOutGps: '37.7749,-122.4194',
        wifiSsid: 'HQ_Main_5G',
        deviceInfo: 'iOS Device',
        status: 'present',
        workingHours: 8.0,
      ),
    ];
  }

  Future<void> _loadSettings() async {
    _initializeMockData();
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_baseUrlKey); // Force clear the old saved base URL
    baseUrl = 'http://127.0.0.1:8000/api/v1';
    useMock = false;
  }

  Future<void> updateBaseUrl(String newUrl) async {
    baseUrl = newUrl;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_baseUrlKey, newUrl);
    await _loadSettings();
  }

  Future<void> saveToken(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, token);
  }

  Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_tokenKey);
  }

  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
    _mockTodayAttendance = null;
  }

  Map<String, String> _headers(String? token) {
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  // --- Auth API ---
  Future<String?> login(String email, String password) async {
    if (useMock) {
      // Mock Login
      if (email == 'a.sterling@hrconnect.com' && password == 'password') {
        final token = 'mock_jwt_token_alex_sterling';
        await saveToken(token);
        return token;
      } else if (email == 'sarah@hrconnect.com') {
        // Sarah demo
        _mockEmployee = Employee(
          id: 102,
          email: 'sarah@hrconnect.com',
          firstName: 'Sarah',
          lastName: 'Sterling',
          employeeId: 'EMP-2024-0999',
          role: 'employee',
          isActive: true,
          bankName: 'Chase Manhattan',
          bankAccountNo: '**** 1122',
          salaryAmount: 9000.0,
          emergencyContact: 'Alex Sterling (Spouse) • +1 (555) 012-3456',
        );
        final token = 'mock_jwt_token_sarah';
        await saveToken(token);
        return token;
      }
      throw Exception('Incorrect email or password');
    }

    try {
      final response = await http.post(
        Uri.parse('$baseUrl/auth/login-json'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'email': email, 'password': password}),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final token = data['access_token'];
        await saveToken(token);
        return token;
      } else {
        final err = jsonDecode(response.body);
        throw Exception(err['detail'] ?? 'Failed to authenticate');
      }
    } catch (e) {
      rethrow;
    }
  }

  // --- Employee / Profile API ---
  Future<Employee> getProfile() async {
    if (useMock) {
      return _mockEmployee;
    }

    final token = await getToken();
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/employees/me'),
        headers: _headers(token),
      );

      if (response.statusCode == 200) {
        return Employee.fromJson(jsonDecode(response.body));
      } else {
        throw Exception('Failed to fetch profile');
      }
    } catch (e) {
      rethrow;
    }
  }

  Future<Employee> updateProfile(Employee profile) async {
    if (useMock) {
      _mockEmployee = profile;
      return _mockEmployee;
    }

    final token = await getToken();
    try {
      final response = await http.put(
        Uri.parse('$baseUrl/employees/${profile.id}'),
        headers: _headers(token),
        body: jsonEncode(profile.toJson()),
      );

      if (response.statusCode == 200) {
        return Employee.fromJson(jsonDecode(response.body));
      } else {
        throw Exception('Failed to update profile');
      }
    } catch (e) {
      rethrow;
    }
  }

  // --- Attendance API ---
  Future<Attendance?> getTodayAttendance() async {
    if (useMock) {
      return _mockTodayAttendance;
    }

    final token = await getToken();
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/attendance/status'),
        headers: _headers(token),
      );

      if (response.statusCode == 200) {
        final body = response.body;
        if (body == 'null' || body.isEmpty) return null;
        final data = jsonDecode(body);
        if (data == null) return null;
        _mockTodayAttendance = Attendance.fromJson(data);
        return _mockTodayAttendance;
      } else {
        return null;
      }
    } catch (e) {
      rethrow;
    }
  }

  Future<Attendance> checkIn({
    required String gps,
    required String wifiSsid,
    required String deviceInfo,
  }) async {
    if (useMock) {
      final newRecord = Attendance(
        id: DateTime.now().millisecondsSinceEpoch,
        employeeId: _mockEmployee.id,
        date: DateTime.now(),
        checkIn: DateTime.now(),
        checkInGps: gps,
        wifiSsid: wifiSsid,
        deviceInfo: deviceInfo,
        status: 'present',
        workingHours: 0.0,
      );
      _mockTodayAttendance = newRecord;
      _mockAttendanceHistory.insert(0, newRecord);
      return newRecord;
    }

    final token = await getToken();
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/attendance/check-in'),
        headers: _headers(token),
        body: jsonEncode({
          'check_in_gps': gps,
          'wifi_ssid': wifiSsid,
          'device_info': deviceInfo,
        }),
      );

      if (response.statusCode == 201) {
        final newRecord = Attendance.fromJson(jsonDecode(response.body));
        _mockTodayAttendance = newRecord;
        return newRecord;
      } else {
        final err = jsonDecode(response.body);
        throw Exception(err['detail'] ?? 'Failed to check-in');
      }
    } catch (e) {
      rethrow;
    }
  }

  Future<Attendance> checkOut({required String gps}) async {
    if (useMock) {
      if (_mockTodayAttendance == null) {
        throw Exception('Must check-in first.');
      }
      final checkOutTime = DateTime.now();
      final diff = checkOutTime.difference(_mockTodayAttendance!.checkIn!);
      final hrs = roundDouble(diff.inSeconds / 3600.0, 2);

      final updatedRecord = Attendance(
        id: _mockTodayAttendance!.id,
        employeeId: _mockTodayAttendance!.employeeId,
        date: _mockTodayAttendance!.date,
        checkIn: _mockTodayAttendance!.checkIn,
        checkOut: checkOutTime,
        checkInGps: _mockTodayAttendance!.checkInGps,
        checkOutGps: gps,
        wifiSsid: _mockTodayAttendance!.wifiSsid,
        deviceInfo: _mockTodayAttendance!.deviceInfo,
        status: _mockTodayAttendance!.status,
        workingHours: hrs,
      );
      _mockTodayAttendance = updatedRecord;

      // Update in list
      final idx = _mockAttendanceHistory.indexWhere((element) => element.id == updatedRecord.id);
      if (idx != -1) {
        _mockAttendanceHistory[idx] = updatedRecord;
      } else {
        _mockAttendanceHistory.insert(0, updatedRecord);
      }
      return updatedRecord;
    }

    final token = await getToken();
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/attendance/check-out'),
        headers: _headers(token),
        body: jsonEncode({'check_out_gps': gps}),
      );

      if (response.statusCode == 200) {
        final updatedRecord = Attendance.fromJson(jsonDecode(response.body));
        _mockTodayAttendance = updatedRecord;
        return updatedRecord;
      } else {
        final err = jsonDecode(response.body);
        throw Exception(err['detail'] ?? 'Failed to check-out');
      }
    } catch (e) {
      rethrow;
    }
  }

  Future<List<Attendance>> getAttendanceHistory() async {
    if (useMock) {
      return _mockAttendanceHistory;
    }

    final token = await getToken();
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/attendance/history'),
        headers: _headers(token),
      );

      if (response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(response.body);
        _mockAttendanceHistory = data.map((json) => Attendance.fromJson(json)).toList();
        return _mockAttendanceHistory;
      } else {
        throw Exception('Failed to fetch history');
      }
    } catch (e) {
      rethrow;
    }
  }

  // --- Leaves API ---
  Future<Map<String, int>> getLeaveBalances() async {
    if (useMock) {
      return _mockLeaveBalances;
    }

    final token = await getToken();
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/leaves/balances'),
        headers: _headers(token),
      );

      if (response.statusCode == 200) {
        final Map<String, dynamic> data = jsonDecode(response.body);
        _mockLeaveBalances = data.map((key, value) => MapEntry(key, value as int));
        return _mockLeaveBalances;
      } else {
        throw Exception('Failed to fetch leave balances');
      }
    } catch (e) {
      rethrow;
    }
  }

  Future<List<LeaveRequest>> getLeaveHistory() async {
    if (useMock) {
      return _mockLeaveRequests;
    }

    final token = await getToken();
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/leaves/my-requests'),
        headers: _headers(token),
      );

      if (response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(response.body);
        _mockLeaveRequests = data.map((json) => LeaveRequest.fromJson(json)).toList();
        return _mockLeaveRequests;
      } else {
        throw Exception('Failed to fetch leave requests');
      }
    } catch (e) {
      rethrow;
    }
  }

  Future<LeaveRequest> applyLeave({
    required String leaveType,
    required DateTime startDate,
    required DateTime endDate,
    required String reason,
  }) async {
    if (useMock) {
      final newRequest = LeaveRequest(
        id: DateTime.now().millisecondsSinceEpoch,
        employeeId: _mockEmployee.id,
        leaveType: leaveType,
        startDate: startDate,
        endDate: endDate,
        status: 'pending',
        reason: reason,
        createdAt: DateTime.now(),
      );
      _mockLeaveRequests.insert(0, newRequest);
      return newRequest;
    }

    final token = await getToken();
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/leaves/apply'),
        headers: _headers(token),
        body: jsonEncode({
          'leave_type': leaveType,
          'start_date': '${startDate.year}-${startDate.month.toString().padLeft(2, '0')}-${startDate.day.toString().padLeft(2, '0')}',
          'end_date': '${endDate.year}-${endDate.month.toString().padLeft(2, '0')}-${endDate.day.toString().padLeft(2, '0')}',
          'reason': reason,
        }),
      );

      if (response.statusCode == 201) {
        final newRequest = LeaveRequest.fromJson(jsonDecode(response.body));
        _mockLeaveRequests.insert(0, newRequest);
        return newRequest;
      } else {
        final err = jsonDecode(response.body);
        throw Exception(err['detail'] ?? 'Failed to apply leave');
      }
    } catch (e) {
      rethrow;
    }
  }

  double roundDouble(double value, int places) {
    double mod = 1.0;
    for (int i = 0; i < places; i++) {
      mod *= 10;
    }
    return ((value * mod).round().toDouble() / mod);
  }
}
