import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import '../models/help_ticket.dart';
import '../services/dio_client.dart';

class HelpdeskState {
  final List<HelpTicket> tickets;
  final bool isLoading;
  final String? errorMessage;

  HelpdeskState({
    this.tickets = const [],
    this.isLoading = false,
    this.errorMessage,
  });

  HelpdeskState copyWith({
    List<HelpTicket>? tickets,
    bool? isLoading,
    String? errorMessage,
  }) {
    return HelpdeskState(
      tickets: tickets ?? this.tickets,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage,
    );
  }
}

class HelpdeskNotifier extends StateNotifier<HelpdeskState> {
  final DioClient _dioClient = DioClient();

  HelpdeskNotifier() : super(HelpdeskState()) {
    fetchTickets();
  }

  Future<void> fetchTickets() async {
    state = state.copyWith(isLoading: true);
    try {
      final response = await _dioClient.dio.get('/helpdesk/tickets');
      final List<dynamic> data = response.data;
      final tickets = data.map((json) => HelpTicket.fromJson(json)).toList();
      state = state.copyWith(tickets: tickets, isLoading: false);
    } on DioException catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: e.error.toString());
    } catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: 'Failed to fetch tickets');
    }
  }

  Future<void> raiseTicket({
    required String category,
    required String title,
    required String description,
  }) async {
    state = state.copyWith(isLoading: true);
    try {
      await _dioClient.dio.post(
        '/helpdesk/tickets',
        data: {
          'category': category,
          'title': title,
          'description': description,
        },
      );
      await fetchTickets();
    } on DioException catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: e.error.toString());
      rethrow;
    }
  }
}

final helpdeskProvider = StateNotifierProvider<HelpdeskNotifier, HelpdeskState>((ref) {
  return HelpdeskNotifier();
});
