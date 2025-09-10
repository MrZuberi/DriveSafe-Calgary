import os
import math
import time
import json
import requests
from flask import Flask, jsonify, request
from flask_cors import CORS


# creates the web server
app = Flask(__name__)
CORS(app) # allows frontend to talk to backend from different domains


# gets api urls from environment variables (heroku config)
CAMERAS_URL = os.getenv('CAMERAS_URL')
INCIDENTS_URL = os.getenv('INCIDENTS_URL')



# stores data in memory
cameras_cache = {"timestamp": 0, "data": []} # last got camera data
incidents_cache = {"timestamp": 0, "data": []} #  last got incident data

# how long to keep cached data before getting fresh data
CAMERAS_CACHE_SECONDS = 60  # (updates every minute and incidents is 30 sec)
INCIDENTS_CACHE_SECONDS = 30  


# gets current time as a number
def get_current_time():
    return int(time.time())

# checks if cached data is too old and needs refreshing
def is_cache_expired(cache, max_age_seconds):
    current_time = get_current_time()
    return (current_time - cache["timestamp"]) >= max_age_seconds

# saves new data to cache with current timestamp
def update_cache(cache, new_data):
    cache["timestamp"] = get_current_time()
    cache["data"] = new_data

# calculates distance between two points on earth using math
def calculate_distance_km(lat1, lon1, lat2, lon2): #calculating distances
    earth_radius = 6371.0 # earth radius in kilometers
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return earth_radius * c # returns distance in km



# takes messy camera data from api and makes it clean and consistent
def clean_camera_data(rec):
    # get camera url and description from different possible formats
    url = None
    desc = None
    if isinstance(rec.get("camera_url"), dict):
        url = rec["camera_url"].get("url")
        desc = rec["camera_url"].get("description")
    else:
        url = rec.get("camera_url")
        desc = rec.get("camera_location")

    # get coordinates from the weird api format
    coords = None
    if isinstance(rec.get("point"), dict) and rec["point"].get("coordinates"):
        lon, lat = rec["point"]["coordinates"] # api gives lon first, lat second
        coords = {"lat": lat, "lon": lon}
    else:
        coords = None

    # return clean, simple format
    return {
        "description": desc,
        "camera_location": rec.get("camera_location"),
        "quadrant": rec.get("quadrant"),
        "url": url,
        "coordinates": coords
    }

# takes messy incident data from api and makes it clean
def clean_incident_data(rec):
    # get coordinates from api format or fallback fields
    coords = None
    if isinstance(rec.get("point"), dict) and rec["point"].get("coordinates"):
        lon, lat = rec["point"]["coordinates"] # lon comes first in api
        coords = {"lat": lat, "lon": lon}
    else:
        # fallback to lat/long fields if present
        lat = rec.get("latitude")
        lon = rec.get("longitude")
        try:
            lat = float(lat) if lat is not None else None
            lon = float(lon) if lon is not None else None
            if lat is not None and lon is not None:
                coords = {"lat": lat, "lon": lon}
        except Exception:
            coords = None # ignore bad coordinate data

    # return clean format
    return {
        "id": rec.get("id"),
        "incident_info": rec.get("incident_info"),
        "description": rec.get("description"),
        "start_dt": rec.get("start_dt"),
        "modified_dt": rec.get("modified_dt"),
        "quadrant": rec.get("quadrant"),
        "coordinates": coords
    }



# gets camera data from api or cache
def get_cameras():
    # check if cache is still valid - don't hit api if we have recent data
    if not is_cache_expired(cameras_cache, CAMERAS_CACHE_SECONDS):
        return cameras_cache["data"]

    # fetch fresh data from calgary api
    params = {
        "$limit": 5000  # more than enough for current dataset size
    }
    r = requests.get(CAMERAS_URL, params=params, timeout=20)
    r.raise_for_status() # crash if api call fails
    data = r.json()
    cameras = [clean_camera_data(x) for x in data if x] # clean up each camera record
    
    # save to cache for next time
    update_cache(cameras_cache, cameras)
    return cameras

