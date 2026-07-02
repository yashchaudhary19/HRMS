import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../providers/auth_provider.dart';
import '../providers/attendance_provider.dart';
import '../providers/leave_provider.dart';
import '../providers/dashboard_provider.dart';
import '../theme/theme.dart';

class DashboardTab extends ConsumerStatefulWidget {
  const DashboardTab({super.key});

  @override
  ConsumerState<DashboardTab> createState() => _DashboardTabState();
}

class _DashboardTabState extends ConsumerState<DashboardTab> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(attendanceProvider.notifier).fetchTodayAttendance();
      ref.read(attendanceProvider.notifier).fetchAttendanceHistory();
      ref.read(leaveProvider.notifier).fetchBalances();
      ref.read(dashboardProvider.notifier).fetchAnnouncements();
      ref.read(dashboardProvider.notifier).fetchHolidays();
    });
  }

  Future<void> _refreshData() async {
    await ref.read(attendanceProvider.notifier).fetchTodayAttendance();
    await ref.read(attendanceProvider.notifier).fetchAttendanceHistory();
    await ref.read(leaveProvider.notifier).fetchBalances();
    await ref.read(dashboardProvider.notifier).fetchAnnouncements();
    await ref.read(dashboardProvider.notifier).fetchHolidays();
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);
    final attendanceState = ref.watch(attendanceProvider);
    final leaveState = ref.watch(leaveProvider);
    final dashboardState = ref.watch(dashboardProvider);

    final user = authState.employee;
    final userName = user != null ? user.firstName : 'Employee';

    // Calculate working hours display
    double workingHours = 0.0;
    String checkInTime = '--:--';
    String checkOutTime = '--:--';
    bool isCheckedIn = false;

    final attendance = attendanceState.todayAttendance;
    if (attendance != null) {
      isCheckedIn = attendance.checkOut == null;
      if (attendance.checkIn != null) {
        checkInTime = DateFormat('hh:mm a').format(attendance.checkIn!.toLocal());
      }
      if (attendance.checkOut != null) {
        workingHours = attendance.workingHours;
        checkOutTime = DateFormat('hh:mm a').format(attendance.checkOut!.toLocal());
      } else {
        // Still checked in — calculate live working hours
        if (attendance.status == 'wfh') {
          final double rawHrs = attendanceState.loggedSeconds / 3600.0;
          workingHours = double.parse(rawHrs.toStringAsFixed(1));
        } else {
          final diff = DateTime.now().difference(attendance.checkIn!);
          final double rawHrs = diff.inSeconds / 3600.0;
          workingHours = double.parse(rawHrs.toStringAsFixed(1));
        }
      }
    }

    final double goalPercentage = (workingHours / 8.0).clamp(0.0, 1.2);
    final int goalPercentageInt = (goalPercentage * 100).toInt();

    // Leave balances
    final sickLeft = leaveState.balances['sick'] ?? 0;
    final annualLeft = leaveState.balances['earned'] ?? 0;
    final casualLeft = leaveState.balances['casual'] ?? 0;

    return RefreshIndicator(
      onRefresh: _refreshData,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Hello greeting
            Text(
              'Hello, $userName',
              style: Theme.of(context).textTheme.displayMedium?.copyWith(
                fontSize: 28,
                fontWeight: FontWeight.w700,
                color: AppTheme.textDark,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              "Here's your work overview for today.",
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: AppTheme.textSecondary,
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 24),

            // Metrics row: Hours Goal & Status
            Row(
              children: [
                // Working Hours Circular Chart Card
                Expanded(
                  child: Container(
                    height: 170,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppTheme.cardBg,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppTheme.border),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        SizedBox(
                          height: 70,
                          width: 70,
                          child: Stack(
                            fit: StackFit.expand,
                            children: [
                              CircularProgressIndicator(
                                value: goalPercentage,
                                strokeWidth: 8,
                                backgroundColor: const Color(0xfff1f5f9),
                                color: AppTheme.primary,
                                strokeCap: StrokeCap.round,
                              ),
                              Center(
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Text(
                                      '$workingHours',
                                      style: GoogleFonts.outfit(
                                        fontSize: 18,
                                        fontWeight: FontWeight.bold,
                                        color: AppTheme.textDark,
                                      ),
                                    ),
                                    Text(
                                      'Hours',
                                      style: GoogleFonts.inter(
                                        fontSize: 10,
                                        color: AppTheme.textSecondary,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'Working Hours',
                          style: GoogleFonts.outfit(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: AppTheme.textSecondary,
                          ),
                        ),
                        Text(
                          '$goalPercentageInt% Goal',
                          style: GoogleFonts.inter(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: AppTheme.primary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 16),
                
                // Checked In Status Card
                Expanded(
                  child: Container(
                    height: 170,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppTheme.cardBg,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppTheme.border),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        CircleAvatar(
                          radius: 28,
                          backgroundColor: AppTheme.primaryLight,
                          child: Icon(
                            Icons.fingerprint_rounded,
                            size: 32,
                            color: isCheckedIn ? AppTheme.primary : AppTheme.textSecondary,
                          ),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'Status',
                          style: GoogleFonts.outfit(
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                            color: AppTheme.textSecondary,
                          ),
                        ),
                        Text(
                          isCheckedIn ? 'Checked In' : (attendance != null ? 'Checked Out' : 'Not Punched'),
                          textAlign: TextAlign.center,
                          style: GoogleFonts.outfit(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: AppTheme.textDark,
                          ),
                        ),
                        Text(
                          isCheckedIn
                              ? 'In at $checkInTime'
                              : (checkOutTime != '--:--' ? 'Out at $checkOutTime' : '--:--'),
                          style: GoogleFonts.inter(
                            fontSize: 12,
                            color: AppTheme.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 28),

            // Leave Balance Header
            _buildSectionHeader(context, 'Leave Balance', '', () {}),
            const SizedBox(height: 12),

            // Leave Balance Cards (Horizontal Scrollable list)
            SizedBox(
              height: 100,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: [
                  _buildLeaveBalanceCard('Sick', sickLeft, Colors.redAccent),
                  _buildLeaveBalanceCard('Annual', annualLeft, AppTheme.primary),
                  _buildLeaveBalanceCard('Casual', casualLeft, Colors.cyan),
                ],
              ),
            ),
            const SizedBox(height: 28),

            // Announcements Section
            Text(
              'Announcements',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.bold,
                fontSize: 18,
                color: AppTheme.textDark,
              ),
            ),
            // Carousel Announcements (Horizontal scrolling)
            SizedBox(
              height: 140,
              child: dashboardState.announcements.isEmpty
                  ? Center(
                      child: Text(
                        'No announcements posted.',
                        style: GoogleFonts.inter(color: AppTheme.textSecondary),
                      ),
                    )
                  : PageView.builder(
                      controller: PageController(viewportFraction: 0.88),
                      itemCount: dashboardState.announcements.length,
                      itemBuilder: (context, index) {
                        final announcement = dashboardState.announcements[index];
                        final isNewPolicy = announcement.tag == 'New Policy';
                        final isUrgent = announcement.isUrgent == true;
                        return GestureDetector(
                          onTap: () => _showAnnouncementDetails(context, announcement),
                          child: Container(
                            margin: const EdgeInsets.only(right: 12),
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: isNewPolicy ? const Color(0xff1e293b) : Colors.white,
                              borderRadius: BorderRadius.circular(16),
                              border: isNewPolicy
                                  ? null
                                  : Border.all(
                                      color: isUrgent ? Colors.redAccent.withOpacity(0.4) : AppTheme.border,
                                      width: isUrgent ? 1.5 : 1.0,
                                    ),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Icon(
                                      isNewPolicy ? Icons.campaign_outlined : Icons.celebration_outlined,
                                      color: isNewPolicy ? Colors.white : AppTheme.warning,
                                      size: 18,
                                    ),
                                    const SizedBox(width: 8),
                                    if (announcement.tag != null)
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: isNewPolicy ? AppTheme.primary : AppTheme.warningLight,
                                          borderRadius: BorderRadius.circular(20),
                                        ),
                                        child: Text(
                                          announcement.tag!,
                                          style: GoogleFonts.outfit(
                                            fontSize: 10,
                                            color: isNewPolicy ? Colors.white : AppTheme.warning,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                      ),
                                    if (isUrgent) ...[
                                      const SizedBox(width: 6),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: Colors.redAccent.withOpacity(0.1),
                                          borderRadius: BorderRadius.circular(20),
                                        ),
                                        child: Text(
                                          'Urgent',
                                          style: GoogleFonts.outfit(
                                            fontSize: 10,
                                            color: Colors.redAccent,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                                const Spacer(),
                                Text(
                                  announcement.title,
                                  style: GoogleFonts.outfit(
                                    fontSize: 15,
                                    fontWeight: FontWeight.bold,
                                    color: isNewPolicy ? Colors.white : AppTheme.textDark,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  announcement.content,
                                  style: GoogleFonts.inter(
                                    fontSize: 12,
                                    color: isNewPolicy ? const Color(0xffcbd5e1) : AppTheme.textSecondary,
                                  ),
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
            ),



            const SizedBox(height: 28),

            // Upcoming Holidays Header
            _buildSectionHeader(context, 'Upcoming Holidays', '', () {}),
            const SizedBox(height: 12),

            // Holiday list
            dashboardState.holidays.isEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Text(
                        'No upcoming holidays.',
                        style: GoogleFonts.inter(color: AppTheme.textSecondary),
                      ),
                    ),
                  )
                : ListView.separated(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: dashboardState.holidays.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 12),
                    itemBuilder: (context, index) {
                      final holiday = dashboardState.holidays[index];
                      final dayStr = DateFormat('dd').format(holiday.date);
                      final dayNameStr = holiday.dayName ?? DateFormat('EEE').format(holiday.date);
                      final monthStr = DateFormat('MMM').format(holiday.date);
                      return _buildHolidayItem(
                        day: dayStr,
                        dayName: dayNameStr,
                        title: holiday.title,
                        subtitle: '$dayNameStr, $dayStr $monthStr • ${holiday.holidayType}',
                        holidayType: holiday.holidayType ?? '',
                      );
                    },
                  ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionHeader(
    BuildContext context,
    String title,
    String actionText,
    VoidCallback onTap,
  ) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          title,
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
            fontWeight: FontWeight.bold,
            fontSize: 18,
            color: AppTheme.textDark,
          ),
        ),
        if (actionText.isNotEmpty)
          GestureDetector(
            onTap: onTap,
            child: Text(
              actionText,
              style: GoogleFonts.outfit(
                color: AppTheme.primary,
                fontWeight: FontWeight.bold,
                fontSize: 14,
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildLeaveBalanceCard(String title, int count, Color indicatorColor) {
    return Container(
      width: 120,
      margin: const EdgeInsets.only(right: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.border),
      ),
      child: Stack(
        children: [
          Positioned(
            left: 0,
            top: 0,
            bottom: 0,
            width: 4,
            child: Container(
              decoration: BoxDecoration(
                color: indicatorColor,
                borderRadius: BorderRadius.circular(10),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(left: 12.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  title,
                  style: GoogleFonts.outfit(
                    fontSize: 12,
                    color: AppTheme.textSecondary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    Text(
                      count.toString().padLeft(2, '0'),
                      style: GoogleFonts.outfit(
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        color: AppTheme.textDark,
                      ),
                    ),
                    const SizedBox(width: 2),
                    Text(
                      'Days left',
                      style: GoogleFonts.inter(
                        fontSize: 9,
                        color: AppTheme.textSecondary,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHolidayItem({
    required String day,
    required String dayName,
    required String title,
    required String subtitle,
    required String holidayType,
  }) {
    // Determine card indicator color based on holiday type (Outlook style)
    Color indicatorColor;
    final typeLower = holidayType.toLowerCase();
    if (typeLower.contains('national') || typeLower.contains('gazetted')) {
      indicatorColor = const Color(0xff0078d4); // Outlook Blue
    } else if (typeLower.contains('public')) {
      indicatorColor = const Color(0xff107c41); // Outlook Green (Teal)
    } else if (typeLower.contains('restricted')) {
      indicatorColor = const Color(0xffd83b01); // Outlook Orange
    } else if (typeLower.contains('regional')) {
      indicatorColor = const Color(0xff8764b8); // Outlook Purple
    } else {
      indicatorColor = AppTheme.primary; // Default App Brand color
    }

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 4.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Date Stack on the left (Outlook Style)
          SizedBox(
            width: 45,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Text(
                  dayName.substring(0, 3).toUpperCase(),
                  style: GoogleFonts.outfit(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.textSecondary,
                    letterSpacing: 0.5,
                  ),
                ),
                Text(
                  day,
                  style: GoogleFonts.outfit(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.textDark,
                    height: 1.1,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),

          // Colored vertical line divider
          Container(
            width: 1,
            height: 40,
            color: AppTheme.border,
          ),
          const SizedBox(width: 12),

          // Holiday Card on the right (Outlook agenda event style)
          Expanded(
            child: Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppTheme.border),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.02),
                    blurRadius: 4,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: IntrinsicHeight(
                  child: Row(
                    children: [
                      // Left-side category indicator bar (Outlook style)
                      Container(
                        width: 5,
                        color: indicatorColor,
                      ),
                      const SizedBox(width: 16),

                      // Event details
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 14.0, horizontal: 4.0),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                title,
                                style: GoogleFonts.outfit(
                                  fontSize: 15,
                                  fontWeight: FontWeight.bold,
                                  color: AppTheme.textDark,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  Icon(
                                    Icons.calendar_today_rounded,
                                    size: 11,
                                    color: AppTheme.textSecondary,
                                  ),
                                  const SizedBox(width: 6),
                                  Expanded(
                                    child: Text(
                                      subtitle,
                                      style: GoogleFonts.inter(
                                        fontSize: 12,
                                        color: AppTheme.textSecondary,
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showAnnouncementDetails(BuildContext context, dynamic announcement) {
    final isNewPolicy = announcement.tag == 'New Policy';
    final isUrgent = announcement.isUrgent == true;

    showDialog(
      context: context,
      builder: (context) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        elevation: 16,
        child: Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: isNewPolicy ? const Color(0xff1e293b) : Colors.white,
            borderRadius: BorderRadius.circular(24),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Row(
                      children: [
                        Icon(
                          isNewPolicy ? Icons.campaign_outlined : Icons.campaign_rounded,
                          color: isNewPolicy ? Colors.white : AppTheme.primary,
                          size: 22,
                        ),
                        const SizedBox(width: 8),
                        if (announcement.tag != null)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2.5),
                            decoration: BoxDecoration(
                              color: isNewPolicy ? AppTheme.primary : AppTheme.primaryLight,
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text(
                              announcement.tag!,
                              style: GoogleFonts.outfit(
                                fontSize: 10,
                                color: isNewPolicy ? Colors.white : AppTheme.primary,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        if (isUrgent) ...[
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2.5),
                            decoration: BoxDecoration(
                              color: Colors.redAccent.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text(
                              'Urgent',
                              style: GoogleFonts.outfit(
                                fontSize: 10,
                                color: Colors.redAccent,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  IconButton(
                    constraints: const BoxConstraints(),
                    padding: EdgeInsets.zero,
                    icon: Icon(
                      Icons.close_rounded,
                      color: isNewPolicy ? Colors.white70 : AppTheme.textSecondary,
                    ),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Text(
                announcement.title,
                style: GoogleFonts.outfit(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: isNewPolicy ? Colors.white : AppTheme.textDark,
                ),
              ),
              const SizedBox(height: 12),
              Flexible(
                child: SingleChildScrollView(
                  child: Text(
                    announcement.content,
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      height: 1.5,
                      color: isNewPolicy ? const Color(0xffcbd5e1) : AppTheme.textSecondary,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: Text(
                    'Close',
                    style: GoogleFonts.outfit(
                      color: isNewPolicy ? Colors.white70 : AppTheme.primary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
