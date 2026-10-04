import React, { useRef } from 'react';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

export default function App() {
  const webViewRef = useRef<WebView>(null);

  // Default to Office Kit local server or bundled assets
  const OFFICE_KIT_URL = 'http://10.0.2.2:3001/'; // 10.0.2.2 maps to host machine in Android emulator

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#090B10" />
      <WebView
        ref={webViewRef}
        source={{ uri: OFFICE_KIT_URL }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        originWhitelist={['*']}
        injectedJavaScript={`
          if (window.bridgeEngine) {
            window.bridgeEngine.setRole('phone');
          }
          true;
        `}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090B10',
  },
  webview: {
    flex: 1,
    backgroundColor: '#090B10',
  },
});
