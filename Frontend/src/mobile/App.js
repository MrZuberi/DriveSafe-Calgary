import { useEffect, useState } from "react";
import axios from "axios";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import './App.css';
import bgImage from "./image2.jpg";
import driveGif from "./drive.gif";

// NOTE: This file is bascially the same as desktop, but with some layout/sizing/images changes for mobiles and tablets/ipads

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

  function loadCameras() {
    axios.get(`${API_BASE_URL}/api/cameras`)
      .then(function(response) {
        // cameras are fetched on-demand via nearest-cameras endpoint
        // this prefetch is kept for future use
      })
      .catch(function(error) {
        console.error("Error loading cameras:", error);
      });
  }

  useEffect(function() {
    loadIncidents();
    loadCameras();
    
    const timer = setInterval(loadIncidents, 30000);
    
    return function() {
      clearInterval(timer);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSelectIncident(incident) {
    setSelectedIncident(incident);
    
    if (incident && incident.coordinates && incident.coordinates.lat && incident.coordinates.lon) {
      axios.get(`${API_BASE_URL}/api/nearest-cameras`, {
        params: {
          lat: incident.coordinates.lat,
          lon: incident.coordinates.lon,
          limit: 4
        }
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
          setShowModal(modalData);
        }
      })
      .catch(function(error) {
        console.error("Error loading incident with cameras:", error);
        setShowModal({
          incident: incident,
          cameras: []
        });
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
      
      if (incident.incident_info && incident.incident_info.toLowerCase().includes(searchLower)) {
        shouldInclude = true;
      }
      if (incident.description && incident.description.toLowerCase().includes(searchLower)) {
        shouldInclude = true;
      }
      if (incident.quadrant && incident.quadrant.toLowerCase().includes(searchLower)) {
        shouldInclude = true;
      }
      
      if (shouldInclude) {
        filteredIncidents.push(incident);
      }
    }
  }

  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '1.2rem',
        background: `url(${bgImage})`,
        backgroundSize: 'cover',
        color: 'white'
      }}>
        🚗 Loading Calgary Traffic...
      </div>
    );
  }

  return (
    <>
      <meta name="viewport" content="width=1200" />
      <div 
        style={{ 
          backgroundImage: `url(${bgImage})`,
          backgroundSize: "cover", 
          backgroundAttachment: "scroll",
          minHeight: "100vh",
          backgroundPosition: "center center"
        }}
      >
        <div className="header-left">
          <img src={driveGif} alt="Drive Animation" className="header-gif" />
          <div>
            <h1 style={{ fontSize: '55px', opacity: 0.8, marginBottom: '15px' }}>DriveSafe Calgary</h1>
            <p>Live Traffic Incidents & Camera Feed</p>
            <p >Map • Search • Details • Updates</p>
            <p style={{ fontSize: '12px', opacity: 0.8 }}>*Recommend Viewing on Desktop*</p>
          </div>
        </div>

        <div className="main-content">
          <div className="container">
            <div className="grid-2">
              <div className="card" style={{ padding: 0 }}>
                <div style={{ padding: '1.5rem', background: '#f5f6f7', borderBottom: '1px solid #dee2e6' }}>
                  <div style={{ fontWeight: 600, color: '#004c8c', fontSize: '1.1rem' }}>
                    🗺️ Calgary Traffic Map
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#6c757d', marginTop: '0.5rem' }}>
                    Tap any marker to view incident details
                  </div>
                </div>
                <MapContainer
                  center={[51.0447, -114.0719]}
                  zoom={11}
                  style={{ height: "100%", borderRadius: "0 0 12px 12px", zIndex: 1 }}
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
                      <Marker 
                        key={incident.id} 
                        position={[coords.lat, coords.lon]} 
                        eventHandlers={{ 
                          click: function() { 
                            handleSelectIncident(incident);
                          } 
                        }}
                      >
                        <Popup>
                          <div style={{ maxWidth: '280px', padding: '0.5rem' }}>
                            <b style={{ color: '#d64545', fontSize: '1rem', display: 'block', marginBottom: '0.5rem' }}>
                              {incident.incident_info}
                            </b>
                            <div style={{ margin: '0.5rem 0', fontSize: '0.9rem', lineHeight: '1.4' }}>
                              {incident.description}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#6c757d', marginTop: '0.5rem' }}>
                              {incident.start_dt ? new Date(incident.start_dt).toLocaleString() : ""}
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                </MapContainer>
              </div>

              <div className="card">
                <div className="card-header">
                  🚨 Incident Details
                </div>
                {!selectedIncident ? (
                  <div className="right-panel-empty">
                    <div>Click any map marker to see incident details</div>
                    <div className="badge" style={{ marginTop: "1rem" }}>
                      Live updates every 30 seconds
                    </div>
                  </div>
                ) : (
                  <div className="details">
                    <h2>{selectedIncident.incident_info}</h2>
                    <p style={{ marginBottom: "1.5rem", lineHeight: '1.6' }}>{selectedIncident.description}</p>
                    
                    <div style={{ background: '#f8f9fa', padding: '1.5rem', borderRadius: '10px', marginBottom: '1.5rem' }}>
                      <p style={{ margin: "0 0 0.75rem 0", lineHeight: '1.5' }}>
                        <b>📅 When:</b> {selectedIncident.start_dt ? new Date(selectedIncident.start_dt).toLocaleString() : "—"}
                      </p>
                      <p style={{ margin: "0 0 0.75rem 0", lineHeight: '1.5' }}>
                        <b>📍 Area:</b> {selectedIncident.quadrant || "—"}
                      </p>
                      <p style={{ margin: "0", lineHeight: '1.5' }}>
                        <b>🔄 Updated:</b> {selectedIncident.modified_dt ? new Date(selectedIncident.modified_dt).toLocaleString() : "—"}
                      </p>
                    </div>

                    <div className="section-title">📹 Nearest Traffic Cameras</div>
                    <p style={{ textAlign: "center", fontSize: "0.9rem", color: "#6c757d", margin: "0.75rem 0 1.25rem 0", lineHeight: '1.4' }}>
                      Scroll and Click images to view them in full size!
                    </p>

                    <div className="cam-grid">
                      {nearestCameras.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2.5rem', color: '#6c757d', fontSize: '1rem' }}>
                          📷 No cameras available near this incident
                        </div>
                      ) : (
                        nearestCameras.map(function(camera, index) {
                          return (
                            <div key={index} style={{ position: 'relative'}}>
                              <img
                                src={camera.url}
                                alt={camera.description}
                                onClick={function() { 
                                  setShowImageModal(camera.url);
                                }}
                                onError={function(e) {
                                  e.target.style.display = 'none';
                                }}
                                style={{
                                    width: '100%',
                                    height: '60%',
                                  }}
                              />
                              <div className="cam-distance">
                                📍 {camera.distance_km ? camera.distance_km.toFixed(2) : 0} km away
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="search-list">
              <div className="search-bar">
                <input 
                  placeholder="🔍 Search incidents, locations, or descriptions..." 
                  value={searchText} 
                  onChange={function(e) { 
                    setSearchText(e.target.value);
                  }} 
                  style={{ padding: '1.25rem', fontSize: '1.05rem' }}
                />
                <div className="badge" style={{ padding: '0.75rem 1.5rem', fontSize: '1rem' }}>
                  {filteredIncidents.length} incidents found
                </div>
              </div>

              <div className="item-list">
                {filteredIncidents.length === 0 ? (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '3.5rem 1.5rem', 
                    color: '#6c757d' 
                  }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '1.25rem' }}>🔍</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                      No incidents found
                    </div>
                    <div style={{ fontSize: '1rem', lineHeight: '1.5' }}>
                      Try adjusting your search terms
                    </div>
                  </div>
                ) : (
                  filteredIncidents.map(function(incident) {
                    return (
                      <div 
                        key={incident.id} 
                        className="item" 
                        onClick={function() { 
                          handlePickFromList(incident);
                        }}
                        style={{ padding: '1.5rem' }}
                      >
                        <div className="item-header">
                          <div className="item-title" style={{ fontSize: '1.15rem', marginBottom: '0.5rem' }}>
                            🚨 {incident.incident_info}
                          </div>
                          <div className="badge time" style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}>
                            {incident.start_dt ? new Date(incident.start_dt).toLocaleTimeString() : ""}
                          </div>
                        </div>
                        <div className="item-description" style={{ fontSize: '1rem', lineHeight: '1.6', marginBottom: '1rem' }}>
                          {incident.description}
                        </div>
                        <div style={{ 
                          marginTop: '1rem', 
                          fontSize: '0.9rem', 
                          color: '#6c757d',
                          display: 'flex',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '0.75rem',
                          lineHeight: '1.4'
                        }}>
                          <span>📍 {incident.quadrant || "Unknown area"}</span>
                          <span>🕐 Updated: {incident.modified_dt ? new Date(incident.modified_dt).toLocaleTimeString() : "—"}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {showModal && (
          <div className="modal" onClick={function() { setShowModal(null); }}>
            <div className="modal-card" onClick={function(e) { e.stopPropagation(); }} style={{ maxWidth: '1200px'}}>
              <div className="modal-header">
                <div className="modal-title" style={{ fontSize: '1.3rem' }}>🚨 {showModal.incident.incident_info}</div>
                <button className="close-btn" onClick={function() { setShowModal(null); }} style={{ padding: '0.75rem 1.25rem' }}>✕</button>
              </div>
              <div className="modal-content">
                <div className="inline-modal-content">
                  <div style={{ background: '#f8f9fa', padding: '1.5rem', borderRadius: '10px', marginBottom: '1.5rem' }}>
                    <p style={{ marginBottom: '1rem', lineHeight: '1.5' }}>
                      <b>📍 Description:</b> {showModal.incident.description}
                    </p>
                    <p style={{ marginBottom: '1rem', lineHeight: '1.5' }}>
                      <b>📅 When:</b> {showModal.incident.start_dt ? new Date(showModal.incident.start_dt).toLocaleString() : "—"}
                    </p>
                    <p style={{ marginBottom: '1rem', lineHeight: '1.5' }}>
                      <b>📍 Area:</b> {showModal.incident.quadrant || "—"}
                    </p>
                    <p style={{ marginBottom: '0', lineHeight: '1.5' }}>
                      <b>🔄 Updated:</b> {showModal.incident.modified_dt ? new Date(showModal.incident.modified_dt).toLocaleString() : "—"}
                    </p>
                  </div>
                  
                  {showModal.cameras.length > 0 && (
                    <>
                      <div style={{ 
                        fontSize: '1.2rem', 
                        fontWeight: 700, 
                        color: '#004c8c', 
                        marginBottom: '1.25rem',
                        textAlign: 'center'
                      }}>
                        📹 Nearby Traffic Cameras
                      </div>
                      <p style={{ 
                        textAlign: "center", 
                        fontSize: "0.95rem", 
                        color: "#6c757d", 
                        marginBottom: "1.5rem",
                        lineHeight: '1.4'
                      }}>
                        Scroll and Click images to enlarge!
                      </p>
                    </>
                  )}
                </div>
                
                {showModal.cameras.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {showModal.cameras.map(function(camera, index) {
                      return (
                        <div key={index} style={{ textAlign: 'center' }}>
                          <img 
                            src={camera.url} 
                            alt={camera.description} 
                            onClick={function() { 
                              setShowImageModal(camera.url);
                            }}
                            style={{ 
                              width: '100%',
                              height: '400px',
                              objectFit: 'cover',
                              borderRadius: '10px',
                              cursor: 'pointer',
                              transition: 'transform 0.2s ease'
                            }}
                            onError={function(e) {
                              e.target.style.display = 'none';
                            }}
                          />
                          <div style={{
                            marginTop: '0.75rem',
                            fontSize: '1rem',
                            fontWeight: 600,
                            color: '#004c8c',
                            padding: '0.5rem'
                          }}>
                            📍 ~{camera.distance_km ? camera.distance_km.toFixed(2) : 0} km away
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {showModal.cameras.length === 0 && (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '2.5rem', 
                    color: '#6c757d',
                    fontSize: '1.1rem'
                  }}>
                    📷 No cameras available near this incident
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {showImageModal && (
          <div 
            className="modal" 
            onClick={function() { setShowImageModal(null); }} 
            style={{ 
              alignItems: "center", 
              justifyContent: "center", 
              background: "rgba(0,0,0,0.95)",
              padding: '1.5rem'
            }}
          >
            <div style={{ position: 'relative', maxWidth: '100%', maxHeight: '100%' }}>
              <button 
                className="close-btn" 
                onClick={function() { setShowImageModal(null); }} 
                style={{ 
                  position: "absolute", 
                  top: "-70px", 
                  right: "0",
                  zIndex: 10001,
                  padding: '0.75rem 1.5rem',
                  fontSize: '1rem'
                }}
              >
                ✕ Close
              </button>
              <img 
                src={showImageModal} 
                alt="Traffic Camera" 
                style={{ 
                  maxWidth: "100%", 
                  maxHeight: "85vh", 
                  borderRadius: "12px",
                  display: 'block',
                  objectFit: 'contain'
                }} 
                onClick={function(e) { e.stopPropagation(); }} 
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default App;
