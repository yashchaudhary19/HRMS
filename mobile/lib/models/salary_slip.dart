class SalarySlip {
  final int id;
  final int employeeId;
  final String month; // e.g. "May 2024"
  final DateTime payoutDate;
  final String status; // processing, paid, pending
  
  final double grossSalary;
  final double totalDeductions;
  final double netPayout;
  
  final double baseSalary;
  final double bonus;
  final double federalTax;
  final double healthInsurance;
  final double retirementContribution;
  
  final String pdfSize;
  final DateTime createdAt;

  SalarySlip({
    required this.id,
    required this.employeeId,
    required this.month,
    required this.payoutDate,
    required this.status,
    required this.grossSalary,
    required this.totalDeductions,
    required this.netPayout,
    required this.baseSalary,
    required this.bonus,
    required this.federalTax,
    required this.healthInsurance,
    required this.retirementContribution,
    required this.pdfSize,
    required this.createdAt,
  });

  factory SalarySlip.fromJson(Map<String, dynamic> json) {
    return SalarySlip(
      id: json['id'] is int ? json['id'] : int.parse(json['id'].toString()),
      employeeId: json['employee_id'] is int
          ? json['employee_id']
          : int.parse(json['employee_id'].toString()),
      month: json['month'] ?? '',
      payoutDate: DateTime.parse(json['payout_date'].toString()),
      status: json['status'] ?? 'pending',
      grossSalary: double.parse(json['gross_salary'].toString()),
      totalDeductions: double.parse(json['total_deductions'].toString()),
      netPayout: double.parse(json['net_payout'].toString()),
      baseSalary: double.parse(json['base_salary'].toString()),
      bonus: double.parse(json['bonus'].toString()),
      federalTax: double.parse(json['federal_tax'].toString()),
      healthInsurance: double.parse(json['health_insurance'].toString()),
      retirementContribution: double.parse(json['retirement_contribution'].toString()),
      pdfSize: json['pdf_size'] ?? '1.1 MB',
      createdAt: json['created_at'] != null ? DateTime.parse(json['created_at'].toString()) : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'employee_id': employeeId,
      'month': month,
      'payout_date': '${payoutDate.year}-${payoutDate.month.toString().padLeft(2, '0')}-${payoutDate.day.toString().padLeft(2, '0')}',
      'status': status,
      'gross_salary': grossSalary,
      'total_deductions': totalDeductions,
      'net_payout': netPayout,
      'base_salary': baseSalary,
      'bonus': bonus,
      'federal_tax': federalTax,
      'health_insurance': healthInsurance,
      'retirement_contribution': retirementContribution,
      'pdf_size': pdfSize,
      'created_at': createdAt.toIso8601String(),
    };
  }
}
