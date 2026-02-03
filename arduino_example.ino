/*
 * Disaster Monitoring System - Arduino Code Example
 * 
 * This code demonstrates how to send sensor data to Firebase Realtime Database
 * Compatible with ESP32 (recommended) or ESP8266
 * 
 * Required Libraries:
 * - Firebase ESP32 (for ESP32) or Firebase ESP8266 (for ESP8266)
 * - WiFi (built-in)
 * - ArduinoJson
 * 
 * Installation:
 * 1. Install libraries via Arduino Library Manager
 * 2. Update WiFi credentials below
 * 3. Update Firebase configuration
 * 4. Upload to your board
 */

#include <WiFi.h>
#include <FirebaseESP32.h>  // For ESP32
// #include <FirebaseESP8266.h>  // For ESP8266 (uncomment if using ESP8266)

// ========== CONFIGURATION ==========
// WiFi Credentials
#define WIFI_SSID "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"

// Firebase Configuration
#define FIREBASE_HOST "YOUR_PROJECT_ID-default-rtdb.firebaseio.com"
#define FIREBASE_AUTH "YOUR_DATABASE_SECRET"  // Optional, leave empty if not using auth

// Sensor Pins (adjust based on your hardware)
#define TEMP_SENSOR_PIN A0      // Temperature sensor (LM35 or similar)
#define SMOKE_SENSOR_PIN A1     // Smoke sensor (MQ-2)
#define WATER_LEVEL_PIN A2      // Water level sensor
#define SEISMIC_PIN A3          // Seismic sensor (accelerometer/ADXL345)

// ========== FIREBASE SETUP ==========
FirebaseData firebaseData;
FirebaseConfig firebaseConfig;
FirebaseAuth firebaseAuth;

