class Employee {
  final int id;
  final String email;
  final String firstName;
  final String lastName;
  final String employeeId;
  final String role; // super_admin, admin, hr, manager, employee
  final bool isActive;
  final int? companyId;
  final int? departmentId;
  final int? reportingManagerId;
  final String? bankName;
  final String? bankAccountNo;
  final double? salaryAmount;
  final String? emergencyContact;

  Employee({
    required this.id,
    required this.email,
    required this.firstName,
    required this.lastName,
    required this.employeeId,
    required this.role,
    required this.isActive,
    this.companyId,
    this.departmentId,
    this.reportingManagerId,
    this.bankName,
    this.bankAccountNo,
    this.salaryAmount,
    this.emergencyContact,
  });

  String get fullName => '$firstName $lastName';

  factory Employee.fromJson(Map<String, dynamic> json) {
    return Employee(
      id: json['id'] is int ? json['id'] : int.parse(json['id'].toString()),
      email: json['email'] ?? '',
      firstName: json['first_name'] ?? '',
      lastName: json['last_name'] ?? '',
      employeeId: json['employee_id'] ?? '',
      role: json['role'] ?? 'employee',
      isActive: json['is_active'] ?? true,
      companyId: json['company_id'],
      departmentId: json['department_id'],
      reportingManagerId: json['reporting_manager_id'],
      bankName: json['bank_name'],
      bankAccountNo: json['bank_account_no'],
      salaryAmount: json['salary_amount'] != null
          ? double.tryParse(json['salary_amount'].toString())
          : null,
      emergencyContact: json['emergency_contact'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'first_name': firstName,
      'last_name': lastName,
      'employee_id': employeeId,
      'role': role,
      'is_active': isActive,
      'company_id': companyId,
      'department_id': departmentId,
      'reporting_manager_id': reportingManagerId,
      'bank_name': bankName,
      'bank_account_no': bankAccountNo,
      'salary_amount': salaryAmount,
      'emergency_contact': emergencyContact,
    };
  }

  Employee copyWith({
    String? email,
    String? firstName,
    String? lastName,
    String? bankName,
    String? bankAccountNo,
    String? emergencyContact,
  }) {
    return Employee(
      id: id,
      email: email ?? this.email,
      firstName: firstName ?? this.firstName,
      lastName: lastName ?? this.lastName,
      employeeId: employeeId,
      role: role,
      isActive: isActive,
      companyId: companyId,
      departmentId: departmentId,
      reportingManagerId: reportingManagerId,
      bankName: bankName ?? this.bankName,
      bankAccountNo: bankAccountNo ?? this.bankAccountNo,
      salaryAmount: salaryAmount,
      emergencyContact: emergencyContact ?? this.emergencyContact,
    );
  }
}
