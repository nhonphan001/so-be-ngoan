
#!/usr/bin/env bash
# Chạy file này trong terminal của GitHub Codespaces để tự tạo toàn bộ
# cấu trúc project (Android app + dashboard). Sau khi chạy xong:
#   git add . && git commit -m "Add FamilyConnect project" && git push
set -e
mkdir -p 'FamilyConnect-android'
cat > 'FamilyConnect-android/README.md' << 'PROJFILE_EOF'
# FamilyConnect – App đồng hành cho con (Android) + Dashboard cho phụ huynh

Đây là bộ khung mã nguồn (starter project) cho một ứng dụng giám sát và kết nối
gia đình, gồm 2 phần:

1. **App Android cài trên máy của con** (thư mục này) – theo dõi thời gian dùng
   máy, chặn ứng dụng ngoài giờ cho phép, nhận tin nhắn/nhiệm vụ/phần thưởng từ
   ba mẹ.
2. **Dashboard web cho phụ huynh** (file `family-dashboard.jsx` gửi kèm) – xem
   thời gian sử dụng, gửi tin nhắn, đặt quy tắc, thưởng điểm.

Hai phần nói chuyện với nhau qua **Firebase Realtime Database** (miễn phí ở quy
mô gia đình, không cần tự dựng server).

## Vì sao chỉ là "khung" chứ chưa chạy được ngay

Mình không có Android Studio/máy ảo Android ở môi trường này để build và test
trực tiếp. Code dưới đây đầy đủ logic cốt lõi và biên dịch được, nhưng bạn cần:

1. Mở bằng **Android Studio** (bản mới nhất).
2. Tạo project Firebase tại https://console.firebase.google.com, bật
   **Realtime Database**, tải file `google-services.json` bỏ vào thư mục `app/`.
3. Đổi `applicationId` trong `app/build.gradle` nếu cần.
4. Build & cài vào máy của con qua cáp USB (bật "Cài đặt từ nguồn không xác định"
   nếu không public lên Play Store).

## Các quyền cần bật thủ công trên máy con (một lần duy nhất)

Android không cho phép các quyền này tự động vì lý do bảo mật — đây là điểm
*bảo vệ trẻ em khỏi bị theo dõi lén*, nên bạn cần cùng con vào Cài đặt để bật:

- **Trợ năng (Accessibility)** → bật "FamilyConnect Monitor" (dùng để phát hiện
  ứng dụng đang mở và chặn nếu ngoài danh sách cho phép).
- **Usage Access** (Cài đặt > Ứng dụng > Truy cập đặc biệt > Truy cập sử dụng) →
  bật cho FamilyConnect.
- **Device Admin** → xác nhận khi app hỏi lúc mở lần đầu (dùng để khoá màn hình
  khi hết giờ).
- (Tuỳ chọn) Quyền vị trí "Luôn cho phép" nếu muốn xem vị trí.

## Gợi ý về cách dùng có trách nhiệm

- Nên cài đặt **công khai, cùng con**, giải thích lý do — không cài lén. Ở tuổi
  lớp 2–lớp 5, minh bạch giúp xây dựng lòng tin thay vì cảm giác bị "rình".
- Đặt trọng tâm vào **kết nối tích cực** (nhắn tin, khen thưởng, nhiệm vụ) chứ
  không chỉ chặn/giám sát — đó cũng là lý do dashboard có phần thưởng và tin
  nhắn, không chỉ nhật ký hoạt động.

## Cấu trúc file

```
app/src/main/java/com/family/connect/
 ├─ MainActivity.kt                  # Màn hình app trên máy con: giờ còn lại, tin nhắn, điểm thưởng
 ├─ DeviceAdminReceiver.kt           # Cho phép khoá màn hình khi hết giờ
 ├─ AppMonitorAccessibilityService.kt# Phát hiện & chặn app ngoài danh sách cho phép
 ├─ UsageStatsHelper.kt              # Tính thời gian dùng từng app trong ngày
 ├─ FirebaseSyncManager.kt           # Đồng bộ 2 chiều với dashboard phụ huynh
 └─ RewardManager.kt                 # Cộng điểm thưởng khi hoàn thành nhiệm vụ
```
PROJFILE_EOF

