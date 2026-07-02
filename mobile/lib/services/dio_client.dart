import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';

class DioClient {
  static const String _baseUrlKey = 'api_base_url';
  static const String _tokenKey = 'auth_token';
  
  final Dio _dio = Dio();
  String _baseUrl = 'https://hrms-lg07.onrender.com/api/v1';

  static final DioClient _instance = DioClient._internal();
  factory DioClient() => _instance;

  Dio get dio => _dio;
  String get baseUrl => _baseUrl;

  DioClient._internal() {
    _dio.options = BaseOptions(
      baseUrl: _baseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 10),
      headers: {
        'Content-Type': 'application/json',
      },
    );

    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final prefs = await SharedPreferences.getInstance();
          final token = prefs.getString(_tokenKey);
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          return handler.next(options);
        },
        onError: (DioException e, handler) {
          // Wrap with clear error descriptions
          String errorMessage = 'Something went wrong: ${e.message ?? e.toString()}';
          if (e.response != null) {
            final data = e.response?.data;
            if (data is Map && data.containsKey('detail')) {
              errorMessage = data['detail'].toString();
            } else {
              errorMessage = 'Server error: ${e.response?.statusCode}';
            }
          } else if (e.type == DioExceptionType.connectionTimeout || e.type == DioExceptionType.sendTimeout) {
            errorMessage = 'Connection timeout. Check your network or server status.';
          } else if (e.type == DioExceptionType.connectionError) {
            errorMessage = 'Cannot connect to backend server. Ensure it is running on https://hrms-lg07.onrender.com.';
          }
          
          return handler.next(
            DioException(
              requestOptions: e.requestOptions,
              response: e.response,
              type: e.type,
              error: errorMessage,
            ),
          );
        },
      ),
    );
    
    _loadBaseUrl();
  }

  Future<void> _loadBaseUrl() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_baseUrlKey); // Force clear the old saved base URL
    _baseUrl = 'https://hrms-lg07.onrender.com/api/v1';
    _dio.options.baseUrl = 'https://hrms-lg07.onrender.com/api/v1';
  }

  Future<void> updateBaseUrl(String newUrl) async {
    _baseUrl = newUrl;
    _dio.options.baseUrl = newUrl;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_baseUrlKey, newUrl);
  }

  Future<void> saveToken(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, token);
  }

  Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_tokenKey);
  }

  Future<void> removeToken() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
  }
}
