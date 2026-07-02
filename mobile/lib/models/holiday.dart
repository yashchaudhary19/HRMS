class Holiday {
  final int id;
  final String title;
  final DateTime date;
  final String? dayName;
  final String holidayType;

  Holiday({
    required this.id,
    required this.title,
    required this.date,
    this.dayName,
    required this.holidayType,
  });

  factory Holiday.fromJson(Map<String, dynamic> json) {
    return Holiday(
      id: json['id'] is int ? json['id'] : int.parse(json['id'].toString()),
      title: json['title'] ?? '',
      date: DateTime.parse(json['date'].toString()),
      dayName: json['day_name'],
      holidayType: json['holiday_type'] ?? 'Public Holiday',
    );
  }
}