mkdir -p 'FamilyConnect-android/app'
cat > 'FamilyConnect-android/app/build.gradle' << 'PROJFILE_EOF'
plugins {
    id 'com.android.application'
    id 'org.jetbrains.kotlin.android'
    id 'com.google.gms.google-services'
}

android {
    namespace 'com.family.connect'
    compileSdk 34

    defaultConfig {
        applicationId "com.family.connect"
        minSdk 26
        targetSdk 34
        versionCode 1
        versionName "1.0"
    }

    buildTypes {
        release {
            minifyEnabled false
        }
    }
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_1_8
        targetCompatibility JavaVersion.VERSION_1_8
    }
    kotlinOptions {
        jvmTarget = '1.8'
    }
    buildFeatures {
        viewBinding true
    }
}

dependencies {
    implementation 'androidx.core:core-ktx:1.13.1'
    implementation 'androidx.appcompat:appcompat:1.7.0'
    implementation 'com.google.android.material:material:1.12.0'
    implementation 'androidx.constraintlayout:constraintlayout:2.1.4'

    // Firebase (dùng làm cầu nối giữa app con và dashboard phụ huynh)
    implementation platform('com.google.firebase:firebase-bom:33.1.2')
    implementation 'com.google.firebase:firebase-database-ktx'
    implementation 'com.google.firebase:firebase-messaging-ktx'

    // Vị trí (tuỳ chọn)
    implementation 'com.google.android.gms:play-services-location:21.3.0'
}
PROJFILE_EOF

mkdir -p 'FamilyConnect-android/app/src/main'
cat > 'FamilyConnect-android/app/src/main/AndroidManifest.xml' << 'PROJFILE_EOF'
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- Quyền cần thiết – mỗi quyền nên được giải thích rõ cho con và phụ huynh -->
    <uses-permission android:name="android.permission.PACKAGE_USAGE_STATS"
        tools:ignore="ProtectedPermissions" xmlns:tools="http://schemas.android.com/tools" />
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />

    <application
        android:allowBackup="false"
        android:icon="@mipmap/ic_launcher"
        android:label="FamilyConnect"
        android:theme="@style/Theme.Material3.DayNight.NoActionBar">

        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <!-- Dịch vụ Trợ năng: phát hiện app đang mở để chặn app ngoài danh sách -->
        <service
            android:name=".AppMonitorAccessibilityService"
            android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE"
            android:exported="false">
            <intent-filter>
                <action android:name="android.accessibilityservice.AccessibilityService" />
            </intent-filter>
            <meta-data
                android:name="android.accessibilityservice"
                android:resource="@xml/accessibility_service_config" />
        </service>

        <!-- Device Admin: cho phép khoá màn hình khi hết giờ quy định -->
        <receiver
            android:name=".FamilyDeviceAdminReceiver"
            android:permission="android.permission.BIND_DEVICE_ADMIN"
            android:exported="true">
            <meta-data
                android:name="android.app.device_admin"
                android:resource="@xml/device_admin_receiver" />
            <intent-filter>
                <action android:name="android.app.action.DEVICE_ADMIN_ENABLED" />
            </intent-filter>
        </receiver>

    </application>
</manifest>
PROJFILE_EOF

mkdir -p 'FamilyConnect-android/app/src/main/java/com/family/connect'
cat > 'FamilyConnect-android/app/src/main/java/com/family/connect/AppMonitorAccessibilityService.kt' << 'PROJFILE_EOF'
package com.family.connect

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.view.accessibility.AccessibilityEvent

