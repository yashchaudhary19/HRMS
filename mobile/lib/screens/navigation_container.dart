import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:go_router/go_router.dart';
import '../providers/auth_provider.dart';
import '../theme/theme.dart';

class NavigationContainer extends ConsumerStatefulWidget {
  final Widget child;
  const NavigationContainer({super.key, required this.child});

  @override
  ConsumerState<NavigationContainer> createState() => _NavigationContainerState();
}

class _NavigationContainerState extends ConsumerState<NavigationContainer> {
  int _getCurrentIndex(BuildContext context) {
    final String location = GoRouterState.of(context).matchedLocation;
    if (location.startsWith('/attendance')) {
      return 1;
    } else if (location.startsWith('/leave')) {
      return 2;
    } else if (location.startsWith('/salary')) {
      return 3;
    } else if (location.startsWith('/help')) {
      return 4;
    }
    return 0; // default to Dashboard
  }

  void _onItemTapped(int index, BuildContext context) {
    switch (index) {
      case 0:
        context.go('/');
        break;
      case 1:
        context.go('/attendance');
        break;
      case 2:
        context.go('/leave');
        break;
      case 3:
        context.go('/salary');
        break;
      case 4:
        context.go('/help');
        break;
    }
  }

  void _handleLogout() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Logout', style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
        content: const Text('Are you sure you want to sign out from HR Connect?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('Cancel', style: GoogleFonts.outfit(color: AppTheme.textSecondary)),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              await ref.read(authProvider.notifier).logout();
              if (mounted) {
                context.go('/login');
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.error,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            ),
            child: const Text('Sign Out'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);
    final user = authState.employee;
    final int currentIndex = _getCurrentIndex(context);

    // Initial letters of Yash Chaudhary or John Doe
    String initials = 'JD';
    if (user != null) {
      final f = user.firstName.isNotEmpty ? user.firstName[0].toUpperCase() : '';
      final l = user.lastName.isNotEmpty ? user.lastName[0].toUpperCase() : '';
      initials = '$f$l';
    }

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            GestureDetector(
              onTap: () => context.push('/profile'),
              child: CircleAvatar(
                radius: 18,
                backgroundColor: AppTheme.primaryLight,
                child: Text(
                  initials,
                  style: GoogleFonts.outfit(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.primary,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Text(
              'HR Connect',
              style: GoogleFonts.outfit(
                fontWeight: FontWeight.bold,
                fontSize: 18,
                color: AppTheme.textDark,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Badge(
              label: Text('2'),
              child: Icon(Icons.notifications_none_rounded, color: AppTheme.textDark),
            ),
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('No new updates since last check-in'),
                  behavior: SnackBarBehavior.floating,
                ),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.logout_rounded, color: AppTheme.textSecondary),
            onPressed: _handleLogout,
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: widget.child,
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          border: Border(
            top: BorderSide(color: AppTheme.border, width: 1),
          ),
        ),
        child: BottomNavigationBar(
          currentIndex: currentIndex,
          onTap: (index) => _onItemTapped(index, context),
          type: BottomNavigationBarType.fixed,
          backgroundColor: Colors.white,
          selectedItemColor: AppTheme.primary,
          unselectedItemColor: AppTheme.textSecondary,
          selectedLabelStyle: GoogleFonts.outfit(
            fontSize: 12,
            fontWeight: FontWeight.bold,
          ),
          unselectedLabelStyle: GoogleFonts.outfit(
            fontSize: 12,
            fontWeight: FontWeight.w500,
          ),
          elevation: 0,
          items: const [
            BottomNavigationBarItem(
              icon: Icon(Icons.grid_view_rounded),
              activeIcon: Icon(Icons.grid_view_rounded, color: AppTheme.primary),
              label: 'Dashboard',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.fingerprint_rounded),
              activeIcon: Icon(Icons.fingerprint_rounded, color: AppTheme.primary),
              label: 'Attendance',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.date_range_rounded),
              activeIcon: Icon(Icons.date_range_rounded, color: AppTheme.primary),
              label: 'Leave',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.payment_rounded),
              activeIcon: Icon(Icons.payment_rounded, color: AppTheme.primary),
              label: 'Salary',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.support_agent_rounded),
              activeIcon: Icon(Icons.support_agent_rounded, color: AppTheme.primary),
              label: 'Help',
            ),
          ],
        ),
      ),
    );
  }
}
