import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:dio/dio.dart';
import '../models/employee.dart';
import '../services/dio_client.dart';

class AuthState {
  final Employee? employee;
  final String? token;
  final bool isLoading;
  final String? errorMessage;

  AuthState({
    this.employee,
    this.token,
    this.isLoading = false,
    this.errorMessage,
  });

  AuthState copyWith({
    Employee? employee,
    String? token,
    bool? isLoading,
    String? errorMessage,
    bool clearError = false,
  }) {
    return AuthState(
      employee: employee ?? this.employee,
      token: token ?? this.token,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

class AuthNotifier extends StateNotifier<AuthState> {
  final DioClient _dioClient = DioClient();

  AuthNotifier() : super(AuthState()) {
    tryAutoLogin();
  }

  Future<bool> tryAutoLogin() async {
    final savedToken = await _dioClient.getToken();
    if (savedToken != null) {
      state = state.copyWith(isLoading: true, clearError: true);
      try {
        final response = await _dioClient.dio.get('/employees/me');
        final employee = Employee.fromJson(response.data);
        state = state.copyWith(
          token: savedToken,
          employee: employee,
          isLoading: false,
        );
        return true;
      } catch (e) {
        print('Auto login failed: $e');
        await _dioClient.removeToken();
        state = state.copyWith(token: null, employee: null, isLoading: false);
      }
    }
    return false;
  }

  Future<void> login(String email, String password) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final response = await _dioClient.dio.post(
        '/auth/login-json',
        data: {'email': email, 'password': password},
      );
      
      final token = response.data['access_token'];
      await _dioClient.saveToken(token);
      
      // Fetch profile details
      final profileResponse = await _dioClient.dio.get('/employees/me');
      final employee = Employee.fromJson(profileResponse.data);
      
      state = state.copyWith(
        token: token,
        employee: employee,
        isLoading: false,
      );
    } on DioException catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: e.error.toString(),
      );
      rethrow;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'An unexpected authentication error occurred',
      );
      rethrow;
    }
  }

  Future<void> logout() async {
    await _dioClient.removeToken();
    state = AuthState();
  }

  Future<void> updateProfile({
    required String firstName,
    required String lastName,
    required String bankName,
    required String bankAccountNo,
    required String emergencyContact,
  }) async {
    if (state.employee == null) return;
    state = state.copyWith(isLoading: true, clearError: true);
    
    try {
      final updatedData = state.employee!.copyWith(
        firstName: firstName,
        lastName: lastName,
        bankName: bankName,
        bankAccountNo: bankAccountNo,
        emergencyContact: emergencyContact,
      );
      
      final response = await _dioClient.dio.put(
        '/employees/${state.employee!.id}',
        data: updatedData.toJson(),
      );
      
      final result = Employee.fromJson(response.data);
      state = state.copyWith(employee: result, isLoading: false);
    } on DioException catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: e.error.toString());
      rethrow;
    } catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: 'Failed to update profile');
      rethrow;
    }
  }
  
  void clearError() {
    state = state.copyWith(clearError: true);
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier();
});
