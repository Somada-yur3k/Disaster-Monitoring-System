# Firebase Setup Guide for Disaster Monitoring System

This guide will help you set up Firebase Realtime Database to connect your Arduino sensors with the Disaster Monitoring System dashboard.

## Table of Contents
1. [Firebase Project Setup](#firebase-project-setup)
2. [Database Configuration](#database-configuration)
3. [Arduino Code Setup](#arduino-code-setup)
4. [Web Dashboard Configuration](#web-dashboard-configuration)
5. [Data Structure](#data-structure)
6. [Testing](#testing)

---

## Firebase Project Setup

### Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"** or **"Create a project"**
3. Enter project name: `disaster-monitoring` (or your preferred name)
4. Disable Google Analytics (optional) or enable if you want analytics
5. Click **"Create project"**
6. Wait for project creation to complete

### Step 2: Enable Realtime Database

1. In your Firebase project, click on **"Realtime Database"** in the left sidebar
2. Click **"Create Database"**
3. Choose a location (select closest to your region)
4. Choose **"Start in test mode"** (we'll configure security rules later)
5. Click **"Enable"**

### Step 3: Get Firebase Configuration

1. Click the gear icon ⚙️ next to "Project Overview"
2. Select **"Project settings"**
3. Scroll down to **"Your apps"** section
4. Click the **Web icon** `</>`
5. Register your app with a nickname (e.g., "Disaster Monitoring Dashboard")
6. Copy the Firebase configuration object

Your config will look like this:
```javascript
const firebaseConfig = {
    apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    authDomain: "your-project-id.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project-id.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef1234567890"
};
```

### Step 4: Configure Database Security Rules

1. Go to **Realtime Database** → **Rules** tab
2. Replace the rules with the following (for development/testing):

```json
{
  "rules": {
    "sensors": {
      ".read": true,
      ".write": true
    }
  }
}
```

**⚠️ Important:** For production, implement proper authentication and security rules.

3. Click **"Publish"**

---

## Database Configuration

### Data Structure

Your Firebase Realtime Database should have the following structure:

```
disaster-monitoring/
└── sensors/
    ├── fire/
    │   ├── temperature: 30
    │   ├── smoke: 3
    │   └── timestamp: 1705463779000
    ├── water/
    │   ├── level: 28
    │   ├── flowRate: 6
    │   └── timestamp: 1705463779000
    └── seismic/
        ├── magnitude: 0.1
        ├── depth: 20
        └── timestamp: 1705463779000
```

---

## Arduino Code Setup

### Required Libraries

Install these libraries in Arduino IDE:
- **Firebase ESP32** (for ESP32) or **Firebase Arduino** (for other boards)
- **WiFi** (built-in for ESP32)
- **ArduinoJson** (for JSON handling)

### Arduino Code Example (ESP32)

```cpp
#include <WiFi.h>
#include <FirebaseESP32.h>

// WiFi Credentials
#define WIFI_SSID "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"

// Firebase Configuration
#define FIREBASE_HOST "YOUR_PROJECT_ID-default-rtdb.firebaseio.com"
#define FIREBASE_AUTH "YOUR_DATABASE_SECRET" // Optional, if using auth

// Firebase Data Object
FirebaseData firebaseData;

// Sensor Pins
#define TEMP_SENSOR_PIN A0      // Temperature sensor (e.g., LM35)
#define SMOKE_SENSOR_PIN A1     // Smoke sensor (MQ-2)
#define WATER_LEVEL_PIN A2      // Water level sensor
#define SEISMIC_PIN A3          // Seismic sensor (accelerometer)

void setup() {
    Serial.begin(115200);
    
    // Connect to WiFi
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    Serial.print("Connecting to WiFi");
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    Serial.println();
    Serial.print("Connected with IP: ");
    Serial.println(WiFi.localIP());
    
    // Initialize Firebase
    Firebase.begin(FIREBASE_HOST, FIREBASE_AUTH);
    Firebase.reconnectWiFi(true);
    
    // Set database read timeout
    firebaseData.setBSSLBufferSize(1024, 1024);
    firebaseData.setResponseSize(1024);
    Firebase.setReadTimeout(firebaseData, 1000 * 60);
    Firebase.setwriteSizeLimit(firebaseData, "tiny");
}

void loop() {
    // Read Fire Detection Sensors
    int tempReading = analogRead(TEMP_SENSOR_PIN);
    float temperature = (tempReading * 0.48828125); // Convert to Celsius (for LM35)
    
    int smokeReading = analogRead(SMOKE_SENSOR_PIN);
    int smokeLevel = map(smokeReading, 0, 4095, 0, 100); // Convert to ppm range
    
    // Read Water Level Sensor
    int waterReading = analogRead(WATER_LEVEL_PIN);
    int waterLevel = map(waterReading, 0, 4095, 0, 100); // Convert to percentage
    int flowRate = random(5, 25); // Example: Replace with actual flow sensor reading
    
    // Read Seismic Sensor
    int seismicReading = analogRead(SEISMIC_PIN);
    float magnitude = (seismicReading / 4095.0) * 2.0; // Convert to magnitude (0-2 Mw)
    int depth = random(10, 50); // Example: Replace with actual depth calculation
    
    // Update Firebase - Fire Detection
    Firebase.setFloat(firebaseData, "/sensors/fire/temperature", temperature);
    Firebase.setInt(firebaseData, "/sensors/fire/smoke", smokeLevel);
    Firebase.setInt(firebaseData, "/sensors/fire/timestamp", millis());
    
    // Update Firebase - Water Level
    Firebase.setInt(firebaseData, "/sensors/water/level", waterLevel);
    Firebase.setInt(firebaseData, "/sensors/water/flowRate", flowRate);
    Firebase.setInt(firebaseData, "/sensors/water/timestamp", millis());
    
    // Update Firebase - Seismic Activity
    Firebase.setFloat(firebaseData, "/sensors/seismic/magnitude", magnitude);
    Firebase.setInt(firebaseData, "/sensors/seismic/depth", depth);
    Firebase.setInt(firebaseData, "/sensors/seismic/timestamp", millis());
    
    // Check for errors
    if (firebaseData.dataType() == "null") {
        Serial.println("Firebase update failed!");
    } else {
        Serial.println("Data updated successfully!");
    }
    
    delay(3000); // Update every 3 seconds
}
```

### Alternative: Using HTTP REST API (Any Arduino with WiFi)

If you don't have ESP32, you can use HTTP requests:

```cpp
#include <WiFi.h> // or Ethernet.h for Ethernet shields

#define WIFI_SSID "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"
#define FIREBASE_HOST "YOUR_PROJECT_ID-default-rtdb.firebaseio.com"
#define FIREBASE_AUTH "YOUR_DATABASE_SECRET" // Optional

void setup() {
    Serial.begin(115200);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    Serial.println("WiFi connected");
}

void sendToFirebase(String path, float value) {
    WiFiClient client;
    
    if (client.connect(FIREBASE_HOST, 80)) {
        String json = "{\"" + path + "\":" + String(value) + "}";
        
        client.print("PATCH /" + path + ".json HTTP/1.1\r\n");
        client.print("Host: " + String(FIREBASE_HOST) + "\r\n");
        client.print("Content-Type: application/json\r\n");
        client.print("Content-Length: " + String(json.length()) + "\r\n");
        client.print("\r\n");
        client.print(json);
        
        delay(10);
        client.stop();
    }
}

void loop() {
    // Read sensors and send data
    float temperature = readTemperature();
    sendToFirebase("sensors/fire/temperature", temperature);
    
    delay(3000);
}
```

---

## Web Dashboard Configuration

### Step 1: Update Firebase Config in app.js

1. Open `app.js` in your project
2. Replace the `firebaseConfig` object with your actual Firebase configuration:

```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

### Step 2: Enable Firebase SDK in index.html

Add the Firebase SDK scripts before the closing `</body>` tag in `index.html`:

```html
<!-- Firebase SDK -->
<script type="module">
    import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
    import { getDatabase, ref, onValue } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
    
    // Your Firebase config
    const firebaseConfig = {
        apiKey: "YOUR_API_KEY",
        authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
        projectId: "YOUR_PROJECT_ID",
        storageBucket: "YOUR_PROJECT_ID.appspot.com",
        messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
        appId: "YOUR_APP_ID"
    };
    
    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const database = getDatabase(app);
    
    // Make database available globally
    window.database = database;
</script>
```

### Step 3: Uncomment Firebase Code in app.js

1. Uncomment the Firebase import statements at the top
2. Uncomment the `setupFirebaseListeners()` function call
3. Set `useMockData = false` to disable mock data

---

## Data Structure

### Fire Detection Data
```json
{
  "temperature": 30,    // Temperature in Celsius
  "smoke": 3,           // Smoke level in ppm (0-100)
  "timestamp": 1705463779000
}
```

### Water Level Data
```json
{
  "level": 28,          // Water level percentage (0-100)
  "flowRate": 6,        // Flow rate in L/min (0-50)
  "timestamp": 1705463779000
}
```

### Seismic Activity Data
```json
{
  "magnitude": 0.1,     // Earthquake magnitude (0-10 Mw)
  "depth": 20,          // Depth in kilometers (0-100)
  "timestamp": 1705463779000
}
```

---

## Testing

### Test 1: Manual Data Entry

1. Go to Firebase Console → Realtime Database
2. Click on the database URL
3. Manually add test data:
   - Click `+` next to root
   - Add key: `sensors`
   - Add child: `fire` → `temperature` → value: `45`
   - Add child: `fire` → `smoke` → value: `10`

4. Check your dashboard - it should update automatically!

### Test 2: Arduino Connection

1. Upload the Arduino code to your board
2. Open Serial Monitor to verify WiFi connection
3. Check Firebase Console to see data being written
4. Verify dashboard updates in real-time

### Test 3: Alert Testing

To test alerts, manually set high values in Firebase:
- Fire: Set `temperature` to 65 (should trigger warning)
- Water: Set `level` to 15 (should trigger low warning)
- Seismic: Set `magnitude` to 5.0 (should trigger warning)

---

## Troubleshooting

### Issue: Dashboard not updating
- **Solution**: Check browser console for errors
- Verify Firebase config is correct
- Check Firebase database rules allow read access

### Issue: Arduino can't connect to Firebase
- **Solution**: Verify WiFi credentials
- Check Firebase host URL is correct
- Ensure database is in test mode or rules allow write

### Issue: Data not appearing in Firebase
- **Solution**: Check Arduino Serial Monitor for error messages
- Verify sensor pins are connected correctly
- Test with hardcoded values first

---

## Security Recommendations

For production use:

1. **Implement Authentication**: Use Firebase Authentication
2. **Update Security Rules**: Restrict read/write access
3. **Use HTTPS**: Always use HTTPS for web dashboard
4. **Database Secrets**: Keep Firebase credentials secure

Example production security rules:
```json
{
  "rules": {
    "sensors": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
}
```

---

## Additional Resources

- [Firebase Realtime Database Documentation](https://firebase.google.com/docs/database)
- [Firebase ESP32 Library](https://github.com/mobizt/Firebase-ESP32)
- [Arduino Firebase Tutorial](https://randomnerdtutorials.com/esp32-firebase-realtime-database/)

---

## Support

If you encounter issues:
1. Check Firebase Console for database activity
2. Monitor Arduino Serial output
3. Check browser developer console (F12)
4. Verify all credentials and URLs are correct

Good luck with your Disaster Monitoring System! 🚨







