import 'package:flutter_test/flutter_test.dart';
import 'package:hrconnect/models/employee.dart';
import 'package:hrconnect/models/attendance.dart';
import 'package:hrconnect/models/leave_request.dart';

void main() {
  group('HR Connect Model Tests', () {
    test('Employee parsing test', () {
      final json = {
        'id': 101,
        'email': 'a.sterling@hrconnect.com',
        'first_name': 'Alex',
        'last_name': 'Sterling',
        'employee_id': 'EMP-2024-0892',
        'role': 'employee',
        'is_active': true,
        'bank_name': 'Chase Manhattan',
        'bank_account_no': '**** 8829',
        'salary_amount': 8500.0,
        'emergency_contact': 'Sarah Sterling',
      };

      final employee = Employee.fromJson(json);

      expect(employee.id, 101);
      expect(employee.fullName, 'Alex Sterling');
      expect(employee.role, 'employee');
      expect(employee.salaryAmount, 8500.0);
    });

    test('Attendance parsing test', () {
      final json = {
        'id': 10,
        'employee_id': 101,
        'date': '2026-06-25',
        'check_in': '2026-06-25T09:12:00.000Z',
        'status': 'present',
        'working_hours': 6.5,
      };

      final attendance = Attendance.fromJson(json);

      expect(attendance.id, 10);
      expect(attendance.employeeId, 101);
      expect(attendance.status, 'present');
      expect(attendance.workingHours, 6.5);
      expect(attendance.checkIn, isNotNull);
    });

    test('LeaveRequest parsing test', () {
      final json = {
        'id': 1,
        'employee_id': 101,
        'leave_type': 'earned',
        'start_date': '2026-10-12',
        'end_date': '2026-10-16',
        'status': 'approved',
        'reason': 'Annual Vacation',
      };

      final request = LeaveRequest.fromJson(json);

      expect(request.id, 1);
      expect(request.workingDays, 5);
      expect(request.status, 'approved');
      expect(request.leaveType, 'earned');
    });
  });
}
