# Monitoring System

## Purpose
This project provides a simple monitoring system that collects telemetry data (for example, from an Arduino) and displays it in a web dashboard. It is intended for basic sensor monitoring, live status viewing, and lightweight logging/visualization in a browser.

## How It Works
1. An Arduino (or compatible device) reads sensor data and sends it to the host.
2. The Node.js server (`app.js`) receives the data and makes it available to the web pages.
3. The web UI pages (`dashboard.html`, `telemetry.html`) render the data using their matching scripts (`dashboard.js`, `telemetry.js`).

## Project Files
- `app.js` - Node.js server that connects to the data source and serves the web UI.
- `arduino_example.ino` - Example Arduino sketch for sending telemetry data.
- `dashboard.html` / `dashboard.js` - Dashboard UI and logic.
- `telemetry.html` / `telemetry.js` - Telemetry view and logic.
- `index.html` - Entry page for the UI.
- `assest/` - Static assets (images, styles, etc.).
- `WebsiteCapture/` - Optional captures or exports of the UI.

## How To Run
1. Install Node.js.
2. From the project folder, run:
   `node app.js`
3. Open the UI in your browser (the server output should show the local URL).

## Notes
- Update the Arduino sketch to match your sensors and serial settings.
- If your data format changes, update the parsing logic in `app.js` and the UI scripts.
