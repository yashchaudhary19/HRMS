import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:go_router/go_router.dart';
import '../providers/auth_provider.dart';
import '../providers/documents_provider.dart';
import '../theme/theme.dart';
import '../models/employee.dart';
import '../models/document.dart';

class ProfileTab extends ConsumerStatefulWidget {
  const ProfileTab({super.key});

  @override
  ConsumerState<ProfileTab> createState() => _ProfileTabState();
}

class _ProfileTabState extends ConsumerState<ProfileTab> {
  final _formKey = GlobalKey<FormState>();
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _bankNameController = TextEditingController();
  final _bankAccountController = TextEditingController();
  final _emergencyContactController = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(documentsProvider.notifier).fetchDocuments();
    });
  }

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _bankNameController.dispose();
    _bankAccountController.dispose();
    _emergencyContactController.dispose();
    super.dispose();
  }

  void _showEditProfileDialog(Employee employee) {
    _firstNameController.text = employee.firstName;
    _lastNameController.text = employee.lastName;
    _bankNameController.text = employee.bankName ?? '';
    _bankAccountController.text = employee.bankAccountNo ?? '';
    _emergencyContactController.text = employee.emergencyContact ?? '';

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: Text(
          'Edit Profile Details',
          style: GoogleFonts.outfit(fontWeight: FontWeight.bold),
        ),
        content: SizedBox(
          width: 400,
          child: SingleChildScrollView(
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  TextFormField(
                    controller: _firstNameController,
                    decoration: const InputDecoration(labelText: 'First Name'),
                    validator: (value) => value == null || value.trim().isEmpty ? 'Required' : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _lastNameController,
                    decoration: const InputDecoration(labelText: 'Last Name'),
                    validator: (value) => value == null || value.trim().isEmpty ? 'Required' : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _bankNameController,
                    decoration: const InputDecoration(labelText: 'Bank Name'),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _bankAccountController,
                    decoration: const InputDecoration(labelText: 'Bank Account Number'),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _emergencyContactController,
                    decoration: const InputDecoration(
                      labelText: 'Emergency Contact Info',
                      helperText: 'e.g. Sarah Sterling (Spouse) • +1 (555) 012-3456',
                      helperMaxLines: 2,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('Cancel', style: GoogleFonts.outfit(color: AppTheme.textSecondary)),
          ),
          ElevatedButton(
            onPressed: () async {
              if (!_formKey.currentState!.validate()) return;
              Navigator.pop(ctx);
              
              try {
                await ref.read(authProvider.notifier).updateProfile(
                  firstName: _firstNameController.text.trim(),
                  lastName: _lastNameController.text.trim(),
                  bankName: _bankNameController.text.trim(),
                  bankAccountNo: _bankAccountController.text.trim(),
                  emergencyContact: _emergencyContactController.text.trim(),
                );
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Profile updated successfully!'),
                      backgroundColor: AppTheme.success,
                      behavior: SnackBarBehavior.floating,
                    ),
                  );
                }
              } catch (e) {
                if (mounted) {
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
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);
    final user = authState.employee;

    final employeeId = user?.employeeId ?? 'EMP-2024-0000';
    final email = user?.email ?? 'employee@company.com';
    final bankName = user?.bankName ?? 'Not Configured';
    final bankAcc = user?.bankAccountNo ?? 'Not Configured';
    
    // Parse emergency contact info
    String contactName = 'No Emergency Contact';
    String contactRelation = 'Spouse';
    String contactPhone = '';
    
    final fullContact = user?.emergencyContact ?? '';
    if (fullContact.isNotEmpty) {
      try {
        if (fullContact.contains(' • ')) {
          final parts = fullContact.split(' • ');
          contactPhone = parts[1];
          if (parts[0].contains('(') && parts[0].contains(')')) {
            final startIdx = parts[0].indexOf('(');
            contactName = parts[0].substring(0, startIdx).trim();
            contactRelation = parts[0].substring(startIdx + 1, parts[0].length - 1).trim();
          } else {
            contactName = parts[0];
            contactRelation = 'Contact';
          }
        } else {
          contactName = fullContact;
          contactRelation = 'Contact';
        }
      } catch (_) {
        contactName = fullContact;
      }
    }

    String roleName = 'Employee';
    if (user != null) {
      if (user.role == 'super_admin') {
        roleName = 'Super Administrator';
      } else if (user.role == 'admin') {
        roleName = 'Administrator';
      } else if (user.role == 'hr') {
        roleName = 'Human Resources Officer';
      } else if (user.role == 'manager') {
        roleName = 'Manager';
      } else {
        roleName = 'Employee';
      }
    }

    String initials = 'JD';
    if (user != null) {
      final f = user.firstName.isNotEmpty ? user.firstName[0].toUpperCase() : '';
      final l = user.lastName.isNotEmpty ? user.lastName[0].toUpperCase() : '';
      initials = '$f$l';
    }

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
        title: Text(
          'Profile Settings',
          style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 18),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // User Summary Card
            Row(
              children: [
                Stack(
                  children: [
                    CircleAvatar(
                      radius: 36,
                      backgroundColor: AppTheme.primaryLight,
                      child: Text(
                        initials,
                        style: GoogleFonts.outfit(
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.primary,
                        ),
                      ),
                    ),
                    Positioned(
                      bottom: 0,
                      right: 0,
                      child: InkWell(
                        onTap: () {
                          if (user != null) _showEditProfileDialog(user);
                        },
                        child: CircleAvatar(
                          radius: 12,
                          backgroundColor: AppTheme.primary,
                          child: const Icon(
                            Icons.edit_rounded,
                            size: 14,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        user != null ? user.fullName : 'Alex Sterling',
                        style: GoogleFonts.outfit(
                          fontSize: 22,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.textDark,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        roleName,
                        style: GoogleFonts.inter(
                          fontSize: 13,
                          color: AppTheme.textSecondary,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // Identity & Biometric ID settings row
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // IDENTITY card
                Expanded(
                  flex: 3,
                  child: Container(
                    height: 135,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppTheme.border),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.person_outline_rounded, color: AppTheme.primary, size: 18),
                            const SizedBox(width: 8),
                            Text(
                              'IDENTITY',
                              style: GoogleFonts.outfit(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: AppTheme.primary,
                                letterSpacing: 1.0,
                              ),
                            ),
                          ],
                        ),
                        const Spacer(),
                        Text(
                          'Employee ID',
                          style: GoogleFonts.inter(fontSize: 10, color: AppTheme.textSecondary),
                        ),
                        Text(
                          employeeId,
                          style: GoogleFonts.outfit(
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                            color: AppTheme.textDark,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Email',
                          style: GoogleFonts.inter(fontSize: 10, color: AppTheme.textSecondary),
                        ),
                        Text(
                          email,
                          overflow: TextOverflow.ellipsis,
                          style: GoogleFonts.inter(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: AppTheme.textDark,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 16),
                
                // Join date / status card
                Expanded(
                  flex: 2,
                  child: Container(
                    height: 135,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xff1e293b),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(Icons.verified_user_rounded, color: Colors.white, size: 24),
                        const Spacer(),
                        Text(
                          'Account',
                          style: GoogleFonts.outfit(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: const Color(0xff94a3b8),
                          ),
                        ),
                        const SizedBox(height: 4),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: AppTheme.success.withOpacity(0.2),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            (user?.isActive ?? true) ? 'Active' : 'Inactive',
                            style: GoogleFonts.outfit(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: AppTheme.success,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 28),

            // Documents section header
            Text(
              'Documents',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.bold,
                fontSize: 18,
                color: AppTheme.textDark,
              ),
            ),
            const SizedBox(height: 12),

            Consumer(
              builder: (context, ref, child) {
                final docsState = ref.watch(documentsProvider);
                if (docsState.isLoading && docsState.documents.isEmpty) {
                  return const Center(child: CircularProgressIndicator());
                }
                if (docsState.documents.isEmpty) {
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8.0),
                    child: Text(
                      'No documents found.',
                      style: GoogleFonts.inter(color: AppTheme.textSecondary, fontSize: 13),
                    ),
                  );
                }
                return Column(
                  children: docsState.documents.map((doc) {
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 12.0),
                      child: _buildDocItem(context, doc.filename, doc.detail),
                    );
                  }).toList(),
                );
              },
            ),
            const SizedBox(height: 12),

            // Bank Details card
            Container(
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
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.account_balance_rounded, color: AppTheme.primary, size: 20),
                          const SizedBox(width: 10),
                          Text(
                            'Bank Details',
                            style: GoogleFonts.outfit(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: AppTheme.textDark,
                            ),
                          ),
                        ],
                      ),
                      IconButton(
                        icon: const Icon(Icons.edit_rounded, size: 16, color: AppTheme.primary),
                        onPressed: () {
                          if (user != null) _showEditProfileDialog(user);
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  _buildBankDetailsRow('Bank', bankName),
                  const Divider(color: AppTheme.border, height: 20),
                  _buildBankDetailsRow('Account No.', bankAcc),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Emergency Contact card
            Container(
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
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.emergency_rounded, color: Colors.red, size: 20),
                          const SizedBox(width: 10),
                          Text(
                            'Emergency Contact',
                            style: GoogleFonts.outfit(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: AppTheme.textDark,
                            ),
                          ),
                        ],
                      ),
                      IconButton(
                        icon: const Icon(Icons.edit_rounded, size: 16, color: AppTheme.primary),
                        onPressed: () {
                          if (user != null) _showEditProfileDialog(user);
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xfff8fafc),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppTheme.border),
                    ),
                    child: Row(
                      children: [
                        CircleAvatar(
                          radius: 20,
                          backgroundColor: AppTheme.primaryLight,
                          child: const Icon(Icons.phone_rounded, color: AppTheme.primary, size: 18),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                contactName,
                                style: GoogleFonts.outfit(
                                  fontSize: 15,
                                  fontWeight: FontWeight.bold,
                                  color: AppTheme.textDark,
                                ),
                              ),
                              if (contactPhone.isNotEmpty)
                                Text(
                                  '$contactRelation • $contactPhone',
                                  style: GoogleFonts.inter(
                                    fontSize: 12,
                                    color: AppTheme.textSecondary,
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _buildDocItem(BuildContext context, String filename, String detail) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppTheme.border),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0xfffef2f2),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(
              Icons.picture_as_pdf_rounded,
              color: AppTheme.error,
              size: 24,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  filename,
                  style: GoogleFonts.outfit(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.textDark,
                  ),
                ),
                Text(
                  detail,
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    color: AppTheme.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.download_rounded, color: AppTheme.textSecondary),
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('Downloading $filename...'),
                  behavior: SnackBarBehavior.floating,
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildBankDetailsRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: GoogleFonts.outfit(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: AppTheme.textSecondary,
          ),
        ),
        Text(
          value,
          style: GoogleFonts.inter(
            fontSize: 14,
            fontWeight: FontWeight.bold,
            color: AppTheme.textDark,
          ),
        ),
      ],
    );
  }
}
