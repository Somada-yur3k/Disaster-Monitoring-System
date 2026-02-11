#include <DHT.h>
#include <WiFiS3.h>
#include <ArduinoHttpClient.h>

/* ==========================================
   1. WIFI CONFIGURATION
   ========================================== */
const char ssid[] = "Bayad50";
const char pass[] = "PahingeFive";

/* ==========================================
   2. FIREBASE CONFIGURATION
   ========================================== */
char serverAddress[] = "sensordb-450ca-default-rtdb.firebaseio.com";

/* ==========================================
   3. HARDWARE PINS
   ========================================== */
// --- DHT11 ---
#define DHTPIN 7
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

// --- Ultrasonic ---
const int trigPin = 9;
const int echoPin = 10;

// --- LEDs & Buzzer ---
const int led3 = 3;
const int led4 = 4;
const int led5 = 5;
const int buzzerpin = 2;

// --- Vibration (Seismometer) ---
const int vibrationPin = 6;

// --- SMOKE SENSOR (NEW) ---
const int smokePin = A0; 

/* ==========================================
   GLOBALS & TIMERS
   ========================================== */
long duration;
int distance;
unsigned long vibrationCount = 0;

// Smoke Variables
int smokeValue = 0;
int smokeThreshold = 600; // Adjust this number if needed

// WiFi & Web
int status = WL_IDLE_STATUS;
WiFiSSLClient wifi;
HttpClient client = HttpClient(wifi, serverAddress, 443);

// Timing Variables
unsigned long previousMillis = 0;
const long interval = 2000; // Send to Firebase every 2 seconds

void setup() {
  Serial.begin(9600);

  // Pin Modes
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
  pinMode(buzzerpin, OUTPUT);
  pinMode(led3, OUTPUT);
  pinMode(led4, OUTPUT);
  pinMode(led5, OUTPUT);
  pinMode(vibrationPin, INPUT);
  pinMode(smokePin, INPUT); // Added Smoke Pin

  dht.begin();

  // --- WiFi Connection ---
  if (WiFi.status() == WL_NO_MODULE) {
    Serial.println("WiFi Module Failed!");
    while (true);
  }

  while (status != WL_CONNECTED) {
    Serial.print("Connecting to: "); Serial.println(ssid);
    status = WiFi.begin(ssid, pass);
    delay(5000);
  }

  Serial.println("\n----------------------------------------");
  Serial.println("SYSTEM ONLINE: All Sensors Active");
  Serial.println("----------------------------------------");
}

void loop() {
  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    status = WiFi.begin(ssid, pass);
    return;
  }

  /* ==================================================
     TASK 1: FAST MONITORING (Vibration)
     ================================================== */
  if (digitalRead(vibrationPin) == HIGH) {
    vibrationCount++;
    delay(2); 
  }

  /* ==================================================
     TASK 2: SLOW REPORTING (Every 2 Seconds)
     ================================================== */
  unsigned long currentMillis = millis();

  if (currentMillis - previousMillis >= interval) {
    // Save the last time we updated
    previousMillis = currentMillis;

    // --- A. Read Ultrasonic ---
    readUltrasonic();

    // --- B. Read DHT ---
    float humidity = dht.readHumidity();
    float temperature = dht.readTemperature();

    // --- C. Read Smoke Sensor (YOUR NEW CODE) ---
    smokeValue = analogRead(smokePin);
    String airStatus = "Clean";
    if (smokeValue > smokeThreshold) {
      airStatus = "SMOKE DETECTED";
    }

    // --- D. Calculate Magnitude ---
    float magnitude = (float)vibrationCount * 1.7;
    if (magnitude > 10.0) magnitude = 10.0; 

    String quakeStatus = "Normal";
    if (magnitude > 0.1 && magnitude < 3.0) quakeStatus = "Micro Tremor";
    else if (magnitude >= 3.0 && magnitude < 5.0) quakeStatus = "Minor Quake";
    else if (magnitude >= 5.0 && magnitude < 7.0) quakeStatus = "Strong Quake";
    else if (magnitude >= 7.0) quakeStatus = "MAJOR WARNING";

    // --- E. Debug to Serial ---
    if (!isnan(temperature)) {
      Serial.print("Dist: "); Serial.print(distance);
      Serial.print("cm | Smoke: "); Serial.print(smokeValue);
      Serial.print(" | Mag: "); Serial.print(magnitude);
      Serial.println();
    }

    // --- F. Update LEDs ---
    updateLEDs(distance);

    // --- G. Send to Firebase (Updated with Smoke Data) ---
    if (!isnan(temperature)) {
      sendToFirebase(temperature, humidity, distance, magnitude, quakeStatus, smokeValue, airStatus);
    }

    // --- H. Reset Vibration Counter ---
    vibrationCount = 0;
  }
}

// --- Helper: Read Distance ---
void readUltrasonic() {
  digitalWrite(trigPin, LOW); delayMicroseconds(2);
  digitalWrite(trigPin, HIGH); delayMicroseconds(10);
  digitalWrite(trigPin, LOW);
  duration = pulseIn(echoPin, HIGH, 30000);
  distance = duration * 0.034 / 2;
}

// --- Helper: LED Logic ---
void updateLEDs(int dist) {
  if (dist <= 2) {
    digitalWrite(led3, HIGH); digitalWrite(led4, HIGH); digitalWrite(led5, HIGH); digitalWrite(buzzerpin, HIGH);
  } else if (dist <= 4) {
    digitalWrite(led3, HIGH); digitalWrite(led4, HIGH); digitalWrite(led5, LOW); digitalWrite(buzzerpin, LOW);
  } else if (dist <= 7) {
    digitalWrite(led3, HIGH); digitalWrite(led4, LOW); digitalWrite(led5, LOW); digitalWrite(buzzerpin, LOW);
  } else {
    digitalWrite(led3, LOW); digitalWrite(led4, LOW); digitalWrite(led5, LOW); digitalWrite(buzzerpin, LOW);
  }
}

// --- Helper: Send Data to Firebase ---
void sendToFirebase(float temp, float hum, int dist, float mag, String qStatus, int smoke, String aStatus) {
  
  // JSON Payload
  String jsonPayload = "{";
  jsonPayload += "\"temperature\":" + String(temp) + ",";
  jsonPayload += "\"humidity\":" + String(hum) + ",";
  jsonPayload += "\"distance\":" + String(dist) + ",";
  jsonPayload += "\"magnitude\":" + String(mag) + ",";
  jsonPayload += "\"status\":\"" + qStatus + "\",";
  // Added Smoke Data:
  jsonPayload += "\"smokeValue\":" + String(smoke) + ",";
  jsonPayload += "\"airStatus\":\"" + aStatus + "\"";
  jsonPayload += "}";

  client.beginRequest();
  client.put("/sensor_data.json");
  client.sendHeader("Content-Type", "application/json");
  client.sendHeader("Content-Length", jsonPayload.length());
  client.beginBody();
  client.print(jsonPayload);
  client.endRequest();

  // Flush response
  client.responseStatusCode();
  client.responseBody();
}