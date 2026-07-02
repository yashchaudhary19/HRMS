import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/document.dart';
import '../services/dio_client.dart';

class DocumentsState {
  final List<DocumentRecord> documents;
  final bool isLoading;
  final String? errorMessage;

  DocumentsState({
    this.documents = const [],
    this.isLoading = false,
    this.errorMessage,
  });

  DocumentsState copyWith({
    List<DocumentRecord>? documents,
    bool? isLoading,
    String? errorMessage,
    bool clearError = false,
  }) {
    return DocumentsState(
      documents: documents ?? this.documents,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

class DocumentsNotifier extends StateNotifier<DocumentsState> {
  final DioClient _dioClient = DioClient();

  DocumentsNotifier() : super(DocumentsState()) {
    fetchDocuments();
  }

  Future<void> fetchDocuments() async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final response = await _dioClient.dio.get('/employees/me/documents');
      final List<dynamic> data = response.data;
      final docs = data.map((json) => DocumentRecord.fromJson(json)).toList();
      state = state.copyWith(documents: docs, isLoading: false);
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'Failed to fetch documents from server.',
      );
    }
  }
}

final documentsProvider = StateNotifierProvider<DocumentsNotifier, DocumentsState>((ref) {
  return DocumentsNotifier();
});
