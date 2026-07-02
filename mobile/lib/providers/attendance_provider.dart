import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import 'package:geolocator/geolocator.dart';
import 'package:device_info_plus/device_info_plus.dart';
import '../models/attendance.dart';
import '../services/dio_client.dart';
import 'package:network_info_plus/network_info_plus.dart';
import 'auth_provider.dart';

class AttendanceState {
  final Attendance? todayAttendance;
  final List<Attendance> history;
  final bool isLoading;
  final String? errorMessage;
  
  // WFH/Remote Session details
  final bool isWfhActive;
  final int loggedSeconds;
  final List<Map<String, dynamic>> taskUpdates;
  final String dailySummary;
  
  // Wifi/GPS status flags
  final String ssid;
  final String bssid;
  final String ipAddress;
  final String location;
  final bool wifiConnected;
  final bool geofenceWithinRange;
  final bool selfieVerified;
  
  // Coordinates retrieved dynamically
  final double latitude;
  final double longitude;

  AttendanceState({
    this.todayAttendance,
    this.history = const [],
    this.isLoading = false,
    this.errorMessage,
    this.isWfhActive = false,
    this.loggedSeconds = 0,
    this.taskUpdates = const [],
    this.dailySummary = '',
    this.ssid = 'Detecting Network...',
    this.bssid = '',
    this.ipAddress = '127.0.0.1',
    this.location = 'Detecting Location...',
    this.wifiConnected = false,
    this.geofenceWithinRange = false,
    this.selfieVerified = false,
    this.latitude = 37.7749,
    this.longitude = -122.4194,
  });

  AttendanceState copyWith({
    Attendance? todayAttendance,
    bool clearTodayAttendance = false,
    List<Attendance>? history,
    bool? isLoading,
    String? errorMessage,
    bool? isWfhActive,
    int? loggedSeconds,
    List<Map<String, dynamic>>? taskUpdates,
    String? dailySummary,
    String? ssid,
    String? bssid,
    String? ipAddress,
    String? location,
    bool? wifiConnected,
    bool? geofenceWithinRange,
    bool? selfieVerified,
    double? latitude,
    double? longitude,
  }) {
    return AttendanceState(
      todayAttendance: clearTodayAttendance ? null : (todayAttendance ?? this.todayAttendance),
      history: history ?? this.history,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage,
      isWfhActive: isWfhActive ?? this.isWfhActive,
      loggedSeconds: loggedSeconds ?? this.loggedSeconds,
      taskUpdates: taskUpdates ?? this.taskUpdates,
      dailySummary: dailySummary ?? this.dailySummary,
      ssid: ssid ?? this.ssid,
      bssid: bssid ?? this.bssid,
      ipAddress: ipAddress ?? this.ipAddress,
      location: location ?? this.location,
      wifiConnected: wifiConnected ?? this.wifiConnected,
      geofenceWithinRange: geofenceWithinRange ?? this.geofenceWithinRange,
      selfieVerified: selfieVerified ?? this.selfieVerified,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
    );
  }
}

class AttendanceNotifier extends StateNotifier<AttendanceState> {
  final Ref ref;
  final DioClient _dioClient = DioClient();
  Timer? _wfhTimer;
  String? _deviceId;
  StreamSubscription<ServiceStatus>? _serviceStatusSubscription;

  AttendanceNotifier(this.ref) : super(AttendanceState()) {
    _initDeviceAndFetch();
    
    // Re-verify geofence when company context changes or user logs in
    ref.listen<AuthState>(authProvider, (previous, next) {
      if (next.employee?.companyId != null && 
          next.employee?.companyId != previous?.employee?.companyId) {
        fetchRealLocationAndIP();
      }
    });

    _serviceStatusSubscription = Geolocator.getServiceStatusStream().listen((ServiceStatus status) {
      fetchRealLocationAndIP();
    });
  }

  /// Fetch real device ID first, then load location + attendance
  Future<void> _initDeviceAndFetch() async {
    _deviceId = await _getRealDeviceId();
    await fetchRealLocationAndIP();
    fetchTodayAttendance();
    fetchAttendanceHistory();
  }

