import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import '../models/leave_request.dart';
import '../services/dio_client.dart';

class LeaveState {
  final Map<String, int> balances;
  final List<LeaveRequest> history;
  final bool isLoading;
  final String? errorMessage;

  LeaveState({
    this.balances = const {},
    this.history = const [],
    this.isLoading = false,
    this.errorMessage,
  });

  LeaveState copyWith({
    Map<String, int>? balances,
    List<LeaveRequest>? history,
    bool? isLoading,
    String? errorMessage,
  }) {
    return LeaveState(
      balances: balances ?? this.balances,
      history: history ?? this.history,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage,
    );
  }
}

class LeaveNotifier extends StateNotifier<LeaveState> {
  final DioClient _dioClient = DioClient();

  LeaveNotifier() : super(LeaveState()) {
    fetchBalances();
    fetchHistory();
  }

  Future<void> fetchBalances() async {
    state = state.copyWith(isLoading: true);
    try {
      final response = await _dioClient.dio.get('/leaves/balances');
      final Map<String, dynamic> data = response.data;
      final balances = data.map((key, value) => MapEntry(key, value as int));
      state = state.copyWith(balances: balances, isLoading: false);
    } catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: 'Failed to fetch leave balances');
    }
  }

  Future<void> fetchHistory() async {
    state = state.copyWith(isLoading: true);
    try {
      final response = await _dioClient.dio.get('/leaves/my-requests');
      final List<dynamic> data = response.data;
      final history = data.map((json) => LeaveRequest.fromJson(json)).toList();
      state = state.copyWith(history: history, isLoading: false);
    } catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: 'Failed to fetch leave requests');
    }
  }

  Future<void> applyLeave({
    required String leaveType,
    required DateTime startDate,
    required DateTime endDate,
    required String reason,
  }) async {
    state = state.copyWith(isLoading: true);
    try {
      await _dioClient.dio.post(
        '/leaves/apply',
        data: {
          'leave_type': leaveType,
          'start_date': '${startDate.year}-${startDate.month.toString().padLeft(2, '0')}-${startDate.day.toString().padLeft(2, '0')}',
          'end_date': '${endDate.year}-${endDate.month.toString().padLeft(2, '0')}-${endDate.day.toString().padLeft(2, '0')}',
          'reason': reason,
        },
      );
      
      await fetchBalances();
      await fetchHistory();
    } on DioException catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: e.error.toString());
      rethrow;
    }
  }
}

final leaveProvider = StateNotifierProvider<LeaveNotifier, LeaveState>((ref) {
  return LeaveNotifier();
});