# gets incident data from api or cache
def get_incidents(limit=None):
    # check if we can use cached data
    cache_is_valid = not is_cache_expired(incidents_cache, INCIDENTS_CACHE_SECONDS)
    if cache_is_valid and (limit is None or limit >= len(incidents_cache["data"])):
        cached_data = incidents_cache["data"]
        return cached_data if limit is None else cached_data[:limit] # return requested amount

    # fetch fresh data from calgary api
    params = {
        "$order": "start_dt DESC", # newest incidents first
        "$limit": 5000 if limit is None else max(limit, 1)
    }
    r = requests.get(INCIDENTS_URL, params=params, timeout=20)
    r.raise_for_status() # crash if api fails
    data = r.json()
    incidents = [clean_incident_data(x) for x in data if x] # clean each incident
    
    # only update cache for big requests to avoid constant cache updates
    if limit is None or limit >= 500:
        update_cache(incidents_cache, incidents)
    
    return incidents if limit is None else incidents[:limit]


# simple health check to see if server is running
@app.get("/api/health")
def health():
    return jsonify({"ok": True})

# returns list of traffic incidents
@app.get("/api/incidents")
def get_incidents_endpoint():
    """Return incidents ordered by newest first
    Query params:
      - limit (int): number of incidents to return
    """
    # get limit from url parameter, default to 100
    try:
        limit = int(request.args.get("limit", "100"))
    except Exception:
        limit = 100 # fallback if bad input
    limit = max(1, min(limit, 1000)) # keep limit reasonable
    data = get_incidents(limit=limit)
    return jsonify({"count": len(data), "items": data})

# returns all available incidents
@app.get("/api/incidents/all")
def get_incidents_all():
    """Return as many incidents as API allows (capped)."""
    data = get_incidents(limit=None) # no limit
    return jsonify({"count": len(data), "items": data})

# returns list of traffic cameras
@app.get("/api/cameras")
def get_cameras_endpoint():
    cams = get_cameras()
    return jsonify({"count": len(cams), "items": cams})

# finds cameras closest to a given location
@app.get("/api/nearest-cameras")
def nearest_cameras():
    """Return nearest N cameras to a lat/lon.
    Query params:
      - lat (float) required
      - lon (float) required
      - limit (int) default 4
    """
    # get required coordinates from url
    try:
        lat = float(request.args["lat"])
        lon = float(request.args["lon"])
    except Exception:
        return jsonify({"error": "lat and lon are required floats"}), 400

    # get how many cameras to return
    try:
        limit = int(request.args.get("limit", "4"))
    except Exception:
        limit = 4
    limit = max(1, min(limit, 20)) # reasonable limits

    # get cameras that have coordinates and calculate how far they are
    cams = [c for c in get_cameras() if c.get("coordinates")]
    for c in cams:
        clat = c["coordinates"]["lat"]
        clon = c["coordinates"]["lon"]
        c["distance_km"] = calculate_distance_km(lat, lon, clat, clon) # add distance to each camera

    # sort by distance so closest comes first
    cams.sort(key=lambda x: x.get("distance_km", float("inf")))
    return jsonify({"count": min(limit, len(cams)), "items": cams[:limit]})

# gets incident details plus nearby cameras in one call
@app.get("/api/incident-with-cameras")
def incident_with_cameras():
    """Convenience: given incident id, return incident plus nearest N cameras.
    Query params:
      - id (str) required
      - limit (int) default 4
    """
    # get incident id from url
    inc_id = request.args.get("id")
    if not inc_id:
        return jsonify({"error": "id is required"}), 400
    
    # get camera limit
    try:
        limit = int(request.args.get("limit", "4"))
    except Exception:
        limit = 4
    limit = max(1, min(limit, 20))

    # find the specific incident by id
    incidents = get_incidents(limit=None)
    incident = next((x for x in incidents if x.get("id") == inc_id), None)
    if not incident or not incident.get("coordinates"):
        return jsonify({"error": "incident not found or missing coordinates"}), 404

    # get cameras near this incident
    lat = incident["coordinates"]["lat"]
    lon = incident["coordinates"]["lon"]
    cams_resp = find_nearest_cameras(lat, lon, limit)
    return jsonify({"incident": incident, "nearest_cameras": cams_resp})

# helper function to find cameras near a location
def find_nearest_cameras(lat, lon, limit):
    # get cameras with coordinates and calculate distances
    cams = [c for c in get_cameras() if c.get("coordinates")]
    for c in cams:
        clat = c["coordinates"]["lat"]
        clon = c["coordinates"]["lon"]
        c["distance_km"] = calculate_distance_km(lat, lon, clat, clon)
    
    # sort by distance closest first
    cams.sort(key=lambda x: x.get("distance_km", float("inf")))
    return {"count": min(limit, len(cams)), "items": cams[:limit]}


# starts the web server when script runs
if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000")) # heroku sets PORT, default 5000 locally
    
    app.run(host="0.0.0.0", port=port, debug=False) # start server
