import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import '../models/salary_slip.dart';
import '../services/dio_client.dart';

class SalaryState {
  final List<SalarySlip> slips;
  final double ytdTax;
  final List<Map<String, dynamic>> trends;
  final bool isLoading;
  final String? errorMessage;

  SalaryState({
    this.slips = const [],
    this.ytdTax = 0.0,
    this.trends = const [],
    this.isLoading = false,
    this.errorMessage,
  });

  SalaryState copyWith({
    List<SalarySlip>? slips,
    double? ytdTax,
    List<Map<String, dynamic>>? trends,
    bool? isLoading,
    String? errorMessage,
  }) {
    return SalaryState(
      slips: slips ?? this.slips,
      ytdTax: ytdTax ?? this.ytdTax,
      trends: trends ?? this.trends,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage,
    );
  }
}

class SalaryNotifier extends StateNotifier<SalaryState> {
  final DioClient _dioClient = DioClient();

  SalaryNotifier() : super(SalaryState()) {
    fetchSlips();
  }

  Future<void> fetchSlips() async {
    state = state.copyWith(isLoading: true);
    try {
      final slipsResponse = await _dioClient.dio.get('/salary/slips');
      final List<dynamic> slipsData = slipsResponse.data;
      final slips = slipsData.map((json) => SalarySlip.fromJson(json)).toList();

      double fetchedYtdTax = 0.0;
      List<Map<String, dynamic>> fetchedTrends = [];

      try {
        final historyResponse = await _dioClient.dio.get('/salary/history');
        final historyData = historyResponse.data;
        fetchedYtdTax = (historyData['ytd_tax'] as num).toDouble();
        final List<dynamic> trendsData = historyData['trends'];
        fetchedTrends = trendsData.map((t) => {
          'month': t['month'].toString(),
          'payout': (t['payout'] as num).toDouble(),
        }).toList();
      } catch (e) {
        print('Error fetching salary history details: $e');
      }

      state = state.copyWith(
        slips: slips,
        ytdTax: fetchedYtdTax,
        trends: fetchedTrends,
        isLoading: false,
      );
    } on DioException catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: e.error.toString());
    } catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: 'Failed to fetch slips');
    }
  }
}

final salaryProvider = StateNotifierProvider<SalaryNotifier, SalaryState>((ref) {
  return SalaryNotifier();
});
