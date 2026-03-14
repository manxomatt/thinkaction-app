# Android Safe Area Setup

Untuk mengatasi masalah menubar bawah yang tertutup oleh 3 tombol navigasi Android, ikuti langkah-langkah berikut:

## 1. Perubahan yang Sudah Dilakukan (Web/CSS)

Perubahan berikut sudah diterapkan di codebase:

### a. `nuxt.config.ts`
- Menambahkan meta tag viewport dengan `viewport-fit=cover`

### b. `app/assets/main.css`
- Menambahkan CSS custom properties untuk safe area insets
- Menambahkan utility classes untuk safe area padding

### c. `app/layouts/default.vue`
- Bottom navigation bar sekarang menggunakan `pb-[env(safe-area-inset-bottom,0px)]`
- Main content area menggunakan padding yang memperhitungkan safe area

### d. `app/plugins/002.safe-area.client.ts`
- Plugin untuk menambahkan fallback CSS untuk Android

## 2. Konfigurasi Android Native (Wajib)

Setelah menjalankan `cap sync`, Anda perlu mengubah beberapa file di folder `android/`:

### a. Edit `android/app/src/main/res/values/styles.xml`

Tambahkan atau ubah style untuk mengaktifkan edge-to-edge display:

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="Theme.AppCompat.Light.NoActionBar">
        <item name="colorPrimary">@color/colorPrimary</item>
        <item name="colorPrimaryDark">@color/colorPrimaryDark</item>
        <item name="colorAccent">@color/colorAccent</item>
        
        <!-- Enable edge-to-edge display -->
        <item name="android:windowDrawsSystemBarBackgrounds">true</item>
        <item name="android:statusBarColor">@android:color/transparent</item>
        <item name="android:navigationBarColor">@android:color/transparent</item>
        
        <!-- For API 29+ (Android 10+) -->
        <item name="android:enforceNavigationBarContrast">false</item>
        <item name="android:enforceStatusBarContrast">false</item>
    </style>
    
    <style name="AppTheme.NoActionBar" parent="AppTheme">
        <item name="windowActionBar">false</item>
        <item name="windowNoTitle">true</item>
    </style>
</resources>
```

### b. Edit `android/app/src/main/java/.../MainActivity.java`

Tambahkan kode untuk mengaktifkan edge-to-edge di MainActivity:

```java
package id.thinkaction.app;

import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;

import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Enable edge-to-edge display
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        
        // Make navigation bar transparent
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            getWindow().setNavigationBarColor(android.graphics.Color.TRANSPARENT);
            getWindow().setStatusBarColor(android.graphics.Color.TRANSPARENT);
        }
        
        // Set light status bar icons (dark icons on light background)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            WindowInsetsControllerCompat windowInsetsController = 
                WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
            windowInsetsController.setAppearanceLightStatusBars(true);
            windowInsetsController.setAppearanceLightNavigationBars(true);
        }
    }
}
```

### c. Tambahkan dependency di `android/app/build.gradle`

Pastikan AndroidX Core library sudah ada:

```gradle
dependencies {
    implementation "androidx.core:core:1.12.0"
    implementation "androidx.core:core-ktx:1.12.0"
    // ... dependencies lainnya
}
```

## 3. Alternatif: Menggunakan @capacitor/status-bar

Jika Anda ingin menggunakan plugin Capacitor untuk mengatur status bar:

```bash
npm install @capacitor/status-bar
npx cap sync
```

Kemudian di plugin Nuxt:

```typescript
import { StatusBar, Style } from '@capacitor/status-bar';

// Set status bar style
await StatusBar.setStyle({ style: Style.Light });

// Make status bar transparent
await StatusBar.setBackgroundColor({ color: '#00000000' });

// Set overlay mode (content goes behind status bar)
await StatusBar.setOverlaysWebView({ overlay: true });
```

## 4. Testing

Setelah melakukan perubahan:

1. Jalankan `npm run cap:sync` atau `bun run cap:sync`
2. Buka Android Studio dengan `npm run cap:android`
3. Build dan jalankan di device/emulator
4. Pastikan menubar bawah tidak tertutup oleh navigation bar Android

## Troubleshooting

### Menubar masih tertutup?

1. Pastikan `viewport-fit=cover` ada di meta tag
2. Cek apakah `env(safe-area-inset-bottom)` didukung di WebView
3. Pastikan edge-to-edge sudah diaktifkan di MainActivity
4. Coba restart aplikasi setelah perubahan

### Safe area tidak terdeteksi?

1. Pastikan Android API level minimal 28 (Android 9)
2. Cek apakah WebView sudah diupdate ke versi terbaru
3. Gunakan fallback CSS dengan padding manual jika diperlukan

## Referensi

- [Capacitor Android Configuration](https://capacitorjs.com/docs/android/configuration)
- [Android Edge-to-Edge](https://developer.android.com/develop/ui/views/layout/edge-to-edge)
- [CSS env() function](https://developer.mozilla.org/en-US/docs/Web/CSS/env)
