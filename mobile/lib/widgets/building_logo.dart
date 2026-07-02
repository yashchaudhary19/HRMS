import 'package:flutter/material.dart';

class BuildingLogo extends StatelessWidget {
  final double size;
  
  const BuildingLogo({super.key, this.size = 80.0});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: const Color(0xff1e293b), // Dark slate blue background
        borderRadius: BorderRadius.circular(size * 0.25),
      ),
      child: Center(
        child: SizedBox(
          width: size * 0.5,
          height: size * 0.5,
          child: CustomPaint(
            painter: _BuildingPainter(),
          ),
        ),
      ),
    );
  }
}

class _BuildingPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.fill;

    final double w = size.width;
    final double h = size.height;

    // Draw main building outline
    final Path buildingPath = Path();
    buildingPath.moveTo(0, h);
    buildingPath.lineTo(0, h * 0.2);
    buildingPath.lineTo(w * 0.6, h * 0.2);
    buildingPath.lineTo(w * 0.6, 0);
    buildingPath.lineTo(w, 0);
    buildingPath.lineTo(w, h);
    buildingPath.close();

    canvas.drawPath(buildingPath, paint);

    // Draw negative windows/details (slate color)
    final windowPaint = Paint()
      ..color = const Color(0xff1e293b)
      ..style = PaintingStyle.fill;

    // Windows in left part
    double winW = w * 0.12;
    double winH = h * 0.12;
    
    // Left column windows
    canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(w * 0.12, h * 0.35, winW, winH), Radius.circular(w * 0.02)), windowPaint);
    canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(w * 0.12, h * 0.55, winW, winH), Radius.circular(w * 0.02)), windowPaint);
    canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(w * 0.12, h * 0.75, winW, winH), Radius.circular(w * 0.02)), windowPaint);

    // Middle column windows
    canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(w * 0.35, h * 0.35, winW, winH), Radius.circular(w * 0.02)), windowPaint);
    canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(w * 0.35, h * 0.55, winW, winH), Radius.circular(w * 0.02)), windowPaint);
    canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(w * 0.35, h * 0.75, winW, winH), Radius.circular(w * 0.02)), windowPaint);

    // Right tower windows
    canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(w * 0.73, h * 0.15, winW, winH), Radius.circular(w * 0.02)), windowPaint);
    canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(w * 0.73, h * 0.35, winW, winH), Radius.circular(w * 0.02)), windowPaint);
    canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(w * 0.73, h * 0.55, winW, winH), Radius.circular(w * 0.02)), windowPaint);
    canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(w * 0.73, h * 0.75, winW, winH), Radius.circular(w * 0.02)), windowPaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
