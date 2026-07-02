class LeaveRequest {
  final int id;
  final int employeeId;
  final String leaveType; // casual, sick, earned, maternity, paternity, wfh, half_day
  final DateTime startDate;
  final DateTime endDate;
  final String status; // pending, approved, rejected
  final String? reason;
  final int? approvedById;
  final DateTime? createdAt;

  LeaveRequest({
    required this.id,
    required this.employeeId,
    required this.leaveType,
    required this.startDate,
    required this.endDate,
    required this.status,
    this.reason,
    this.approvedById,
    this.createdAt,
  });

  int get workingDays {
    return endDate.difference(startDate).inDays + 1;
  }

  factory LeaveRequest.fromJson(Map<String, dynamic> json) {
    return LeaveRequest(
      id: json['id'] is int ? json['id'] : int.parse(json['id'].toString()),
      employeeId: json['employee_id'] is int
          ? json['employee_id']
          : int.parse(json['employee_id'].toString()),
      leaveType: json['leave_type'] ?? 'casual',
      startDate: DateTime.parse(json['start_date'].toString()),
      endDate: DateTime.parse(json['end_date'].toString()),
      status: json['status'] ?? 'pending',
      reason: json['reason'],
      approvedById: json['approved_by_id'],
      createdAt: json['created_at'] != null ? DateTime.parse(json['created_at'].toString()) : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'employee_id': employeeId,
      'leave_type': leaveType,
      'start_date': '${startDate.year}-${startDate.month.toString().padLeft(2, '0')}-${startDate.day.toString().padLeft(2, '0')}',
      'end_date': '${endDate.year}-${endDate.month.toString().padLeft(2, '0')}-${endDate.day.toString().padLeft(2, '0')}',
      'status': status,
      'reason': reason,
      'approved_by_id': approvedById,
      'created_at': createdAt?.toIso8601String(),
    };
  }
}
