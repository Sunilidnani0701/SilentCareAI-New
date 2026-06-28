#include <Wire.h>
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <ArduinoJson.h>
#include "config.h"

// NodeMCU Analog Pin for Battery Voltage Divider

const int BATTERY_PIN = A0;

// --- MPU6050 Raw Configuration ---
#define MPU_ADDR 0x68
int16_t AcX, AcY, AcZ;
int16_t GyX, GyY, GyZ;

// Variables for simple fall detection
float previous_accel_mag = 1.0;
unsigned long last_post_time = 0;
const int POST_INTERVAL = 2000; // Post every 2 seconds

// Fall detection thresholds
const float FALL_THRESHOLD_UPPER = 2.5; // g (sudden impact)
const float FALL_THRESHOLD_LOWER = 0.5; // g (free fall)
bool fall_detected = false;
unsigned long fall_time = 0;

void setupMPU() {
  Wire.begin();
  Wire.setClock(400000); 

  // Add delay before talking to sensor. MPU need time wake up.
  delay(1000); 

  // Wake up MPU6050
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x6B);  // PWR_MGMT_1 register
  Wire.write(0);     // set to zero (wakes up the MPU-6050)
  byte status = Wire.endTransmission(true);

  if (status != 0) {
    Serial.println("Failed to communicate with MPU6050. Check wiring or I2C address.");
  } else {
    Serial.println("MPU6050 Initialized Successfully!");
  }
}

void readMPU() {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x3B);  // starting with register 0x3B (ACCEL_XOUT_H)
  Wire.endTransmission(false);
  
  // Request 14 bytes (AcX, AcY, AcZ, Tmp, GyX, GyY, GyZ)
  Wire.requestFrom((uint8_t)MPU_ADDR, (uint8_t)14);

  // Read high byte first, then low byte
  AcX = (int16_t)(Wire.read() << 8 | Wire.read());
  AcY = (int16_t)(Wire.read() << 8 | Wire.read());
  AcZ = (int16_t)(Wire.read() << 8 | Wire.read());
  
  // Skip Temperature
  Wire.read(); Wire.read();
  
  GyX = (int16_t)(Wire.read() << 8 | Wire.read());
  GyY = (int16_t)(Wire.read() << 8 | Wire.read());
  GyZ = (int16_t)(Wire.read() << 8 | Wire.read());
}

void setup() {
  Serial.begin(115200);
  while (!Serial) delay(1000);

  // Initialize Wi-Fi
  WiFi.begin(ssid, password);
  Serial.print("\nConnecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected to WiFi");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());

  setupMPU();
}

// Function to simulate battery percentage from analog pin
int readBatteryPercentage() {
  int rawValue = analogRead(BATTERY_PIN);
  int battery_pct = map(rawValue, 500, 1023, 0, 100); 
  if (battery_pct > 100) battery_pct = 100;
  if (battery_pct < 0) battery_pct = 0;
  return battery_pct;
}

void loop() {
  readMPU();

  // Convert raw acceleration to g-force
  // For default +/- 2g range, the scale factor is 16384.0
  float acc_x = AcX / 16384.0;
  float acc_y = AcY / 16384.0;
  float acc_z = AcZ / 16384.0;
  
  // Convert raw gyro to degrees/sec
  // For default +/- 250 deg/s range, the scale factor is 131.0
  float gyro_x = GyX / 131.0;
  float gyro_y = GyY / 131.0;
  float gyro_z = GyZ / 131.0;

  // Simple Fall Detection Logic (Magnitude of Acceleration)
  float acc_mag = sqrt(acc_x * acc_x + acc_y * acc_y + acc_z * acc_z);
  
  // Debug print to see what's happening
  Serial.print("Mag: ");
  Serial.print(acc_mag);
  Serial.print(" g | Raw: ");
  Serial.print(AcX);
  Serial.print(", ");
  Serial.print(AcY);
  Serial.print(", ");
  Serial.println(AcZ);

  // Free fall followed by hard impact
  if (acc_mag < FALL_THRESHOLD_LOWER || acc_mag > FALL_THRESHOLD_UPPER) {
    if (!fall_detected) {
      fall_detected = true;
      fall_time = millis();
      Serial.println(">>> POTENTIAL FALL DETECTED! <<<");
    }
  }

  // Reset fall detected flag after 10 seconds
  if (fall_detected && (millis() - fall_time > 10000)) {
    fall_detected = false;
  }

  // Post Data Every 2 Seconds
  if (millis() - last_post_time > POST_INTERVAL) {
    last_post_time = millis();

    if (WiFi.status() == WL_CONNECTED) {
      WiFiClientSecure client;
      client.setInsecure(); // Need this for HTTPS on ESP8266
      HTTPClient http;
      
      http.begin(client, api_url);
      http.addHeader("Content-Type", "application/json");

      // Construct JSON Payload
      StaticJsonDocument<300> doc;
      doc["patient_id"] = patient_id;
      doc["timestamp"] = millis() / 1000; 
      
      JsonObject accel = doc.createNestedObject("acceleration");
      accel["x"] = acc_x;
      accel["y"] = acc_y;
      accel["z"] = acc_z;

      JsonObject gyro = doc.createNestedObject("gyroscope");
      gyro["x"] = gyro_x;
      gyro["y"] = gyro_y;
      gyro["z"] = gyro_z;

      doc["battery"] = readBatteryPercentage();
      doc["fall_detected"] = fall_detected;

      String requestBody;
      serializeJson(doc, requestBody);

      // Send HTTP POST
      int httpResponseCode = http.POST(requestBody);
      
      if (httpResponseCode > 0) {
        Serial.print("HTTP Response code: ");
        Serial.println(httpResponseCode);
      } else {
        Serial.print("Error code: ");
        Serial.println(httpResponseCode);
      }
      
      http.end();
      
      // Clear the fall_detected flag immediately after a successful dispatch
      if (fall_detected && httpResponseCode == 200) {
        fall_detected = false;
      }
    } else {
      Serial.println("WiFi Disconnected");
    }
  }

  // Small delay so we not spam sensor too fast
  delay(1000);
}