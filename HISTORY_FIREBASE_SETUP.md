# Firebase Realtime History Setup Guide

## Overview
Your monitoring system now automatically saves sensor history to Firebase Realtime Database and loads it when the page opens.

## How It Works

### 1. **Firebase Database Structure**
```
sensordb-450ca-default-rtdb (Your Firebase Database)
├── sensor_data (Current live readings)
│   ├── temperature: 25.5
│   ├── humidity: 60
│   ├── distance: 10.2
│   ├── vibration: 0.5
│   ├── smoke: 120
│   └── timestamp: 1234567890
│
└── sensor_history (Historical records - Auto-saved)
    ├── -N1abc123xyz
    │   ├── timestamp: 1234567890
    │   ├── temperature: 25.5
    │   ├── humidity: 60
    │   ├── distance: 10.2
    │   ├── vibration: 0.5
    │   ├── smoke: 120
    │   ├── airStatus: "Normal"
    │   └── status: "Normal"
    ├── -N1abc124xyz
    └── ...
```

### 2. **What Happens Automatically**

#### On Page Load (telemetry.html):
- Loads last 500 history records from Firebase
- Displays them in the history table

#### When Sensor Data Changes:
- Detects new sensor readings
- Saves to local memory (for fast display)
- Automatically pushes to Firebase `sensor_history`
- Updates the history table

### 3. **Firebase Rules Setup**

Go to Firebase Console > Realtime Database > Rules and use:

```json
{
  "rules": {
    "sensor_data": {
      ".read": true,
      ".write": true
    },
    "sensor_history": {
      ".read": true,
      ".write": true,
      ".indexOn": ["timestamp"]
    }
  }
}
```

### 4. **Benefits**

✅ **Persistent Storage**: History survives page refreshes  
✅ **Automatic Sync**: All changes saved to cloud  
✅ **Cross-Device**: View same history on any device  
✅ **Limited Storage**: Keeps only last 500 records in memory  
✅ **Firebase Backup**: Full history stored in Firebase  

### 5. **Configuration**

In `telemetry.js`, line 48:
```javascript
const MAX_SENSOR_HISTORY = 500; // Adjust this number
```

Change this number to control how many records to keep in memory.

### 6. **How Data is Saved**

Every time sensor readings change, the system:

1. Creates a history entry with all sensor values
2. Adds it to local `sensorHistory` array
3. Pushes it to Firebase using:
   ```javascript
   historyRef.push(historyEntry)
   ```
4. Firebase auto-generates a unique ID for each record

### 7. **Arduino/ESP Integration**

Your Arduino should send data to Firebase like this:

```cpp
// Send current sensor data
Firebase.setFloat(firebaseData, "/sensor_data/temperature", temp);
Firebase.setFloat(firebaseData, "/sensor_data/humidity", hum);
Firebase.setFloat(firebaseData, "/sensor_data/distance", dist);
Firebase.setFloat(firebaseData, "/sensor_data/vibration", vib);
Firebase.setInt(firebaseData, "/sensor_data/smoke", smoke);
Firebase.setInt(firebaseData, "/sensor_data/timestamp", millis());

// You DON'T need to write to sensor_history from Arduino
// The web app handles history automatically!
```

### 8. **Viewing History**

- Open **telemetry.html** in browser
- History loads automatically
- New records appear as sensors update
- Clear button removes local history (Firebase keeps backup)

### 9. **Troubleshooting**

**History not saving?**
- Check browser console for errors
- Verify Firebase config in `telemetry.js`
- Check Firebase Rules allow write access

**History not loading?**
- Check internet connection
- Verify Firebase database URL
- Check browser console for errors

**Too much data?**
- Reduce `MAX_SENSOR_HISTORY` value
- Set up Firebase data cleanup rules
- Consider archiving old data

### 10. **Advanced: Clean Old Data**

To automatically delete history older than 30 days, add to Firebase Rules:

```json
"sensor_history": {
  ".read": true,
  ".write": true,
  ".indexOn": ["timestamp"],
  "$record": {
    ".validate": "newData.hasChildren(['timestamp'])",
    ".write": "newData.child('timestamp').val() > (now - 2592000000)"
  }
}
```

## Summary

Your history system is now **fully connected to Firebase**! Every sensor change is automatically saved to the cloud and loaded when you open the page. No manual intervention needed! 🎉
