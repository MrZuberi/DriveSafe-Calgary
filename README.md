# DriveSafe Calgary
*Real-time traffic incident monitoring and visualization for Calgary*

A full-stack web application providing live traffic incident data, interactive mapping, and nearby traffic camera feeds for Calgary. Built with React frontend and Python Flask backend consuming Calgary Open Data APIs. Currently serving 1200+ active users.


## Live Demo
**🌐 [View Live Application](www.drivesafecalgary.ca)**

A full-stack web application providing live traffic incident data, interactive mapping, and nearby traffic camera feeds for Calgary. Built with React frontend and Python Flask backend consuming Calgary Open Data APIs.

## Features
* **Live Traffic Map** - Interactive map showing real-time incident locations with clickable markers
* **Incident Details** - Comprehensive information including timestamps, descriptions, and quadrant data
* **Nearby Traffic Cameras** - Automatically displays closest traffic cameras to selected incidents
* **Real-Time Updates** - Data refreshes every 30 seconds for incidents, 60 seconds for cameras
* **Advanced Search** - Filter incidents by description, location, or quadrant
* **Responsive Design** - Optimized layouts for both desktop and mobile devices
* **Image Expansion** - Click camera images to view full-size versions

## Technologies
### Frontend
* **React** - Component-based UI framework
* **Leaflet** - Interactive mapping library
* **Axios** - HTTP client for API communication
* **CSS3** - Responsive styling and animations

### Backend
* **Python Flask** - Lightweight web framework
* **Flask-CORS** - Cross-origin resource sharing
* **Requests** - HTTP library for API calls
* **Gunicorn** - WSGI HTTP server


Access real-time Calgary traffic data, explore incident locations on an interactive map, and view nearby traffic camera feeds.

## API Endpoints
```
GET    /api/health                        # Server health check
GET    /api/incidents?limit=100           # Get traffic incidents
GET    /api/incidents/all                 # Get all incidents
GET    /api/cameras                       # Get traffic cameras
GET    /api/nearest-cameras?lat=&lon=     # Find nearest cameras
GET    /api/incident-with-cameras?id=     # Get incident + cameras
```

## Data Sources
* **Calgary Open Data** - Live traffic incidents and camera feeds
* **Incident Data**: `https://data.calgary.ca/resource/35ra-9556.json`
* **Camera Data**: `https://data.calgary.ca/resource/k7p9-kppz.json`

## Project Structure
```
├── Backend/
│   ├── app.py                    # Flask server and API endpoints
│   ├── config.js/.json          # API configuration
│   └── requirements.txt          # Python dependencies
├── Frontend/
│   ├── src/
│   │   ├── App.js               # Device detection and routing
│   │   ├── DesktopApp.js        # Main desktop application
│   │   ├── App.css              # Desktop styling
│   │   └── mobile/
│   │       ├── App.js           # Mobile-optimized version
│   │       └── App.css          # Mobile-specific styling
│   ├── public/
│   │   ├── index.html           # HTML template
│   │   └── manifest.json        # PWA configuration
```

## Key Features
**Intelligent Caching**: Backend caches API responses to reduce load on Calgary's servers
**Distance Calculation**: Haversine formula for accurate camera-to-incident distances  
**Error Handling**: Graceful fallbacks for broken camera feeds and API timeouts
**Mobile Responsive**: Adaptive interface that detects device type and screen size
**Auto-Refresh**: Live data updates without manual page refresh

## Deployment
Backend deployed on Heroku with environment variable configuration. Frontend deployed on vercel and then a domain.

## How to Run the Application

### Backend (Python Flask)
1. **Navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Set environment variables**
   ```bash
   export CAMERAS_URL="https://data.calgary.ca/resource/k7p9-kppz.json"
   export INCIDENTS_URL="https://data.calgary.ca/resource/35ra-9556.json"
   export PORT=5000
   ```

4. **Run the Flask server**
   ```bash
   python app.py
   ```
   Backend will start on `http://localhost:5000`

### Frontend (React)
1. **Navigate to frontend directory**
   ```bash
   cd frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set backend URL (optional)**
   ```bash
   export REACT_APP_BACKEND_URL=http://localhost:5000
   ```

4. **Start the development server**
   ```bash
   npm start
   ```
   Frontend will start on `http://localhost:3000`


## License
This project is licensed under the GNU General Public License v3.0 (GPLv3) — see the [LICENSE](LICENSE) file for details.

