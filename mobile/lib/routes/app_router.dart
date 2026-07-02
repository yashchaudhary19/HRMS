import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../screens/login_screen.dart';
import '../screens/navigation_container.dart';
import '../screens/dashboard_tab.dart';
import '../screens/attendance_tab.dart';
import '../screens/leave_tab.dart';
import '../screens/salary_tab.dart';
import '../screens/help_tab.dart';
import '../screens/profile_tab.dart';

final GlobalKey<NavigatorState> _rootNavigatorKey = GlobalKey<NavigatorState>(debugLabel: 'root');
final GlobalKey<NavigatorState> _shellNavigatorKey = GlobalKey<NavigatorState>(debugLabel: 'shell');

class AppRouter {
  static GoRouter get router => GoRouter(
    navigatorKey: _rootNavigatorKey,
    initialLocation: '/',
    redirect: (BuildContext context, GoRouterState state) async {
      final prefs = await SharedPreferences.getInstance();
      final String? token = prefs.getString('auth_token');
      
      final bool isLoggingIn = state.matchedLocation == '/login';
      
      if (token == null) {
        return isLoggingIn ? null : '/login';
      }
      
      if (isLoggingIn) {
        return '/';
      }
      
      return null;
    },
    routes: [
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      
      // ShellRoute for Bottom Navigation bar tabs
      ShellRoute(
        navigatorKey: _shellNavigatorKey,
        builder: (context, state, child) {
          return NavigationContainer(child: child);
        },
        routes: [
          GoRoute(
            path: '/',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: DashboardTab(),
            ),
          ),
          GoRoute(
            path: '/attendance',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: AttendanceTab(),
            ),
          ),
          GoRoute(
            path: '/leave',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: LeaveTab(),
            ),
          ),
          GoRoute(
            path: '/salary',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: SalaryTab(),
            ),
          ),
          GoRoute(
            path: '/help',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: HelpTab(),
            ),
          ),
        ],
      ),
      
      // Profile screen as a standard page pushed on top
      GoRoute(
        parentNavigatorKey: _rootNavigatorKey,
        path: '/profile',
        builder: (context, state) => const ProfileTab(),
      ),
    ],
  );
}
