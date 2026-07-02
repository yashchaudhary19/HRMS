class Announcement {
  final int id;
  final String title;
  final String content;
  final String? tag;
  final bool isUrgent;
  final DateTime createdAt;

  Announcement({
    required this.id,
    required this.title,
    required this.content,
    this.tag,
    required this.isUrgent,
    required this.createdAt,
  });

  factory Announcement.fromJson(Map<String, dynamic> json) {
    return Announcement(
      id: json['id'] is int ? json['id'] : int.parse(json['id'].toString()),
      title: json['title'] ?? '',
      content: json['content'] ?? '',
      tag: json['tag'],
      isUrgent: json['is_urgent'] ?? false,
      createdAt: DateTime.parse(json['created_at'].toString()),
    );
  }
}