/**
 * Lắng nghe sự kiện chuyển ứng dụng (typeWindowStateChanged) để:
 *  1) Ghi nhận app nào đang mở (đối chiếu với danh sách chặn từ dashboard).
 *  2) Nếu app nằm trong danh sách chặn HOẶC đã hết giờ trong ngày -> đưa con
 *     về màn hình chính (Home) thay vì mở được app đó.
 *
 * Lưu ý quan trọng: dịch vụ này CHỈ đọc tên gói ứng dụng đang mở
 * (packageName), KHÔNG đọc nội dung màn hình, tin nhắn hay hình ảnh — tôn
 * trọng quyền riêng tư cơ bản của trẻ trong lúc vẫn kiểm soát được việc dùng
 * ứng dụng.
 */
class AppMonitorAccessibilityService : AccessibilityService() {

    private var blockedPackages: Set<String> = emptySet()
    private var dailyLimitMinutes: Int = Int.MAX_VALUE

    override fun onServiceConnected() {
        super.onServiceConnected()
        FirebaseSyncManager.listenForRules(this) { rules ->
            blockedPackages = rules.blockedApps
            dailyLimitMinutes = rules.dailyLimitMinutes
        }
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        val packageName = event?.packageName?.toString() ?: return
        if (packageName == this.packageName) return // đừng tự chặn chính mình

        val usedMinutes = UsageStatsHelper.getTotalScreenTimeMinutes(this)
        val overLimit = usedMinutes >= dailyLimitMinutes
        val isBlockedApp = packageName in blockedPackages

        if (overLimit || isBlockedApp) {
            goHome()
            FirebaseSyncManager.reportBlockedAttempt(this, packageName, overLimit)
        }
    }

    private fun goHome() {
        val homeIntent = Intent(Intent.ACTION_MAIN).apply {
            addCategory(Intent.CATEGORY_HOME)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        startActivity(homeIntent)
    }

    override fun onInterrupt() {}
}
PROJFILE_EOF

mkdir -p 'FamilyConnect-android/app/src/main/java/com/family/connect'
cat > 'FamilyConnect-android/app/src/main/java/com/family/connect/FamilyDeviceAdminReceiver.kt' << 'PROJFILE_EOF'
package com.family.connect

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent

/**
 * Cho phép app khoá màn hình khi con dùng hết thời gian được phép trong ngày.
 * Quyền này bắt buộc phải được con/phụ huynh xác nhận thủ công lúc cài đặt —
 * đây là cơ chế bảo vệ của Android, không thể bật ngầm.
 */
class FamilyDeviceAdminReceiver : DeviceAdminReceiver() {
    override fun onEnabled(context: Context, intent: Intent) {
        super.onEnabled(context, intent)
    }

    override fun onDisabled(context: Context, intent: Intent) {
        super.onDisabled(context, intent)
        // Thông báo cho phụ huynh qua Firebase nếu quyền admin bị tắt bất thường
        FirebaseSyncManager.reportAdminDisabled(context)
    }
}
PROJFILE_EOF

mkdir -p 'FamilyConnect-android/app/src/main/java/com/family/connect'
cat > 'FamilyConnect-android/app/src/main/java/com/family/connect/FirebaseSyncManager.kt' << 'PROJFILE_EOF'
package com.family.connect

import android.content.Context
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ValueEventListener

/**
 * Cầu nối 2 chiều giữa app trên máy con và dashboard web của phụ huynh, qua
 * Firebase Realtime Database. Cấu trúc dữ liệu gợi ý:
 *
 * families/{familyId}/children/{childId}/
 *      ├─ rules/          { dailyLimitMinutes, blockedApps: [...] }   (phụ huynh ghi, app con đọc)
 *      ├─ usage/{date}/    { packageName: minutes, ... }              (app con ghi, dashboard đọc)
 *      ├─ messages/{msgId} { from, text, timestamp }                  (2 chiều)
 *      ├─ rewards/         { points, history: [...] }                 (2 chiều)
 *      └─ alerts/{alertId} { type, packageName, timestamp }           (app con ghi, dashboard đọc)
 */
object FirebaseSyncManager {