  /// Returns a stable unique hardware identifier for this device
  Future<String> _getRealDeviceId() async {
    try {
      final deviceInfo = DeviceInfoPlugin();
      if (Platform.isAndroid) {
        final info = await deviceInfo.androidInfo;
        return info.id; // Android hardware ID (stable across reboots)
      } else if (Platform.isIOS) {
        final info = await deviceInfo.iosInfo;
        return info.identifierForVendor ?? 'unknown-ios';
      }
    } catch (e) {
      print('Failed to get device ID: $e');
    }
    return 'unknown-device';
  }

  @override
  void dispose() {
    _wfhTimer?.cancel();
    _serviceStatusSubscription?.cancel();
    super.dispose();
  }

  Future<void> _fetchNetworkInfoInBackground() async {
    String? localBssid;
    try {
      final info = NetworkInfo();
      localBssid = await info.getWifiBSSID();
    } catch (e) {
      print('Failed to get BSSID: $e');
    }

    try {
      final response = await Dio().get('https://ipwho.is/').timeout(const Duration(seconds: 4));
      final data = response.data;
      if (data != null && data['success'] == true) {
        final String ip = data['ip']?.toString() ?? '';
        final String org = data['connection']?['isp']?.toString() ?? 'ISP Network';
        state = state.copyWith(
          ipAddress: ip,
          ssid: org,
          bssid: localBssid ?? '',
          wifiConnected: true,
        );
      } else {
        if (localBssid != null) {
          state = state.copyWith(
            bssid: localBssid,
            wifiConnected: true,
          );
        }
      }
    } catch (_) {
      if (localBssid != null) {
        state = state.copyWith(
          bssid: localBssid,
          wifiConnected: true,
        );
      }
    }
  }

  Future<void> fetchRealLocationAndIP() async {
    bool serviceEnabled;
    LocationPermission permission;

    // Try to get network details (SSID/BSSID) regardless of GPS status
    await _fetchNetworkInfoInBackground();

    try {
      // Check if location services are enabled
      serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        state = state.copyWith(
          location: 'GPS Disabled',
          geofenceWithinRange: false,
        );
        return;
      }

      permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
        state = state.copyWith(
          location: 'Permission Denied',
          geofenceWithinRange: false,
        );
        return;
      }

