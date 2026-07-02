import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../providers/helpdesk_provider.dart';
import '../models/help_ticket.dart';
import '../theme/theme.dart';

class HelpTab extends ConsumerStatefulWidget {
  const HelpTab({super.key});

  @override
  ConsumerState<HelpTab> createState() => _HelpTabState();
}

class _HelpTabState extends ConsumerState<HelpTab> {
  final _formKey = GlobalKey<FormState>();
  String _selectedCategory = 'payroll';
  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();
  String _searchQuery = '';
  String? _filterCategory;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(helpdeskProvider.notifier).fetchTickets();
    });
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _refreshData() async {
    await ref.read(helpdeskProvider.notifier).fetchTickets();
  }

  void _openRaiseTicketDialog() {
    _titleController.clear();
    _descriptionController.clear();
    _selectedCategory = 'payroll';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return StatefulBuilder(
          builder: (BuildContext context, StateSetter setModalState) {
            return Container(
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 24,
                bottom: MediaQuery.of(context).viewInsets.bottom + 24,
              ),
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              ),
              child: Form(
                key: _formKey,
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Raise a Support Ticket',
                          style: GoogleFonts.outfit(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                            color: AppTheme.textDark,
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.close_rounded),
                          onPressed: () => Navigator.pop(context),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),

                    // Category dropdown
                    Text(
                      'Category',
                      style: GoogleFonts.outfit(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: AppTheme.textDark,
                      ),
                    ),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(
                      value: _selectedCategory,
                      decoration: const InputDecoration(
                        contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                      ),
                      items: const [
                        DropdownMenuItem(value: 'payroll', child: Text('Payroll & Compensation')),
                        DropdownMenuItem(value: 'benefits', child: Text('Health & Benefits')),
                        DropdownMenuItem(value: 'it_tech', child: Text('IT Technical Support')),
                        DropdownMenuItem(value: 'policy', child: Text('Company HR Policies')),
                      ],
                      onChanged: (val) {
                        if (val != null) {
                          setModalState(() {
                            _selectedCategory = val;
                          });
                        }
                      },
                    ),
                    const SizedBox(height: 16),

                    // Title Input
                    Text(
                      'Subject Title',
                      style: GoogleFonts.outfit(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: AppTheme.textDark,
                      ),
                    ),
                    const SizedBox(height: 8),
                    TextFormField(
                      controller: _titleController,
                      decoration: const InputDecoration(
                        hintText: 'Summary of the issue...',
                      ),
                      validator: (value) {
                        if (value == null || value.trim().isEmpty) {
                          return 'Please enter a ticket title';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),

                    // Description Input
                    Text(
                      'Detailed Description',
                      style: GoogleFonts.outfit(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: AppTheme.textDark,
                      ),
                    ),
                    const SizedBox(height: 8),
                    TextFormField(
                      controller: _descriptionController,
                      maxLines: 4,
                      decoration: const InputDecoration(
                        hintText: 'Explain the details of your issue...',
                      ),
                      validator: (value) {
                        if (value == null || value.trim().isEmpty) {
                          return 'Please describe your request';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 24),

                    // Submit Button
                    Consumer(
                      builder: (context, ref, child) {
                        final helpState = ref.watch(helpdeskProvider);
                        return SizedBox(
                          width: double.infinity,
                          height: 50,
                          child: ElevatedButton(
                            onPressed: helpState.isLoading
                                ? null
                                : () async {
                                    if (!_formKey.currentState!.validate()) return;
                                    try {
                                      await ref.read(helpdeskProvider.notifier).raiseTicket(
                                        category: _selectedCategory,
                                        title: _titleController.text.trim(),
                                        description: _descriptionController.text.trim(),
                                      );
                                      if (context.mounted) {
                                        Navigator.pop(context);
                                        ScaffoldMessenger.of(context).showSnackBar(
                                          const SnackBar(
                                            content: Text('Support ticket raised successfully!'),
                                            backgroundColor: AppTheme.success,
                                            behavior: SnackBarBehavior.floating,
                                          ),
                                        );
                                      }
                                    } catch (e) {
                                      if (context.mounted) {
                                        ScaffoldMessenger.of(context).showSnackBar(
                                          SnackBar(
                                            content: Text(e.toString().replaceAll('DioException: ', '').replaceAll('Exception: ', '')),
                                            backgroundColor: AppTheme.error,
                                            behavior: SnackBarBehavior.floating,
                                          ),
                                        );
                                      }
                                    }
                                  },
                            child: helpState.isLoading
                                ? const SizedBox(
                                    width: 24,
                                    height: 24,
                                    child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
                                  )
                                : const Text('Submit Ticket'),
                          ),
                        );
                      },
                    ),
                  ],
                ),
              ),
            ),
          );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final helpState = ref.watch(helpdeskProvider);

    // Filter tickets based on search and category
    final filteredTickets = helpState.tickets.where((t) {
      final matchesSearch = _searchQuery.isEmpty ||
          t.title.toLowerCase().contains(_searchQuery.toLowerCase()) ||
          t.ticketNo.toLowerCase().contains(_searchQuery.toLowerCase()) ||
          t.description.toLowerCase().contains(_searchQuery.toLowerCase());
      final matchesCategory = _filterCategory == null || t.category == _filterCategory;
      return matchesSearch && matchesCategory;
    }).toList();

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: _refreshData,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'How can we help?',
                style: Theme.of(context).textTheme.displayMedium?.copyWith(
                  fontSize: 26,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.textDark,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Search your tickets or raise a new support request.',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: AppTheme.textSecondary,
                  fontSize: 14,
                ),
              ),
              const SizedBox(height: 20),

              // Search Bar (functional — filters the ticket list)
              Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppTheme.border),
                ),
                child: TextField(
                  decoration: const InputDecoration(
                    prefixIcon: Icon(Icons.search_rounded, color: AppTheme.textSecondary),
                    hintText: 'Search tickets by title or number...',
                    fillColor: Colors.transparent,
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    contentPadding: EdgeInsets.symmetric(vertical: 14, horizontal: 16),
                  ),
                  onChanged: (val) {
                    setState(() {
                      _searchQuery = val;
                    });
                  },
                ),
              ),
              const SizedBox(height: 16),

              // Category Filter chips
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    _buildFilterChip('All', null),
                    const SizedBox(width: 8),
                    _buildFilterChip('Payroll', 'payroll'),
                    const SizedBox(width: 8),
                    _buildFilterChip('Benefits', 'benefits'),
                    const SizedBox(width: 8),
                    _buildFilterChip('IT Tech', 'it_tech'),
                    const SizedBox(width: 8),
                    _buildFilterChip('Policy', 'policy'),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Can't find what you're looking for banner card
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: const Color(0xff0f172a),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      "Can't find what you're looking for?",
                      style: GoogleFonts.outfit(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Our HR team is available Mon-Fri, 9am - 6pm.',
                      style: GoogleFonts.inter(
                        fontSize: 13,
                        color: const Color(0xffcbd5e1),
                      ),
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: ElevatedButton(
                        onPressed: _openRaiseTicketDialog,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppTheme.primary,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.add, color: Colors.white, size: 20),
                            const SizedBox(width: 8),
                            Text(
                              'Raise a Ticket',
                              style: GoogleFonts.outfit(
                                fontSize: 15,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 28),

              // Support Tickets header
              Text(
                _filterCategory != null || _searchQuery.isNotEmpty
                    ? 'Filtered Results (${filteredTickets.length})'
                    : 'My Support Tickets',
                style: GoogleFonts.outfit(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.textDark,
                ),
              ),
              const SizedBox(height: 16),

              // Tickets list
              helpState.isLoading && helpState.tickets.isEmpty
                  ? const Center(child: CircularProgressIndicator())
                  : filteredTickets.isEmpty
                      ? Center(
                          child: Padding(
                            padding: const EdgeInsets.all(24.0),
                            child: Text(
                              _searchQuery.isNotEmpty || _filterCategory != null
                                  ? 'No tickets match your filter.'
                                  : 'No support tickets raised yet.',
                              style: GoogleFonts.inter(color: AppTheme.textSecondary),
                            ),
                          ),
                        )
                      : ListView.separated(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          itemCount: filteredTickets.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 16),
                          itemBuilder: (context, index) {
                            final ticket = filteredTickets[index];
                            return _buildTicketCard(ticket);
                          },
                        ),
              const SizedBox(height: 28),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildFilterChip(String label, String? category) {
    final isSelected = _filterCategory == category;
    return GestureDetector(
      onTap: () {
        setState(() {
          _filterCategory = isSelected ? null : category;
        });
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? AppTheme.primary : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: isSelected ? AppTheme.primary : AppTheme.border),
        ),
        child: Text(
          label,
          style: GoogleFonts.outfit(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: isSelected ? Colors.white : AppTheme.textSecondary,
          ),
        ),
      ),
    );
  }

  Widget _buildTicketCard(HelpTicket ticket) {
    Color tagBg = AppTheme.warningLight;
    Color tagText = AppTheme.warning;
    String statusText = ticket.status.toUpperCase();

    if (ticket.status.toLowerCase() == 'open') {
      tagBg = const Color(0xffe6fbf3);
      tagText = AppTheme.success;
    } else if (ticket.status.toLowerCase() == 'resolved') {
      tagBg = const Color(0xfff1f5f9);
      tagText = AppTheme.textSecondary;
    }

    IconData catIcon = Icons.payment_outlined;
    if (ticket.category == 'benefits') catIcon = Icons.medical_services_outlined;
    if (ticket.category == 'it_tech') catIcon = Icons.devices_outlined;
    if (ticket.category == 'policy') catIcon = Icons.shield_outlined;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 18,
                backgroundColor: const Color(0xfff1f5f9),
                child: Icon(catIcon, size: 18, color: AppTheme.textSecondary),
              ),
              const SizedBox(width: 10),
              Text(
                ticket.ticketNo,
                style: GoogleFonts.outfit(
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.textSecondary,
                ),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: tagBg,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  statusText,
                  style: GoogleFonts.outfit(
                    fontSize: 9,
                    fontWeight: FontWeight.bold,
                    color: tagText,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            ticket.title,
            style: GoogleFonts.outfit(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: AppTheme.textDark,
            ),
          ),
          if (ticket.description.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              ticket.description,
              style: GoogleFonts.inter(
                fontSize: 13,
                color: AppTheme.textSecondary,
                fontWeight: FontWeight.w500,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
          if (ticket.lastMessage != null) ...[
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xfff8fafc),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                '💬 ${ticket.lastMessage!}',
                style: GoogleFonts.inter(
                  fontSize: 12,
                  color: AppTheme.textSecondary,
                ),
              ),
            ),
          ],
          const SizedBox(height: 12),
          Row(
            children: [
              if (ticket.assignedTo != null && ticket.assignedTo!.isNotEmpty) ...[
                CircleAvatar(
                  radius: 10,
                  backgroundColor: AppTheme.primaryLight,
                  child: Text(
                    ticket.assignedTo![0].toUpperCase(),
                    style: GoogleFonts.outfit(fontSize: 8, fontWeight: FontWeight.bold, color: AppTheme.primary),
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  'Assigned to ${ticket.assignedTo}',
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    color: AppTheme.textLight,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ] else if (ticket.closedAt != null) ...[
                const Icon(Icons.check_circle_rounded, size: 14, color: AppTheme.textLight),
                const SizedBox(width: 6),
                Text(
                  'Closed on ${DateFormat('MMM dd, yyyy').format(ticket.closedAt!)}',
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    color: AppTheme.textLight,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ] else ...[
                const Icon(Icons.watch_later_outlined, size: 14, color: AppTheme.textLight),
                const SizedBox(width: 6),
                Text(
                  'Created ${DateFormat('MMM dd').format(ticket.createdAt)}',
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    color: AppTheme.textLight,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}
