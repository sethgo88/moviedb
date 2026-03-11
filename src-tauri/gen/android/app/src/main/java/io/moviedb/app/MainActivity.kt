package io.moviedb.app

import android.os.Bundle
import android.webkit.WebSettings
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }

  // Release builds serve from https://tauri.localhost. Without this, fetch()
  // calls to HTTP PocketBase URLs are blocked as mixed content by the WebView.
  // The Tauri CSP (tauri.conf.json) must also be null — Tauri adds
  // upgrade-insecure-requests internally which silently upgrades http:// to
  // https://, breaking HTTP PocketBase connections regardless of connect-src.
  override fun onWebViewCreate(webView: WebView) {
    webView.settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
  }
}