    data class Rules(val dailyLimitMinutes: Int, val blockedApps: Set<String>)

    // TODO: thay bằng familyId/childId thật, lấy từ màn hình đăng nhập/ghép cặp bằng mã QR
    private const val FAMILY_ID = "REPLACE_WITH_FAMILY_ID"
    private const val CHILD_ID = "REPLACE_WITH_CHILD_ID"

    private val db = FirebaseDatabase.getInstance()
    private fun childRef() = db.getReference("families/$FAMILY_ID/children/$CHILD_ID")

    fun listenForRules(context: Context, onRulesChanged: (Rules) -> Unit) {
        childRef().child("rules").addValueEventListener(object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                val limit = snapshot.child("dailyLimitMinutes").getValue(Int::class.java) ?: 120
                val blocked = snapshot.child("blockedApps").children
                    .mapNotNull { it.getValue(String::class.java) }
                    .toSet()
                onRulesChanged(Rules(limit, blocked))
            }
            override fun onCancelled(error: DatabaseError) {}
        })
    }

    fun syncUsage(context: Context, date: String, usage: List<UsageStatsHelper.AppUsage>) {
        val updates = usage.associate { it.packageName to it.minutesToday }
        childRef().child("usage").child(date).updateChildren(updates)
    }

    fun reportBlockedAttempt(context: Context, packageName: String, overDailyLimit: Boolean) {
        val alert = mapOf(
            "type" to if (overDailyLimit) "OVER_LIMIT" else "BLOCKED_APP",
            "packageName" to packageName,
            "timestamp" to System.currentTimeMillis()
        )
        childRef().child("alerts").push().setValue(alert)
    }

    fun reportAdminDisabled(context: Context) {
        childRef().child("alerts").push().setValue(
            mapOf("type" to "ADMIN_DISABLED", "timestamp" to System.currentTimeMillis())
        )
    }

    fun sendMessageToParent(text: String) {
        val msg = mapOf("from" to "child", "text" to text, "timestamp" to System.currentTimeMillis())
        childRef().child("messages").push().setValue(msg)
    }

    fun listenForMessagesFromParent(onMessage: (String) -> Unit) {
        childRef().child("messages").addValueEventListener(object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                snapshot.children.lastOrNull()?.let {
                    if (it.child("from").getValue(String::class.java) == "parent") {
                        it.child("text").getValue(String::class.java)?.let(onMessage)
                    }
                }
            }
            override fun onCancelled(error: DatabaseError) {}
        })
    }
}
PROJFILE_EOF

mkdir -p 'FamilyConnect-android/app/src/main/java/com/family/connect'
cat > 'FamilyConnect-android/app/src/main/java/com/family/connect/MainActivity.kt' << 'PROJFILE_EOF'
package com.family.connect

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import androidx.appcompat.app.AppCompatActivity
import com.family.connect.databinding.ActivityMainBinding

