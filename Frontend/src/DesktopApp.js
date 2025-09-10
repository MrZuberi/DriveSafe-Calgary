import { useEffect, useState } from "react";
import axios from "axios";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import './App.css';
import './mobiles.css'; 
import bgImage from "./image1.jpg";
import driveGif from "./drive.gif";

// fixes broken marker icons in leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// backend server url - uses env variable or fallback
const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || "https://drivesafecalgary-13a17c07f5d1.herokuapp.com";

// keeps map within calgary limits so users can't scroll too far
const CALGARY_BOUNDS = [
  [50.842, -114.316],
  [51.215, -113.859],
];

// calculates distance between two points on earth using math
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // earth radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // returns distance in km
}

function App() {
  // ===== STATE VARIABLES =====
  // stores all the app data in memory
  const [incidents, setIncidents] = useState([]); // list of traffic accidents
  const [cameras, setCameras] = useState([]); // list of traffic cameras
  const [selectedIncident, setSelectedIncident] = useState(null); // which accident user clicked
  const [nearestCameras, setNearestCameras] = useState([]); // cameras near selected accident
  const [searchText, setSearchText] = useState(""); // what user typed in search box
  const [showModal, setShowModal] = useState(null); // popup window data
  const [showImageModal, setShowImageModal] = useState(null); // big image popup
  const [isLoading, setIsLoading] = useState(true); // shows loading screen

  // ===== API FUNCTIONS =====
  
  // gets traffic incidents from backend API
  function loadIncidents() {
    axios.get(`${API_BASE_URL}/api/incidents?limit=500`)
      .then(function(response) {
        const data = response.data;
        
        // only keep incidents that have proper coordinates
        if (data && data.items) {
          const cleanIncidents = data.items.filter(incident => 
            incident.coordinates && incident.coordinates.lat && incident.coordinates.lon
          );
          
          // sorts incidents by newest first (backend should handle this, but added just incase)
          cleanIncidents.sort(function(a, b) {
            const dateA = new Date(a.start_dt || 0);
            const dateB = new Date(b.start_dt || 0);
            return dateB - dateA;
          });
          
          setIncidents(cleanIncidents); // save to state
        }
        setIsLoading(false); // hide loading screen
      })
      .catch(function(error) {
        console.error("Error loading incidents:", error);
        setIsLoading(false); // hide loading even if error
      });
  }

  // gets traffic cameras from api
  function loadCameras() {
    axios.get(`${API_BASE_URL}/api/cameras`)
      .then(function(response) {
        const data = response.data;
        
        // only keep cameras that have coordinates and working image urls
        if (data && data.items) {
          const cleanCameras = data.items.filter(camera => 
            camera.coordinates && camera.coordinates.lat && camera.coordinates.lon && camera.url
          );
          
          setCameras(cleanCameras); // save to state
        }
      })
      .catch(function(error) {
        console.error("Error loading cameras:", error);
      });
  }

  // ===== SETUP AND LIFECYCLE =====
  
  // runs when app first loads
  useEffect(function() {
    loadIncidents(); // get initial data
    loadCameras(); 
    
    // refreshes incident data every 30 seconds to keep it current
    const timer = setInterval(loadIncidents, 30000);
    
    // stops the timer when component closes to prevent memory leaks
    return function() {
      clearInterval(timer);
    };
  }, []);

  // ===== EVENT HANDLERS =====
  
  // runs when user clicks on map marker
  function handleSelectIncident(incident) {
    setSelectedIncident(incident); // remember which one they picked
    
    // find nearest cameras to this accident
    if (incident && incident.coordinates && incident.coordinates.lat && incident.coordinates.lon) {
      axios.get(`${API_BASE_URL}/api/nearest-cameras`, {
        params: {
          lat: incident.coordinates.lat,
          lon: incident.coordinates.lon,
          limit: 4 // only get 4 closest cameras
        }
      })
      .then(function(response) {
        const data = response.data;
        if (data && data.items) {
          setNearestCameras(data.items); // save camera list
        }
      })
      .catch(function(error) {
        console.error("Error loading nearest cameras:", error);
        setNearestCameras([]); // clear cameras if error
      });
    } else {
      setNearestCameras([]); // no cameras if no coordinates
    }
  }

  // runs when user clicks incident in the list (not map)
  function handlePickFromList(incident) {
    // get incident details plus nearby cameras in one api call
    if (incident && incident.id) {
      axios.get(`${API_BASE_URL}/api/incident-with-cameras`, {
        params: {
          id: incident.id,
          limit: 4
        }
      })
      .then(function(response) {
        const data = response.data;
        if (data && data.incident && data.nearest_cameras) {
          const modalData = {
            incident: data.incident,
            cameras: data.nearest_cameras.items || []
          };
          setShowModal(modalData); // show popup with all info
        }
      })
      .catch(function(error) {
        console.error("Error loading incident with cameras:", error);
        // fallback to basic incident info if api fails
        setShowModal({
          incident: incident,
          cameras: []
        });
      });
    }
  }

  // ===== FILTERING AND SEARCH =====
  
  // filters incidents based on what user typed in search box
  const filteredIncidents = [];
  const searchLower = searchText.toLowerCase().trim(); // make search case insensitive
  
  for (let i = 0; i < incidents.length; i++) {
    const incident = incidents[i];
    
    if (searchLower === "") {
      // no search text means show all incidents
      filteredIncidents.push(incident);
    } else {
      let shouldInclude = false;
      
      // checks if search text matches incident info
      if (incident.incident_info && incident.incident_info.toLowerCase().includes(searchLower)) {
        shouldInclude = true;
      }
      // checks if search text matches description
      if (incident.description && incident.description.toLowerCase().includes(searchLower)) {
        shouldInclude = true;
      }
      // checks if search text matches quadrant (like NE, SW, etc)
      if (incident.quadrant && incident.quadrant.toLowerCase().includes(searchLower)) {
        shouldInclude = true;
      }
      
      if (shouldInclude) {
        filteredIncidents.push(incident);
      }
    }
  }

  // ===== LOADING STATE =====
  
  // shows loading screen while data loads from api
  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '18px'
      }}>
        Loading traffic data....
      </div>
    );
  }

  // ===== MAIN APP RENDER =====
  
  return (
    <div 
      style={{ 
        backgroundImage: `url(${bgImage})`,
        backgroundSize: "cover", 
        backgroundAttachment: "fixed",
        minHeight: "100vh",
        backgroundPosition: "center center",
        display: "flex"
      }}
    >
      {/* ===== HEADER SECTION ===== */}
      <div className="header-left">
        <img src={driveGif} alt="Drive Animation" className="header-gif" />
        <h1 style={{ fontSize: '32px' }}>DriveSafe Calgary
        <h2 style={{ fontSize: '16px' }}>Calgary Live Traffic Incidents</h2>
        <p style={{ fontSize: '14px' }}>Map | Details | Nearest Traffic Cameras | Updates</p></h1>
      </div>

      <div className="main-content">
        <div className="container" style={{ paddingBottom: "6rem" }}>
          <div className="grid-2">
            
            {/* ===== MAP SECTION ===== */}
            <div className="card" style={{ padding: 0, minHeight: "520px" }}>
                <div style={{ padding: '0.8rem', background: '#f5f6f7', borderBottom: '1px solid #dee2e6'}}>
                  <div style={{ fontWeight: 600, color: '#004c8c', fontSize: '1rem' }}>
                    🗺️ Calgary Traffic Map
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#6c757d', marginTop: '0.3rem' }}>
                    Zoom into map and tap any red marker to view incident details
                  </div>
                   <div style={{ fontSize: '0.8rem', color: '#6c757d', marginTop: '0.3rem' }}>
                  </div>
                </div>
              
              {/* interactive map component */}
              <MapContainer
                center={[51.0447, -114.0719]} // calgary coordinates
                zoom={10}
                style={{ height: "100%", minHeight: "520px", borderRadius: "12px", zIndex: 0 }}
                maxBounds={CALGARY_BOUNDS} // keeps map focused on calgary
                maxBoundsViscosity={1.0}
              >
                <TileLayer
                  attribution='&copy; OpenStreetMap contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                
                {/* shows first 25 incidents as clickable red markers */}
                {incidents.slice(0, 25).map(function(incident) {
                  const coords = incident.coordinates;
                  if (!coords) return null; // skip if no coordinates
                  
                  return (
                    <Marker 
                      key={incident.id} 
                      position={[coords.lat, coords.lon]} 
                      eventHandlers={{ 
                        click: function() { 
                          handleSelectIncident(incident); // when user clicks marker
                        } 
                      }}
                    >
                      {/* popup that appears when marker is clicked */}
                      <Popup>
                        <b>{incident.incident_info}</b><br />
                        {incident.description}<br />
                        {incident.start_dt ? new Date(incident.start_dt).toLocaleString() : ""}
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
            </div>

            {/* ===== DETAILS PANEL ===== */}
            <div className="card" style={{ height: "auto", padding: "0.5rem" }}>
              {!selectedIncident ? (
                // shows this when no incident is selected
                <div className="right-panel-empty" style={{ fontSize: "0.9rem", lineHeight: "0.75rem" }}>
                  <div>Click any map icon to see accidents</div>
                  <div className="badge" style={{ marginTop: "0.25rem" }}>Live feed. Updates automatically.</div>
                </div>
              ) : (
                // shows incident details when one is selected
                <div className="details" style={{ overflow: "visible", lineHeight: "1.2rem" }}>
                  <h2 style={{ fontSize: "1.3rem", fontWeight: "700", marginBottom: "0.3rem" }}>
                    {selectedIncident.incident_info}
                  </h2>
                  <p style={{ fontSize: "0.95rem", margin: "0 0 0.3rem 0" }}>{selectedIncident.description}</p>
                  <p style={{ margin: "0 0 0.3rem 0" }}>
                    <b>When:</b> {selectedIncident.start_dt ? new Date(selectedIncident.start_dt).toLocaleString() : "—"}
                  </p>
                  <p style={{ margin: "0 0 0.3rem 0" }}>
                    <b>Quadrant:</b> {selectedIncident.quadrant || "—"}
                  </p>
                  <p style={{ margin: "0 0 0.3rem 0" }}>
                    <b>Last updated:</b> {selectedIncident.modified_dt ? new Date(selectedIncident.modified_dt).toLocaleString() : "—"}
                  </p>

                  <div className="section-title" style={{ marginBottom: "0.25rem" }}>Closest traffic cameras:</div>
                  <p style={{ textAlign: "center", fontSize: "0.75rem", color: "gray", margin: "0.1rem 0 0.25rem 0" }}>
                    Click on images to enlarge!
                  </p>

                  {/* shows camera images near selected incident */}
                  <div className="cam-grid" style={{ gap: "0.25rem" }}>
                    {nearestCameras.map(function(camera, index) {
                      return (
                        <div key={index}>
                          <img
                            src={camera.url}
                            alt={camera.description}
                            onClick={function() { 
                              setShowImageModal(camera.url); // enlarge image when clicked
                            }}
                            style={{ height: "150px", width: "310px", objectFit: "cover" }}
                            onError={function(e) {
                              e.target.style.display = 'none'; // hide broken images
                            }}
                          />
                          <div className="cam-distance" style={{ fontSize: "0.75rem", marginTop: "0.1rem" }}>
                            ~{camera.distance_km ? camera.distance_km.toFixed(2) : 0} km
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ===== SEARCH AND LIST SECTION ===== */}
          <div className="search-list">
            {/* search input box */}
            <div className="search-bar">
              <input 
                placeholder="Search any recent incidents..." 
                value={searchText} 
                onChange={function(e) { 
                  setSearchText(e.target.value); // update search as user types
                }} 
              />
              <div className="badge">{filteredIncidents.length} matches</div>
            </div>

            {/* scrollable list of all incidents */}
            <div className="item-list">
              {filteredIncidents.map(function(incident) {
                return (
                  <div 
                    key={incident.id} 
                    className="item" 
                    onClick={function() { 
                      handlePickFromList(incident); // open popup when clicked
                    }}
                  >
                    <div className="item-header">
                      <div className="item-title">{incident.incident_info}</div>
                      <div className="badge" style={{ background: "red", color: "white" }}>
                        {incident.start_dt ? new Date(incident.start_dt).toLocaleTimeString() : ""}
                      </div>
                    </div>
                    <div className="item-description">{incident.description}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ===== MODAL POPUPS ===== */}
      
      {/* popup window showing incident details and cameras */}
      {showModal && (
        <div className="modal" onClick={function() { setShowModal(null); }}>
          <div className="modal-card" onClick={function(e) { e.stopPropagation(); }}>
            <div className="modal-header">
              <div className="modal-title">{showModal.incident.incident_info}</div>
              <button className="close-btn" onClick={function() { setShowModal(null); }}>Close</button>
            </div>
            <div className="inline-modal-content">
              <p><b>Description:</b> {showModal.incident.description}</p>
              <p><b>When:</b> {showModal.incident.start_dt ? new Date(showModal.incident.start_dt).toLocaleString() : "—"}</p>
              <p><b>Quadrant:</b> {showModal.incident.quadrant || "—"}</p>
              <p><b>Last updated:</b> {showModal.incident.modified_dt ? new Date(showModal.incident.modified_dt).toLocaleString() : "—"}</p>
              <div className="section-title"><p><b>Closest traffic cameras:</b></p></div>
              <p style={{ textAlign: "center", fontSize: "0.8rem", color: "gray", margin: "0.25rem 0 0.25rem 0" }}> Click on images to enlarge!</p>
            </div>
            
            {/* camera images in the popup */}
            <div className="cam-grid" style={{ padding: "0.5rem 1rem 1rem 1rem", marginTop: "0" }}>
              {showModal.cameras.map(function(camera, index) {
                return (
                  <div key={index} style={{ textAlign: "center" }}>
                    <img 
                      src={camera.url} 
                      alt={camera.description} 
                      onClick={function() { 
                        setShowImageModal(camera.url); // show big version when clicked
                      }} 
                      style={{ height: "140px", width: "100%", maxWidth: "320px"}}
                      onError={function(e) {
                        e.target.style.display = 'none'; // hide broken images
                      }}
                    />
                    <div className="cam-distance">~{camera.distance_km ? camera.distance_km.toFixed(2) : 0} km</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* popup showing enlarged camera image */}
      {showImageModal && (
        <div 
          className="modal" 
          onClick={function() { setShowImageModal(null); }} 
          style={{ alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.9)" }}
        >
          <img 
            src={showImageModal} 
            alt="camera" 
            style={{ maxWidth: "95vw", maxHeight: "95vh", borderRadius: "8px" }} 
            onClick={function(e) { e.stopPropagation(); }} // don't close when clicking image
          />
          <button 
            className="close-btn" 
            onClick={function() { setShowImageModal(null); }} 
            style={{ position: "absolute", top: "1rem", right: "1rem" }}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