// ========== SETUP FUNCTION ==========
void setup() {
    Serial.begin(115200);
    delay(1000);
    
    Serial.println("\n=== Disaster Monitoring System ===");
    
    // Initialize sensor pins
    pinMode(TEMP_SENSOR_PIN, INPUT);
    pinMode(SMOKE_SENSOR_PIN, INPUT);
    pinMode(WATER_LEVEL_PIN, INPUT);
    pinMode(SEISMIC_PIN, INPUT);
    
    // Connect to WiFi
    Serial.print("Connecting to WiFi: ");
    Serial.println(WIFI_SSID);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    
    Serial.println();
    Serial.println("WiFi connected!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
    
    // Initialize Firebase
    firebaseConfig.host = FIREBASE_HOST;
    firebaseConfig.signer.tokens.legacy_token = FIREBASE_AUTH;
    
    Firebase.begin(&firebaseConfig, &firebaseAuth);
    Firebase.reconnectWiFi(true);
    
    // Set Firebase settings
    firebaseData.setBSSLBufferSize(1024, 1024);
    firebaseData.setResponseSize(1024);
    Firebase.setReadTimeout(firebaseData, 1000 * 60);
    Firebase.setwriteSizeLimit(firebaseData, "tiny");
    
    Serial.println("Firebase initialized!");
    Serial.println("Starting sensor monitoring...\n");
}

// ========== MAIN LOOP ==========
void loop() {
    // Read Fire Detection Sensors
    int tempReading = analogRead(TEMP_SENSOR_PIN);
    // Convert to Celsius (for LM35: 10mV per degree, 0-3.3V = 0-330, so reading/1024*330)
    float temperature = (tempReading / 4095.0) * 330.0;  // Adjust formula for your sensor
    
    int smokeReading = analogRead(SMOKE_SENSOR_PIN);
    // Convert to ppm (0-100 range for display)
    int smokeLevel = map(smokeReading, 0, 4095, 0, 100);
    
    // Read Water Level Sensor
    int waterReading = analogRead(WATER_LEVEL_PIN);
    // Convert to percentage (0-100%)
    int waterLevel = map(waterReading, 0, 4095, 0, 100);
    
    // Calculate flow rate (example: based on water level change)
    // Replace with actual flow sensor reading if available
    static int lastWaterLevel = 0;
    int flowRate = abs(waterLevel - lastWaterLevel) * 2;  // Simplified calculation
    flowRate = constrain(flowRate, 0, 50);  // Limit to 0-50 L/min
    lastWaterLevel = waterLevel;
    
    // Read Seismic Sensor
    int seismicReading = analogRead(SEISMIC_PIN);
    // Convert to magnitude (0-2 Mw for normal monitoring)
    float magnitude = (seismicReading / 4095.0) * 2.0;
    
    // Calculate depth (example: based on sensor reading)
    // Replace with actual depth calculation if available
    int depth = map(seismicReading, 0, 4095, 10, 50);  // 10-50 km range
    
    // Get current timestamp
    unsigned long timestamp = millis();
    
    // ========== SEND TO FIREBASE ==========
    
    // Update Fire Detection Data
    if (Firebase.setFloat(firebaseData, "/sensors/fire/temperature", temperature)) {
        Serial.print("Fire Temp: ");
        Serial.print(temperature);
        Serial.println("°C");
    } else {
        Serial.println("Firebase Error: " + firebaseData.errorReason());
    }
    
    if (Firebase.setInt(firebaseData, "/sensors/fire/smoke", smokeLevel)) {
        Serial.print("Smoke Level: ");
        Serial.print(smokeLevel);
        Serial.println(" ppm");
    }
    
    if (Firebase.setInt(firebaseData, "/sensors/fire/timestamp", timestamp)) {
        // Timestamp updated
    }
    
    // Update Water Level Data
    if (Firebase.setInt(firebaseData, "/sensors/water/level", waterLevel)) {
        Serial.print("Water Level: ");
        Serial.print(waterLevel);
        Serial.println("%");
    }
    
    if (Firebase.setInt(firebaseData, "/sensors/water/flowRate", flowRate)) {
        Serial.print("Flow Rate: ");
        Serial.print(flowRate);
        Serial.println(" L/min");
    }
    
    if (Firebase.setInt(firebaseData, "/sensors/water/timestamp", timestamp)) {
        // Timestamp updated
    }
    
    // Update Seismic Activity Data
    if (Firebase.setFloat(firebaseData, "/sensors/seismic/magnitude", magnitude)) {
        Serial.print("Magnitude: ");
        Serial.print(magnitude);
        Serial.println(" Mw");
    }
    
    if (Firebase.setInt(firebaseData, "/sensors/seismic/depth", depth)) {
        Serial.print("Depth: ");
        Serial.print(depth);
        Serial.println(" km");
    }
    
    if (Firebase.setInt(firebaseData, "/sensors/seismic/timestamp", timestamp)) {
        // Timestamp updated
    }
    
    Serial.println("---");
    
    // Wait 3 seconds before next reading
    delay(3000);
}

/*
 * NOTES:
 * 
 * 1. Sensor Calibration:
 *    - Adjust the conversion formulas based on your specific sensors
 *    - Calibrate each sensor for accurate readings
 * 
 * 2. Temperature Sensor (LM35):
 *    - Output: 10mV per degree Celsius
 *    - Formula: (reading / 4095) * 3300 / 10 = temperature in Celsius
 * 
 * 3. Smoke Sensor (MQ-2):
 *    - Requires calibration for accurate ppm readings
 *    - Adjust mapping based on your sensor's characteristics
 * 
 * 4. Water Level Sensor:
 *    - Adjust mapping based on your sensor's range
 *    - Some sensors may need different voltage references
 * 
 * 5. Seismic Sensor:
 *    - For ADXL345 or similar accelerometers, use appropriate libraries
 *    - Convert acceleration to magnitude using proper formulas
 * 
 * 6. Error Handling:
 *    - Add retry logic for failed Firebase writes
 *    - Implement local data buffering if WiFi is unstable
 * 
 * 7. Power Management:
 *    - Consider deep sleep mode for battery-powered applications
 *    - Adjust update frequency based on power constraints
 */