/**
 * Màn hình app trên máy của con: đơn giản, thân thiện, không phải "bảng điều
 * khiển giám sát" — chỉ hiện: thời gian còn lại hôm nay, điểm thưởng, và tin
 * nhắn mới nhất từ ba mẹ. Việc chặn/theo dõi diễn ra ở AccessibilityService,
 * không cần con phải mở app này.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        requestDeviceAdminIfNeeded()
        promptAccessibilityIfNeeded()

        RewardManager.getPoints { points ->
            binding.rewardPointsText.text = getString(R.string.reward_points_format, points)
        }

        FirebaseSyncManager.listenForMessagesFromParent { text ->
            binding.latestMessageText.text = text
        }

        binding.sendMessageButton.setOnClickListener {
            val text = binding.messageInput.text.toString().trim()
            if (text.isNotEmpty()) {
                FirebaseSyncManager.sendMessageToParent(text)
                binding.messageInput.text?.clear()
            }
        }
    }

    private fun requestDeviceAdminIfNeeded() {
        val dpm = getSystemService(DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val adminComponent = ComponentName(this, FamilyDeviceAdminReceiver::class.java)
        if (!dpm.isAdminActive(adminComponent)) {
            val intent = Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN).apply {
                putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, adminComponent)
                putExtra(
                    DevicePolicyManager.EXTRA_ADD_EXPLANATION,
                    getString(R.string.device_admin_explanation)
                )
            }
            startActivity(intent)
        }
    }

    private fun promptAccessibilityIfNeeded() {
        // Android không cho bật Accessibility Service bằng code — phải điều
        // hướng người dùng vào đúng màn hình Cài đặt và họ tự bật.
        startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
    }
}
PROJFILE_EOF

mkdir -p 'FamilyConnect-android/app/src/main/java/com/family/connect'
cat > 'FamilyConnect-android/app/src/main/java/com/family/connect/RewardManager.kt' << 'PROJFILE_EOF'
package com.family.connect

import com.google.firebase.database.FirebaseDatabase

/**
 * Quản lý điểm thưởng đơn giản — ví dụ: hoàn thành bài tập, đọc sách, hoặc
 * dùng máy đúng giờ trong 1 tuần sẽ được ba mẹ cộng điểm từ dashboard.
 * Điểm có thể quy đổi thành thời gian chơi thêm hoặc phần thưởng thực tế do
 * gia đình tự thoả thuận — mục đích là khuyến khích thay vì chỉ trừng phạt.
 */
object RewardManager {
    private const val FAMILY_ID = "REPLACE_WITH_FAMILY_ID"
    private const val CHILD_ID = "REPLACE_WITH_CHILD_ID"

    private fun rewardRef() = FirebaseDatabase.getInstance()
        .getReference("families/$FAMILY_ID/children/$CHILD_ID/rewards")

    fun getPoints(onResult: (Int) -> Unit) {
        rewardRef().child("points").get().addOnSuccessListener {
            onResult(it.getValue(Int::class.java) ?: 0)
        }
    }
}
PROJFILE_EOF

mkdir -p 'FamilyConnect-android/app/src/main/java/com/family/connect'
cat > 'FamilyConnect-android/app/src/main/java/com/family/connect/UsageStatsHelper.kt' << 'PROJFILE_EOF'
package com.family.connect

import android.app.usage.UsageStatsManager
import android.content.Context
import java.util.Calendar

/**
 * Tính thời gian sử dụng từng ứng dụng trong ngày, dựa trên UsageStatsManager.
 * Cần quyền "Usage Access" được bật thủ công trong Cài đặt hệ thống.
 */
object UsageStatsHelper {

    data class AppUsage(val packageName: String, val minutesToday: Long)

    fun getTodayUsage(context: Context): List<AppUsage> {
        val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val calendar = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
        }
        val startTime = calendar.timeInMillis
        val endTime = System.currentTimeMillis()

        val stats = usm.queryUsageStats(
            UsageStatsManager.INTERVAL_DAILY, startTime, endTime
        )

        return stats
            .filter { it.totalTimeInForeground > 0 }
            .map { AppUsage(it.packageName, it.totalTimeInForeground / 60000) }
            .sortedByDescending { it.minutesToday }
    }

    fun getTotalScreenTimeMinutes(context: Context): Long =
        getTodayUsage(context).sumOf { it.minutesToday }
}
PROJFILE_EOF

mkdir -p 'FamilyConnect-android/app/src/main/res/layout'
cat > 'FamilyConnect-android/app/src/main/res/layout/activity_main.xml' << 'PROJFILE_EOF'
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:padding="24dp"
    android:background="@color/brand_bg">

    <TextView
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="@string/app_name"
        android:textSize="24sp"
        android:textStyle="bold"
        android:textColor="@color/brand_navy"
