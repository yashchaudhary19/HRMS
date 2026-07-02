class HelpTicket {
  final int id;
  final String ticketNo; // e.g. "TK-8821"
  final int employeeId;
  final String category; // payroll, benefits, it_tech, policy
  final String title;
  final String description;
  final String status; // open, pending, resolved
  final String? lastMessage;
  final String? assignedTo;
  final DateTime? closedAt;
  final DateTime createdAt;

  HelpTicket({
    required this.id,
    required this.ticketNo,
    required this.employeeId,
    required this.category,
    required this.title,
    required this.description,
    required this.status,
    this.lastMessage,
    this.assignedTo,
    this.closedAt,
    required this.createdAt,
  });

  factory HelpTicket.fromJson(Map<String, dynamic> json) {
    return HelpTicket(
      id: json['id'] is int ? json['id'] : int.parse(json['id'].toString()),
      ticketNo: json['ticket_no'] ?? '',
      employeeId: json['employee_id'] is int
          ? json['employee_id']
          : int.parse(json['employee_id'].toString()),
      category: json['category'] ?? 'payroll',
      title: json['title'] ?? '',
      description: json['description'] ?? '',
      status: json['status'] ?? 'open',
      lastMessage: json['last_message'],
      assignedTo: json['assigned_to'],
      closedAt: json['closed_at'] != null ? DateTime.parse(json['closed_at'].toString()) : null,
      createdAt: DateTime.parse(json['created_at'].toString()),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'ticket_no': ticketNo,
      'employee_id': employeeId,
      'category': category,
      'title': title,
      'description': description,
      'status': status,
      'last_message': lastMessage,
      'assigned_to': assignedTo,
      'closed_at': closedAt?.toIso8601String(),
      'created_at': createdAt.toIso8601String(),
    };
  }
}
