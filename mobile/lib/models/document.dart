class DocumentRecord {
  final int id;
  final int employeeId;
  final String filename;
  final String detail;
  final DateTime createdAt;

  DocumentRecord({
    required this.id,
    required this.employeeId,
    required this.filename,
    required this.detail,
    required this.createdAt,
  });

  factory DocumentRecord.fromJson(Map<String, dynamic> json) {
    return DocumentRecord(
      id: json['id'] is int ? json['id'] : int.parse(json['id'].toString()),
      employeeId: json['employee_id'] is int ? json['employee_id'] : int.parse(json['employee_id'].toString()),
      filename: json['filename'] ?? '',
      detail: json['detail'] ?? '',
      createdAt: DateTime.parse(json['created_at'].toString()),
    );
  }
}
