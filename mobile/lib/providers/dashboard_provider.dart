import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/announcement.dart';
import '../models/holiday.dart';
import '../services/dio_client.dart';

class DashboardState {
  final List<Announcement> announcements;
  final List<Holiday> holidays;
  final bool isLoading;
  final String? errorMessage;

  DashboardState({
    this.announcements = const [],
    this.holidays = const [],
    this.isLoading = false,
    this.errorMessage,
  });

  DashboardState copyWith({
    List<Announcement>? announcements,
    List<Holiday>? holidays,
    bool? isLoading,
    String? errorMessage,
  }) {
    return DashboardState(
      announcements: announcements ?? this.announcements,
      holidays: holidays ?? this.holidays,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage,
    );
  }
}

class DashboardNotifier extends StateNotifier<DashboardState> {
  final DioClient _dioClient = DioClient();

  DashboardNotifier() : super(DashboardState()) {
    fetchAnnouncements();
    fetchHolidays();
  }

  Future<void> fetchAnnouncements() async {
    state = state.copyWith(isLoading: true);
    try {
      final response = await _dioClient.dio.get('/dashboard/announcements');
      final List<dynamic> data = response.data;
      final announcements = data.map((json) => Announcement.fromJson(json)).toList();
      state = state.copyWith(announcements: announcements, isLoading: false);
    } catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: 'Failed to fetch announcements');
    }
  }

  Future<void> fetchHolidays() async {
    state = state.copyWith(isLoading: true);
    try {
      final response = await _dioClient.dio.get('/dashboard/holidays');
      final List<dynamic> data = response.data;
      final holidays = data.map((json) => Holiday.fromJson(json)).toList();
      state = state.copyWith(holidays: holidays, isLoading: false);
    } catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: 'Failed to fetch holidays');
    }
  }
}

final dashboardProvider = StateNotifierProvider<DashboardNotifier, DashboardState>((ref) {
  return DashboardNotifier();
});
