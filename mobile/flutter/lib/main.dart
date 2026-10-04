import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:webview_flutter/webview_flutter.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: Color(0xFF090B10),
      systemNavigationBarIconBrightness: Brightness.light,
    ),
  );
  runApp(const EchoDeskMobileApp());
}

class EchoDeskMobileApp extends StatelessWidget {
  const EchoDeskMobileApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ECHODESK — Powered by JOT',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark().copyWith(
        scaffoldBackgroundColor: const Color(0xFF090B10),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFFFF6B18),
          surface: Color(0xFF0C0E15),
        ),
      ),
      home: const EchoDeskWebViewScreen(),
    );
  }
}

class EchoDeskWebViewScreen extends StatefulWidget {
  const EchoDeskWebViewScreen({super.key});

  @override
  State<EchoDeskWebViewScreen> createState() => _EchoDeskWebViewScreenState();
}

class _EchoDeskWebViewScreenState extends State<EchoDeskWebViewScreen> {
  late final WebViewController _controller;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();

    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFF090B10))
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (String url) {
            setState(() {
              _isLoading = true;
            });
          },
          onPageFinished: (String url) {
            setState(() {
              _isLoading = false;
            });
            // Inject Mobile Role
            _controller.runJavaScript(
              "if (window.bridgeEngine) { window.bridgeEngine.setRole('phone'); }",
            );
          },
        ),
      )
      // Loads local bundled index.html or LAN Office Kit station:
      ..loadFlutterAsset('frontend/index.html');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        top: true,
        bottom: false,
        child: Stack(
          children: [
            WebViewWidget(controller: _controller),
            if (_isLoading)
              const Center(
                child: CircularProgressIndicator(
                  color: Color(0xFFFF6B18),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
