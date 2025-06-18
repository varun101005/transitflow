import React, { useState, useEffect } from "react";
import axios from "axios";
import { MapContainer, TileLayer, Marker, Polyline, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "./index.css";

const AddStopPage = () => {
  // State variables
  const [stations, setStations] = useState([]); // List of available stations
  const [selectedStop, setSelectedStop] = useState(""); // Currently selected stop
  const [stops, setStops] = useState([]); // List of selected stops
  const [route, setRoute] = useState([]); // Computed route
  const [estimatedTime, setEstimatedTime] = useState(null); // ETA for the route
  const [statusMessage, setStatusMessage] = useState(""); // User feedback messages

  // Retrieve start and end stations from local storage
  const startStation = localStorage.getItem("startStation");
  const endStation = localStorage.getItem("endStation");

  // Fetch station list from the backend
  useEffect(() => {
    axios.get("http://127.0.0.1:5000/stations")
      .then(res => setStations(res.data))
      .catch(err => {
        console.error("Failed to load stations:", err);
        setStatusMessage("❌ Could not load stations.");
      });
  }, []);

  // Function to add a selected stop
  const handleAddStop = () => {
    if (!selectedStop || stops.includes(selectedStop)) {
      setStatusMessage("⚠️ Please select a unique stoppage.");
      return;
    }

    const updatedStops = [...stops, selectedStop];
    setStops(updatedStops);
    setSelectedStop("");

    // Construct full route
    const fullRoute = [startStation, ...updatedStops, endStation];

    // Fetch route details from backend
    axios.post("http://127.0.0.1:5000/multi-route", { stops: fullRoute })
      .then((res) => {
        setRoute(res.data.route);
        setEstimatedTime(res.data.estimated_time_minutes);
        setStatusMessage("✅ Route calculated successfully!");
      })
      .catch((err) => {
        console.error("Failed to compute route:", err);
        setStatusMessage("❌ Failed to compute route.");
      });
  };

  // Extract coordinates for mapping
  const getRouteCoordinates = () =>
    route.map(name => {
      const station = stations.find(s => s.name === name);
      return station ? [station.lat, station.lon] : null;
    }).filter(Boolean);

  return (
    <div className="container">
      <h2>Add Intermediate Stops ➕</h2>

      <div style={{ marginBottom: "1rem" }}>
        <strong>Start:</strong> {startStation || "Not Set"}<br />
        <strong>End:</strong> {endStation || "Not Set"}
      </div>

      <div>
        <label>Select a Stoppage:</label><br />
        <select
          value={selectedStop}
          onChange={(e) => setSelectedStop(e.target.value)}
          style={{ width: "300px", padding: "10px", marginRight: "10px" }}
        >
          <option value="">-- Choose Station --</option>
          {stations.map((s) => (
            <option key={s.name} value={s.name}>{s.name}</option>
          ))}
        </select>

        <button className="swap-button" onClick={handleAddStop}>+</button>
      </div>

      {statusMessage && <div style={{ marginTop: "15px", fontWeight: "bold" }}>{statusMessage}</div>}

      {stops.length > 0 && (
        <div style={{ marginTop: "20px" }}>
          <h4>🚏 Your Stoppages</h4>
          <ul>
            {stops.map((stop, idx) => (
              <li key={idx}>{`Stop ${idx + 1}: ${stop}`}</li>
            ))}
          </ul>
        </div>
      )}

      {route.length > 0 && (
        <>
          <div className="route-info">
            <h3>🧭 Route Info</h3>
            <p>{route.join(" ➝ ")}</p>
            <p><strong>ETA:</strong> {estimatedTime} minutes</p>
          </div>

          <div className="map-section fade-in">
            <MapContainer center={[30.3255, 78.0414]} zoom={13} scrollWheelZoom={true} style={{ height: "100%", width: "100%" }}>
              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {getRouteCoordinates().map((pos, idx) => (
                <Marker key={idx} position={pos}>
                  <Popup>{route[idx]}</Popup>
                </Marker>
              ))}
              <Polyline positions={getRouteCoordinates()} color="blue" weight={5} />
            </MapContainer>
          </div>
        </>
      )}
    </div>
  );
};

export default AddStopPage;
