import { useEffect, useState } from "react";
import axios from "axios";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import './App.css';
import './mobiles.css'; 
import driveGif from "./drive.gif";
import image1 from "./image1.jpg"; // added

// fixes broken marker icons in leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || "https://drivesafecalgary-13a17c07f5d1.herokuapp.com";

const CALGARY_BOUNDS = [
  [50.842, -114.316],
  [51.215, -113.859],
];

function App() {
  const [incidents, setIncidents] = useState([]);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [nearestCameras, setNearestCameras] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [showModal, setShowModal] = useState(null);
  const [showImageModal, setShowImageModal] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  function loadIncidents() {
    axios.get(`${API_BASE_URL}/api/incidents?limit=500`)
      .then(function(response) {
        const data = response.data;
        if (data && data.items) {
          const cleanIncidents = data.items.filter(incident => 
            incident.coordinates && incident.coordinates.lat && incident.coordinates.lon
          );
          cleanIncidents.sort(function(a, b) {
            const dateA = new Date(a.start_dt || 0);
            const dateB = new Date(b.start_dt || 0);
            return dateB - dateA;
          });
          setIncidents(cleanIncidents);
        }
        setIsLoading(false);
      })
      .catch(function(error) {
        console.error("Error loading incidents:", error);
        setIsLoading(false);
      });
  }

  useEffect(function() {
    loadIncidents();
    const timer = setInterval(loadIncidents, 30000);
    return function() {
      clearInterval(timer);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSelectIncident(incident) {
    setSelectedIncident(incident);
    if (incident && incident.coordinates && incident.coordinates.lat && incident.coordinates.lon) {
      axios.get(`${API_BASE_URL}/api/nearest-cameras`, {
        params: { lat: incident.coordinates.lat, lon: incident.coordinates.lon, limit: 4 }
      })
      .then(function(response) {
        const data = response.data;
        if (data && data.items) {
          setNearestCameras(data.items);
        }
      })
      .catch(function(error) {
        console.error("Error loading nearest cameras:", error);
        setNearestCameras([]);
      });
    } else {
      setNearestCameras([]);
    }
  }

  function handlePickFromList(incident) {
    if (incident && incident.id) {
      axios.get(`${API_BASE_URL}/api/incident-with-cameras`, {
        params: { id: incident.id, limit: 4 }
      })
      .then(function(response) {
        const data = response.data;
        if (data && data.incident && data.nearest_cameras) {
          setShowModal({ incident: data.incident, cameras: data.nearest_cameras.items || [] });
        }
      })
      .catch(function(error) {
        console.error("Error loading incident with cameras:", error);
        setShowModal({ incident: incident, cameras: [] });
      });
    }
  }

  const filteredIncidents = [];
  const searchLower = searchText.toLowerCase().trim();
  for (let i = 0; i < incidents.length; i++) {
    const incident = incidents[i];
    if (searchLower === "") {
      filteredIncidents.push(incident);
    } else {
      let shouldInclude = false;
      if (incident.incident_info && incident.incident_info.toLowerCase().includes(searchLower)) shouldInclude = true;
      if (incident.description && incident.description.toLowerCase().includes(searchLower)) shouldInclude = true;
      if (incident.quadrant && incident.quadrant.toLowerCase().includes(searchLower)) shouldInclude = true;
      if (shouldInclude) filteredIncidents.push(incident);
    }
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '18px' }}>
        Loading traffic data....
      </div>
    );
  }

  return (
    <div style={{ backgroundImage: `url(${image1})`, backgroundSize: "cover", backgroundAttachment: "fixed", minHeight: "100vh", backgroundPosition: "center center", display: "flex" }}>
      <div className="header-left">
        <img src={driveGif} alt="Drive Animation" className="header-gif" />
        <div>
          <h1 style={{ fontSize: '32px' }}>DriveSafe Calgary</h1>
          <h2 style={{ fontSize: '16px' }}>Calgary Live Traffic Incidents</h2>
          <p style={{ fontSize: '14px' }}>Map | Details | Nearest Traffic Cameras | Updates</p>
        </div>
      </div>

      <div className="main-content">
        <div className="container" style={{ paddingBottom: "6rem" }}>
          <div className="grid-2">
            
            <div className="card" style={{ padding: 0, minHeight: "520px" }}>
              <div style={{ padding: '0.8rem', background: '#f5f6f7', borderBottom: '1px solid #dee2e6'}}>
                <div style={{ fontWeight: 600, color: '#004c8c', fontSize: '1rem' }}>
                  🗺️ Calgary Traffic Map
                </div>
                <div style={{ fontSize: '0.8rem', color: '#6c757d', marginTop: '0.3rem' }}>
                  Zoom into map and tap any red marker to view incident details
                </div>
              </div>
              <MapContainer
                center={[51.0447, -114.0719]}
                zoom={10}
                style={{ height: "100%", minHeight: "520px", borderRadius: "12px", zIndex: 0 }}
                maxBounds={CALGARY_BOUNDS}
                maxBoundsViscosity={1.0}
              >
                <TileLayer
                  attribution='&copy; OpenStreetMap contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {incidents.slice(0, 25).map(function(incident) {
                  const coords = incident.coordinates;
                  if (!coords) return null;
                  return (
                    <Marker key={incident.id} position={[coords.lat, coords.lon]} eventHandlers={{ click: function() { handleSelectIncident(incident); } }}>
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

            <div className="card" style={{ height: "auto", padding: "0.5rem" }}>
              {!selectedIncident ? (
                <div className="right-panel-empty" style={{ fontSize: "0.9rem", lineHeight: "0.75rem" }}>
                  <div>Click any map icon to see accidents</div>
                  <div className="badge" style={{ marginTop: "0.25rem" }}>Live feed. Updates automatically.</div>
                </div>
              ) : (
                <div className="details" style={{ overflow: "visible", lineHeight: "1.2rem" }}>
                  <h2 style={{ fontSize: "1.3rem", fontWeight: "700", marginBottom: "0.3rem" }}>{selectedIncident.incident_info}</h2>
                  <p style={{ fontSize: "0.95rem", margin: "0 0 0.3rem 0" }}>{selectedIncident.description}</p>
                  <p style={{ margin: "0 0 0.3rem 0" }}><b>When:</b> {selectedIncident.start_dt ? new Date(selectedIncident.start_dt).toLocaleString() : "—"}</p>
                  <p style={{ margin: "0 0 0.3rem 0" }}><b>Quadrant:</b> {selectedIncident.quadrant || "—"}</p>
                  <p style={{ margin: "0 0 0.3rem 0" }}><b>Last updated:</b> {selectedIncident.modified_dt ? new Date(selectedIncident.modified_dt).toLocaleString() : "—"}</p>
                  <div className="section-title" style={{ marginBottom: "0.25rem" }}>Closest traffic cameras:</div>
                  <p style={{ textAlign: "center", fontSize: "0.75rem", color: "gray", margin: "0.1rem 0 0.25rem 0" }}>Click on images to enlarge!</p>
                  <div className="cam-grid" style={{ gap: "0.25rem" }}>
                    {nearestCameras.map(function(camera, index) {
                      return (
                        <div key={index}>
                          <img
                            src={camera.url}
                            alt={camera.description}
                            onClick={function() { setShowImageModal(camera.url); }}
                            style={{ height: "150px", width: "310px", objectFit: "cover" }}
                            onError={function(e) { e.target.style.display = 'none'; }}
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

          <div className="search-list">
            <div className="search-bar">
              <input placeholder="Search any recent incidents..." value={searchText} onChange={function(e) { setSearchText(e.target.value); }} />
              <div className="badge">{filteredIncidents.length} matches</div>
            </div>
            <div className="item-list">
              {filteredIncidents.map(function(incident) {
                return (
                  <div key={incident.id} className="item" onClick={function() { handlePickFromList(incident); }}>
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
              <p style={{ textAlign: "center", fontSize: "0.8rem", color: "gray", margin: "0.25rem 0" }}>Click on images to enlarge!</p>
            </div>
            <div className="cam-grid" style={{ padding: "0.5rem 1rem 1rem 1rem", marginTop: "0" }}>
              {showModal.cameras.map(function(camera, index) {
                return (
                  <div key={index} style={{ textAlign: "center" }}>
                    <img src={camera.url} alt={camera.description} onClick={function() { setShowImageModal(camera.url); }} style={{ height: "140px", width: "100%", maxWidth: "320px" }} onError={function(e) { e.target.style.display = 'none'; }} />
                    <div className="cam-distance">~{camera.distance_km ? camera.distance_km.toFixed(2) : 0} km</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showImageModal && (
        <div className="modal" onClick={function() { setShowImageModal(null); }} style={{ alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.9)" }}>
          <img src={showImageModal} alt="camera" style={{ maxWidth: "95vw", maxHeight: "95vh", borderRadius: "8px" }} onClick={function(e) { e.stopPropagation(); }} />
          <button className="close-btn" onClick={function() { setShowImageModal(null); }} style={{ position: "absolute", top: "1rem", right: "1rem" }}>Close</button>
        </div>
      )}
    </div>
  );
}

export default App;
