class Attendance {
  final int id;
  final int employeeId;
  final DateTime date;
  final DateTime? checkIn;
  final DateTime? checkOut;
  final String? checkInGps;
  final String? checkOutGps;
  final String? wifiSsid;
  final String? deviceInfo;
  final String status;
  final double workingHours;
  final String? taskUpdates;
  final String? dailySummary;

  Attendance({
    required this.id,
    required this.employeeId,
    required this.date,
    this.checkIn,
    this.checkOut,
    this.checkInGps,
    this.checkOutGps,
    this.wifiSsid,
    this.deviceInfo,
    required this.status,
    required this.workingHours,
    this.taskUpdates,
    this.dailySummary,
  });

  static DateTime? _parseUtc(String? val) {
    if (val == null) return null;
    // Force UTC parsing if the timezone offset is missing
    if (!val.endsWith('Z') && !val.contains('+')) {
      return DateTime.parse('${val}Z');
    }
    return DateTime.parse(val);
  }

  factory Attendance.fromJson(Map<String, dynamic> json) {
    return Attendance(
      id: json['id'] is int ? json['id'] : int.parse(json['id'].toString()),
      employeeId: json['employee_id'] is int
          ? json['employee_id']
          : int.parse(json['employee_id'].toString()),
      date: json['date'] != null ? DateTime.parse(json['date'].toString()) : DateTime.now(),
      checkIn: _parseUtc(json['check_in']?.toString()),
      checkOut: _parseUtc(json['check_out']?.toString()),
      checkInGps: json['check_in_gps'],
      checkOutGps: json['check_out_gps'],
      wifiSsid: json['wifi_ssid'],
      deviceInfo: json['device_info'],
      status: json['status'] ?? 'absent',
      workingHours: json['working_hours'] != null
          ? double.parse(json['working_hours'].toString())
          : 0.0,
      taskUpdates: json['task_updates'],
      dailySummary: json['daily_summary'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'employee_id': employeeId,
      'date': '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}',
      'check_in': checkIn?.toIso8601String(),
      'check_out': checkOut?.toIso8601String(),
      'check_in_gps': checkInGps,
      'check_out_gps': checkOutGps,
      'wifi_ssid': wifiSsid,
      'device_info': deviceInfo,
      'status': status,
      'working_hours': workingHours,
      'task_updates': taskUpdates,
      'daily_summary': dailySummary,
    };
  }
}
