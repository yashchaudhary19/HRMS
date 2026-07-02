import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../providers/salary_provider.dart';
import '../models/salary_slip.dart';
import '../theme/theme.dart';

class SalaryTab extends ConsumerStatefulWidget {
  const SalaryTab({super.key});

  @override
  ConsumerState<SalaryTab> createState() => _SalaryTabState();
}

class _SalaryTabState extends ConsumerState<SalaryTab> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(salaryProvider.notifier).fetchSlips();
    });
  }

  Future<void> _refreshData() async {
    await ref.read(salaryProvider.notifier).fetchSlips();
  }

  @override
  Widget build(BuildContext context) {
    final salaryState = ref.watch(salaryProvider);

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: _refreshData,
        child: salaryState.isLoading && salaryState.slips.isEmpty
            ? const Center(child: CircularProgressIndicator())
            : SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Salary & Payslips',
                      style: Theme.of(context).textTheme.displayMedium?.copyWith(
                        fontSize: 26,
                        fontWeight: FontWeight.bold,
                        color: AppTheme.textDark,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Manage your earnings, deductions, and payment history.',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: AppTheme.textSecondary,
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 24),

                    if (salaryState.slips.isEmpty)
                      Center(
                        child: Padding(
                          padding: const EdgeInsets.all(32.0),
                          child: Text(
                            'No payslips found.',
                            style: GoogleFonts.inter(color: AppTheme.textSecondary),
                          ),
                        ),
                      )
                    else ...[
                      // Latest Slip Summary Card
                      _buildSummaryCard(salaryState.slips.first),
                      const SizedBox(height: 24),

                      // Payslip list
                      _buildPayslipList(salaryState.slips),
                      const SizedBox(height: 24),
                    ],

                    // Tax Summary YTD Card
                    _buildTaxSummary(salaryState.ytdTax),
                    const SizedBox(height: 24),

                    // Salary Trends Card (only if data from server)
                    if (salaryState.trends.isNotEmpty) ...[
                      _buildSalaryTrends(salaryState.trends),
                      const SizedBox(height: 24),
                    ],
                  ],
                ),
              ),
      ),
    );
  }

  Widget _buildSummaryCard(SalarySlip slip) {
    final formatCurrency = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 2);
    final payoutDateStr = DateFormat('MMMM dd, yyyy').format(slip.payoutDate);

    // Color code status tag
    Color tagBg = AppTheme.warningLight;
    Color tagText = AppTheme.warning;
    if (slip.status == 'paid') {
      tagBg = AppTheme.successLight;
      tagText = AppTheme.success;
    } else if (slip.status == 'processing') {
      tagBg = const Color(0xffe6fbf3);
      tagText = AppTheme.success;
    }

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppTheme.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '${slip.month} Summary',
                style: GoogleFonts.outfit(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.textDark,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: tagBg,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  slip.status[0].toUpperCase() + slip.status.substring(1),
                  style: GoogleFonts.outfit(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: tagText,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            'Scheduled for payout on $payoutDateStr',
            style: GoogleFonts.inter(
              fontSize: 12,
              color: AppTheme.textSecondary,
            ),
          ),
          const SizedBox(height: 20),

          // Gross Salary
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xfff8fafc),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppTheme.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Gross Salary',
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    color: AppTheme.textSecondary,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  formatCurrency.format(slip.grossSalary),
                  style: GoogleFonts.outfit(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.textDark,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // Total Deductions
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xfffdf2f2),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xfffde2e2)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Total Deductions',
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    color: AppTheme.error,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '-${formatCurrency.format(slip.totalDeductions.abs())}',
                  style: GoogleFonts.outfit(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.error,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // Net Payout
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: AppTheme.primary,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Net Payout',
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    color: Colors.white.withOpacity(0.8),
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  formatCurrency.format(slip.netPayout),
                  style: GoogleFonts.outfit(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // EARNINGS & DEDUCTIONS BREAKDOWN
          Text(
            'EARNINGS & DEDUCTIONS BREAKDOWN',
            style: GoogleFonts.outfit(
              fontSize: 11,
              fontWeight: FontWeight.bold,
              color: AppTheme.textLight,
              letterSpacing: 1.0,
            ),
          ),
          const SizedBox(height: 16),

          _buildBreakdownRow('Base Salary', formatCurrency.format(slip.baseSalary), false),
          const Divider(color: AppTheme.border, height: 24),
          if (slip.bonus > 0) ...[
            _buildBreakdownRow('Performance Bonus', formatCurrency.format(slip.bonus), false),
            const Divider(color: AppTheme.border, height: 24),
          ],
          _buildBreakdownRow('Income Tax', '-${formatCurrency.format(slip.federalTax.abs())}', true),
          const Divider(color: AppTheme.border, height: 24),
          _buildBreakdownRow('Health Insurance', '-${formatCurrency.format(slip.healthInsurance.abs())}', true),
          const Divider(color: AppTheme.border, height: 24),
          _buildBreakdownRow('Provident Fund', '-${formatCurrency.format(slip.retirementContribution.abs())}', true),
        ],
      ),
    );
  }

  Widget _buildBreakdownRow(String title, String value, bool isDeduction) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          title,
          style: GoogleFonts.inter(
            fontSize: 13,
            color: isDeduction ? AppTheme.error : AppTheme.textDark,
            fontWeight: FontWeight.w500,
          ),
        ),
        Text(
          value,
          style: GoogleFonts.outfit(
            fontSize: 14,
            fontWeight: FontWeight.bold,
            color: isDeduction ? AppTheme.error : AppTheme.textDark,
          ),
        ),
      ],
    );
  }

  Widget _buildPayslipList(List<SalarySlip> slips) {
    final formatCurrency = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 2);
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppTheme.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Payslip History',
            style: GoogleFonts.outfit(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: AppTheme.textDark,
            ),
          ),
          const SizedBox(height: 16),
          ...slips.map((slip) {
            final tagBg = slip.status == 'paid' ? AppTheme.successLight : AppTheme.warningLight;
            final tagText = slip.status == 'paid' ? AppTheme.success : AppTheme.warning;
            return Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: const Color(0xfff8fafc),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppTheme.border),
              ),
              child: Row(
                children: [
                  const Icon(Icons.description_outlined, color: AppTheme.primary, size: 24),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          slip.month,
                          style: GoogleFonts.outfit(
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                            color: AppTheme.textDark,
                          ),
                        ),
                        Text(
                          'Net: ${formatCurrency.format(slip.netPayout)}',
                          style: GoogleFonts.inter(
                            fontSize: 11,
                            color: AppTheme.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: tagBg,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      slip.status[0].toUpperCase() + slip.status.substring(1),
                      style: GoogleFonts.outfit(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        color: tagText,
                      ),
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _buildTaxSummary(double ytdTax) {
    final formatCurrency = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 2);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xff0f172a),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Stack(
        children: [
          Positioned(
            right: -10,
            bottom: -20,
            child: Icon(
              Icons.account_balance,
              size: 100,
              color: Colors.white.withOpacity(0.04),
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'TAX WITHHELD — YEAR TO DATE',
                style: GoogleFonts.outfit(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  color: const Color(0xff94a3b8),
                  letterSpacing: 1.0,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                ytdTax > 0 ? formatCurrency.format(ytdTax) : '₹0.00',
                style: GoogleFonts.outfit(
                  fontSize: 30,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Total income tax deducted from your salary in the current calendar year.',
                style: GoogleFonts.inter(
                  fontSize: 12,
                  color: const Color(0xffcbd5e1),
                  height: 1.4,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSalaryTrends(List<Map<String, dynamic>> trends) {
    double maxPayout = 1.0;
    for (final item in trends) {
      final payout = item['payout'] as double;
      if (payout > maxPayout) {
        maxPayout = payout;
      }
    }

    List<Widget> barWidgets = [];
    for (int i = 0; i < trends.length; i++) {
      final t = trends[i];
      final month = t['month'] as String;
      final payout = t['payout'] as double;
      final percentage = maxPayout > 0 ? (payout / maxPayout) : 0.0;
      final isCurrent = i == trends.length - 1;
      barWidgets.add(_buildBar(month, percentage, isCurrent: isCurrent));
    }

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppTheme.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Salary Trends',
                style: GoogleFonts.outfit(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.textDark,
                ),
              ),
              Text(
                'Net payout over the last ${trends.length} months',
                style: GoogleFonts.inter(
                  fontSize: 11,
                  color: AppTheme.textSecondary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 28),

          SizedBox(
            height: 180,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: barWidgets,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBar(String month, double heightPercentage, {bool isCurrent = false}) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.end,
      children: [
        Container(
          width: 32,
          height: 130 * heightPercentage,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.bottomCenter,
              end: Alignment.topCenter,
              colors: isCurrent
                  ? [AppTheme.primary, AppTheme.primary.withOpacity(0.7)]
                  : [const Color(0xffcbd5e1), const Color(0xffe2e8f0)],
            ),
            borderRadius: const BorderRadius.vertical(top: Radius.circular(6)),
          ),
        ),
        const SizedBox(height: 8),
        Text(
          month,
          style: GoogleFonts.outfit(
            fontSize: 12,
            fontWeight: isCurrent ? FontWeight.bold : FontWeight.w500,
            color: isCurrent ? AppTheme.primary : AppTheme.textSecondary,
          ),
        ),
      ],
    );
  }
}