      if (permission == LocationPermission.whileInUse ||
          permission == LocationPermission.always) {
        final Position position = await Geolocator.getCurrentPosition(
          desiredAccuracy: LocationAccuracy.high,
          timeLimit: const Duration(seconds: 5),
        );

        state = state.copyWith(
          latitude: position.latitude,
          longitude: position.longitude,
          location: 'GPS: ${position.latitude.toStringAsFixed(4)}, ${position.longitude.toStringAsFixed(4)}',
        );
        await _checkGeofence(position.latitude, position.longitude, state.bssid);
        return;
      }
    } catch (e) {
      print('Geolocator failed: $e');
      state = state.copyWith(
        location: 'Failed to get GPS location',
        geofenceWithinRange: false,
      );
    }
  }

  /// Active check that prompts for GPS/location settings and permissions when button is pressed
  Future<bool> ensureLocationEnabledAndPermitted() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      state = state.copyWith(
        location: 'GPS Disabled (Enable Location Services)',
        geofenceWithinRange: false,
      );
      // Prompt user by opening the OS location settings screen
      await Geolocator.openLocationSettings();
      return false;
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        state = state.copyWith(
          location: 'Permission Denied',
          geofenceWithinRange: false,
        );
        return false;
      }
    }

    if (permission == LocationPermission.deniedForever) {
      state = state.copyWith(
        location: 'Permission Denied Forever (Enable in App Settings)',
        geofenceWithinRange: false,
      );
      // Direct the user to the App Settings page to manually enable location permissions
      await Geolocator.openAppSettings();
      return false;
    }

    // Permissions and GPS are active! Fetch current coordinates
    try {
      final Position position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 5),
      );

      state = state.copyWith(
        latitude: position.latitude,
        longitude: position.longitude,
        location: 'GPS: ${position.latitude.toStringAsFixed(4)}, ${position.longitude.toStringAsFixed(4)}',
      );
      await _checkGeofence(position.latitude, position.longitude, state.bssid);
      return true;
    } catch (e) {
      print('GPS Fetch failed: $e');
      state = state.copyWith(
        location: 'Failed to get GPS location',
        geofenceWithinRange: false,
      );
      return false;
    }
  }

  void startWfhTimer() {
    _wfhTimer?.cancel();
    _wfhTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      state = state.copyWith(loggedSeconds: state.loggedSeconds + 1);
    });
  }

  void stopWfhTimer() {
    _wfhTimer?.cancel();
  }

  void toggleWfhActive(bool active) {
    if (active) {
      startWfhTimer();
    } else {
      stopWfhTimer();
    }
    state = state.copyWith(isWfhActive: active);
  }

  Future<void> fetchTodayAttendance() async {
    state = state.copyWith(isLoading: true);
    try {
      final response = await _dioClient.dio.get('/attendance/status');
      if (response.data == null) {
        state = state.copyWith(
          todayAttendance: null, 
          clearTodayAttendance: true, 
          isLoading: false,
          loggedSeconds: 0,
          taskUpdates: const [],
          dailySummary: '',
        );
      } else {
        final attendance = Attendance.fromJson(response.data);
        final bool isWfh = attendance.status == 'wfh' && attendance.checkOut == null;
        
        // Compute real elapsed seconds
        int elapsedSecs = 0;
        if (attendance.checkIn != null) {
          if (attendance.checkOut != null) {
            elapsedSecs = (attendance.workingHours * 3600).toInt();
          } else {
            elapsedSecs = DateTime.now().difference(attendance.checkIn!.toLocal()).inSeconds;
          }
        }

        // Decode task updates
        List<Map<String, dynamic>> parsedTasks = [];
        if (attendance.taskUpdates != null && attendance.taskUpdates!.isNotEmpty) {
          try {
            final List<dynamic> decoded = jsonDecode(attendance.taskUpdates!);
            parsedTasks = decoded.map((e) => Map<String, dynamic>.from(e)).toList();
          } catch (e) {
            print('Error decoding task updates: $e');
          }
        }

        state = state.copyWith(
          todayAttendance: attendance,
          isLoading: false,
          isWfhActive: isWfh,
          loggedSeconds: elapsedSecs,
          taskUpdates: parsedTasks,
          dailySummary: attendance.dailySummary ?? '',
        );
        
        if (isWfh) {
          startWfhTimer();
        }
      }
    } catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: 'Failed to fetch status');
    }
  }

  Future<void> fetchAttendanceHistory() async {
    try {
      final response = await _dioClient.dio.get('/attendance/history');
      final List<dynamic> data = response.data;
      final history = data.map((json) => Attendance.fromJson(json)).toList();
      state = state.copyWith(history: history);
    } catch (e) {
      print('Error fetching history: $e');
    }
  }

  Future<void> checkIn({required bool wfh}) async {
    state = state.copyWith(isLoading: true);
    await fetchRealLocationAndIP();
    try {
      final response = await _dioClient.dio.post(
        '/attendance/check-in',
        data: {
          'check_in_gps': '${state.latitude},${state.longitude}',
          'wifi_ssid': state.ssid,
          'wifi_bssid': state.bssid,
          'device_info': 'Mobile Phone App',
          'device_id': _deviceId,       // unique hardware device ID
          'status': wfh ? 'wfh' : 'present',
        },
      );
      
      final record = Attendance.fromJson(response.data);
      
      state = state.copyWith(
        todayAttendance: record,
        isLoading: false,
        isWfhActive: wfh,
        loggedSeconds: 0,
        taskUpdates: const [],
        dailySummary: '',
      );
      
      if (wfh) {
        startWfhTimer();
      }
      fetchAttendanceHistory();
    } on DioException catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: e.error.toString());
      rethrow;
    }
  }

  Future<void> checkOut() async {
    if (state.todayAttendance == null) return;
    state = state.copyWith(isLoading: true);
    await fetchRealLocationAndIP();

    final String tasksJson = jsonEncode(state.taskUpdates);

    try {
      final response = await _dioClient.dio.post(
        '/attendance/check-out',
        data: {
          'check_out_gps': '${state.latitude},${state.longitude}',
          'wifi_bssid': state.bssid,
          'device_id': _deviceId,       // must match check-in device
          'task_updates': tasksJson,
          'daily_summary': state.dailySummary,
        },
      );
      final record = Attendance.fromJson(response.data);
      
      stopWfhTimer();
      
      state = state.copyWith(
        todayAttendance: record,
        isLoading: false,
        isWfhActive: false,
      );
      fetchAttendanceHistory();
    } on DioException catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: e.error.toString());
      rethrow;
    }
  }

  void toggleTask(int index) {
    final list = List<Map<String, dynamic>>.from(state.taskUpdates);
    list[index]['completed'] = !list[index]['completed'];
    state = state.copyWith(taskUpdates: list);
  }

  void addTask(String title) {
    final list = List<Map<String, dynamic>>.from(state.taskUpdates);
    list.add({'title': title, 'completed': false});
    state = state.copyWith(taskUpdates: list);
  }

  void saveDailySummary(String text) {
    state = state.copyWith(dailySummary: text);
  }

  Future<void> _checkGeofence(double userLat, double userLon, String currentBssid) async {
    try {
      final user = ref.read(authProvider).employee;
      if (user == null || user.companyId == null) {
        state = state.copyWith(geofenceWithinRange: true);
        return;
      }

      final response = await _dioClient.dio.get('/companies/${user.companyId}');
      final companyData = response.data;
      if (companyData == null) {
        state = state.copyWith(geofenceWithinRange: true);
        return;
      }

      // 1. Check secure WiFi BSSIDs first
      final String allowedBssidsStr = companyData['allowed_wifi_bssids'] ?? '';
      final List<String> allowedBssids = allowedBssidsStr
          .split(',')
          .map((b) => b.trim().toLowerCase())
          .where((b) => b.isNotEmpty)
          .toList();

      final String deviceBssid = currentBssid.trim().toLowerCase();
      if (deviceBssid.isNotEmpty && allowedBssids.isNotEmpty) {
        if (allowedBssids.any((b) => deviceBssid.contains(b))) {
          print('BSSID match verified: $deviceBssid');
          state = state.copyWith(geofenceWithinRange: true);
          return;
        }
      }

      // 2. Fall back to GPS Distance calculation
      final double officeLat = companyData['office_latitude'] ?? 28.6252;
      final double officeLon = companyData['office_longitude'] ?? 77.3736;
      final double maxDist = companyData['max_distance_meters'] ?? 200.0;

      // Calculate distance using Haversine formula
      const R = 6371000.0; // Earth's radius in meters
      final phi1 = officeLat * math.pi / 180.0;
      final phi2 = userLat * math.pi / 180.0;
      final deltaPhi = (userLat - officeLat) * math.pi / 180.0;
      final deltaLon = (userLon - officeLon) * math.pi / 180.0;

      final a = math.sin(deltaPhi / 2) * math.sin(deltaPhi / 2) +
          math.cos(phi1) * math.cos(phi2) *
              math.sin(deltaLon / 2) * math.sin(deltaLon / 2);
      final c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
      final double distance = R * c;

      print('[GEOFENCE CLIENT DEBUG] Distance: ${distance.toInt()}m, Limit: ${maxDist.toInt()}m');
      state = state.copyWith(
        geofenceWithinRange: distance <= maxDist,
      );
    } catch (e) {
      print('Geofence check failed: $e');
      state = state.copyWith(geofenceWithinRange: true);
    }
  }
}

final attendanceProvider = StateNotifierProvider<AttendanceNotifier, AttendanceState>((ref) {
  return AttendanceNotifier(ref);
});

