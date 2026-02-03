# Disaster Monitoring System Dashboard

A real-time monitoring dashboard for fire detection, water level, and seismic activity using HTML, Tailwind CSS, and JavaScript with Firebase integration.

## Features

- 🔥 **Fire Detection Monitoring**: Real-time temperature and smoke level tracking
- 💧 **Water Level Monitoring**: Water level and flow rate monitoring
- 🌍 **Seismic Activity Monitoring**: Earthquake magnitude and depth detection
- 📊 **Real-time Updates**: Live data from Arduino sensors via Firebase
- 🚨 **Alert System**: Automatic alerts for critical conditions
- 📈 **System Statistics**: Overview of average readings and system uptime
- 🎨 **Modern UI**: Beautiful dark-themed interface with Tailwind CSS

## Quick Start

### 1. Open the Dashboard

Simply open `index.html` in your web browser. The dashboard will work with mock data by default.

### 2. Connect to Firebase

1. Follow the [Firebase Setup Guide](FIREBASE_GUIDE.md) to set up your Firebase project
2. Update `app.js` with your Firebase configuration
3. Uncomment the Firebase code sections in `app.js`
4. Set `useMockData = false` to use real sensor data

### 3. Connect Arduino Sensors

1. Follow the Arduino setup instructions in [FIREBASE_GUIDE.md](FIREBASE_GUIDE.md)
2. Upload the provided Arduino code to your ESP32 or compatible board
3. Connect your sensors:
   - Temperature sensor (e.g., LM35) for fire detection
   - Smoke sensor (MQ-2) for smoke detection
   - Water level sensor for water monitoring
   - Accelerometer/seismic sensor for earthquake detection

## File Structure

```
Monitoring/
├── index.html          # Main dashboard HTML file
├── app.js             # JavaScript for Firebase and data handling
├── FIREBASE_GUIDE.md  # Complete Firebase and Arduino setup guide
└── README.md          # This file
```

## Technologies Used

- **HTML5**: Structure and layout
- **Tailwind CSS**: Modern, responsive styling
- **JavaScript**: Real-time data handling and Firebase integration
- **Firebase Realtime Database**: Cloud database for sensor data
- **Font Awesome**: Icons

## Dashboard Sections

### Main Sensor Cards
- **Fire Detection**: Shows current temperature and status
- **Water Level**: Displays water level percentage
- **Seismic Activity**: Shows earthquake magnitude

### Detailed Sensor Views
- Individual sensor readings with progress bars
- Additional metrics (smoke level, flow rate, depth)

### Alert System
- Real-time alerts for warnings and critical conditions
- Alert history with timestamps

### System Statistics
- Average temperature
- Average water level
- Average seismic activity
- System uptime percentage

## Alert Thresholds

### Fire Detection
- **Normal**: Temperature < 60°C, Smoke < 50ppm
- **Warning**: Temperature 60-80°C or Smoke 50-80ppm
- **Critical**: Temperature > 80°C or Smoke > 80ppm

### Water Level
- **Normal**: 20% - 90%
- **Warning**: < 20% (Low) or > 90% (High)

### Seismic Activity
- **Normal**: Magnitude < 4.0 Mw
- **Warning**: Magnitude 4.0 - 6.0 Mw
- **Critical**: Magnitude > 6.0 Mw

## Browser Compatibility

- Chrome (recommended)
- Firefox
- Edge
- Safari

## Development

### Running Locally

1. Clone or download this repository
2. Open `index.html` in a web browser
3. For Firebase integration, set up Firebase as described in `FIREBASE_GUIDE.md`

### Testing Without Arduino

The dashboard includes mock data generation for testing. Simply open `index.html` and the dashboard will display simulated sensor readings that update every 3 seconds.

## Troubleshooting

### Dashboard shows "--" values
- Check if Firebase is properly configured
- Verify `useMockData` is set to `true` for testing
- Check browser console for errors

### Data not updating
- Verify Firebase connection in browser console
- Check Firebase database rules allow read access
- Ensure Arduino is sending data to Firebase

### Alerts not showing
- Check sensor values exceed threshold values
- Verify alert functions are being called
- Check browser console for JavaScript errors

## Next Steps

1. **Set up Firebase**: Follow [FIREBASE_GUIDE.md](FIREBASE_GUIDE.md)
2. **Connect Arduino**: Upload sensor code to your board
3. **Customize Thresholds**: Adjust alert thresholds in `app.js`
4. **Add Authentication**: Implement Firebase Auth for production
5. **Deploy**: Host your dashboard on Firebase Hosting or any web server

## License

This project is open source and available for personal and educational use.

## Support

For detailed setup instructions, see [FIREBASE_GUIDE.md](FIREBASE_GUIDE.md)

---

**Note**: This dashboard is designed for monitoring purposes. For critical applications, implement proper authentication, security rules, and backup systems.







