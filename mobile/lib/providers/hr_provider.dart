import 'package:flutter/material.dart';
import '../models/attendance.dart';
import '../models/leave_request.dart';
import '../services/api_service.dart';

class HRProvider with ChangeNotifier {
  final ApiService _apiService = ApiService();

  Attendance? _todayAttendance;
  List<Attendance> _attendanceHistory = [];
  Map<String, int> _leaveBalances = {};
  List<LeaveRequest> _leaveHistory = [];
  
  bool _isLoadingAttendance = false;
  bool _isLoadingLeaves = false;

  Attendance? get todayAttendance => _todayAttendance;
  List<Attendance> get attendanceHistory => _attendanceHistory;
  Map<String, int> get leaveBalances => _leaveBalances;
  List<LeaveRequest> get leaveHistory => _leaveHistory;
  
  bool get isLoadingAttendance => _isLoadingAttendance;
  bool get isLoadingLeaves => _isLoadingLeaves;

  // SSID and location details simulation for check-in
  String ssid = 'HQ_Main_5G';
  String ipAddress = '192.168.10.244';
  String checkInLocation = 'San Francisco, CA';
  bool wifiConnected = true;
  bool geofenceWithinRange = true;
  bool selfieVerified = false;

  Future<void> fetchAllData() async {
    await fetchTodayAttendance();
    await fetchAttendanceHistory();
    await fetchLeaveBalances();
    await fetchLeaveHistory();
  }

  Future<void> fetchTodayAttendance() async {
    _isLoadingAttendance = true;
    notifyListeners();
    try {
      _todayAttendance = await _apiService.getTodayAttendance();
    } catch (e) {
      print('Error fetching today attendance: $e');
    } finally {
      _isLoadingAttendance = false;
      notifyListeners();
    }
  }

  Future<void> fetchAttendanceHistory() async {
    try {
      _attendanceHistory = await _apiService.getAttendanceHistory();
      notifyListeners();
    } catch (e) {
      print('Error fetching attendance history: $e');
    }
  }

  Future<void> checkIn() async {
    if (!wifiConnected || !geofenceWithinRange) {
      throw Exception('Cannot check in. Ensure you are connected to Office Wi-Fi and within Geofence range.');
    }
    
    _isLoadingAttendance = true;
    notifyListeners();

    try {
      final record = await _apiService.checkIn(
        gps: '37.7749,-122.4194', // HQ GPS Coordinates
        wifiSsid: ssid,
        deviceInfo: 'Mobile Phone App',
      );
      _todayAttendance = record;
      await fetchAttendanceHistory();
    } catch (e) {
      rethrow;
    } finally {
      _isLoadingAttendance = false;
      notifyListeners();
    }
  }

  Future<void> checkOut() async {
    if (_todayAttendance == null) {
      throw Exception('No check-in record found for today.');
    }

    _isLoadingAttendance = true;
    notifyListeners();

    try {
      final record = await _apiService.checkOut(gps: '37.7749,-122.4194');
      _todayAttendance = record;
      await fetchAttendanceHistory();
    } catch (e) {
      rethrow;
    } finally {
      _isLoadingAttendance = false;
      notifyListeners();
    }
  }

  Future<void> fetchLeaveBalances() async {
    _isLoadingLeaves = true;
    notifyListeners();
    try {
      _leaveBalances = await _apiService.getLeaveBalances();
    } catch (e) {
      print('Error fetching leave balances: $e');
    } finally {
      _isLoadingLeaves = false;
      notifyListeners();
    }
  }

  Future<void> fetchLeaveHistory() async {
    _isLoadingLeaves = true;
    notifyListeners();
    try {
      _leaveHistory = await _apiService.getLeaveHistory();
    } catch (e) {
      print('Error fetching leave requests: $e');
    } finally {
      _isLoadingLeaves = false;
      notifyListeners();
    }
  }

  Future<void> applyLeave({
    required String leaveType,
    required DateTime startDate,
    required DateTime endDate,
    required String reason,
  }) async {
    _isLoadingLeaves = true;
    notifyListeners();

    try {
      await _apiService.applyLeave(
        leaveType: leaveType,
        startDate: startDate,
        endDate: endDate,
        reason: reason,
      );
      await fetchLeaveBalances();
      await fetchLeaveHistory();
    } catch (e) {
      rethrow;
    } finally {
      _isLoadingLeaves = false;
      notifyListeners();
    }
  }

  void toggleSelfieVerification() {
    selfieVerified = !selfieVerified;
    notifyListeners();
  }
}
