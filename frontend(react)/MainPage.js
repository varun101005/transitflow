import React, { useState, useEffect } from "react";
import axios from "axios";
import { MapContainer, TileLayer, Marker, Polyline, Popup } from "react-leaflet";
import ClipLoader from "react-spinners/ClipLoader";
import "leaflet/dist/leaflet.css";
import "./index.css";

const MainPage = () => {
  const [stations, setStations] = useState([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [algorithm, setAlgorithm] = useState("dijkstra");

  const [routeResult, setRouteResult] = useState(null);
  const [fwTime, setFwTime] = useState(null);
  const [dijkstraTime, setDijkstraTime] = useState(null);

  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [showRouteBlock, setShowRouteBlock] = useState(false);

  useEffect(() => {
    // Basic data fetch from backend
    axios.get("http://127.0.0.1:5000/stations")
      .then(res => setStations(res.data))
      .catch(err => {
        console.warn("⚠️ Failed to load stations:", err);
        setErrorMsg("Oops! Couldn't load station list.");
      });
  }, []);

  const stationNames = stations.map((s) => s.name);

  const handleRouteFetch = () => {
    // Resetting stuff
    setErrorMsg("");
    setRouteResult(null);
    setFwTime(null);
    setDijkstraTime(null);
    setShowRouteBlock(false);

    if (!from || !to) {
      setErrorMsg("Missing starting or ending station.");
      return;
    }

    // Save state for /add-stop use
    localStorage.setItem("startStation", from);
    localStorage.setItem("endStation", to);

    setLoading(true);

    // Always grab FW time
    axios.get("http://127.0.0.1:5000/fw_time", {
      params: { from, to }
    }).then((res) => {
      setFwTime(res.data.estimated_time_minutes);
    });

    if (algorithm === "dijkstra") {
      axios.get("http://127.0.0.1:5000/route", {
        params: { lat: 0, lon: 0, from, to }
      })
        .then((res) => {
          setRouteResult(res.data);
          setDijkstraTime(res.data.estimated_time_minutes);
          setShowRouteBlock(true);
        })
        .catch(() => {
          setErrorMsg("Failed to fetch route details.");
        })
        .finally(() => setLoading(false));
    } else {
      // In case user selects FW-only
      setLoading(false);
      setShowRouteBlock(true);
    }
  };

  const doSwap = () => {
    setFrom(to);
    setTo(from);
  };

  return (
    <div className="container">
      <div className="form-section">
        <div className="input-group">
          <label>Start 📍</label>
          <select value={from} onChange={(e) => setFrom(e.target.value)}>
            <option value="">-- Choose Starting Point --</option>
            {stationNames.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <button onClick={doSwap} className="swap-button" title="Flip From/To">⇄</button>

        <div className="input-group">
          <label>End 🎯</label>
          <select value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="">-- Choose Destination --</option>
            {stationNames.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="algo-section">
        <label>Algorithm Choice ⚙️</label>
        <select value={algorithm} onChange={(e) => setAlgorithm(e.target.value)}>
          <option value="dijkstra">Dijkstra (Route + ETA)</option>
          <option value="floyd">Floyd-Warshall (ETA Only)</option>
        </select>
      </div>

      <button onClick={handleRouteFetch} disabled={loading}>
        {loading ? "Loading..." : "Show Route"}
      </button>

      {loading && (
        <div style={{ textAlign: "center", marginTop: "20px" }}>
          <ClipLoader color="#3b82f6" size={50} />
        </div>
      )}

      {errorMsg && <div className="error">{errorMsg}</div>}

      {showRouteBlock && (
        <div className="fade-in">
          <div className="route-info">
            <h3>📊 Route Overview</h3>
            <p><strong>From:</strong> {from}</p>
            <p><strong>To:</strong> {to}</p>
            {dijkstraTime !== null && (
              <p>🧭 Dijkstra Time: {dijkstraTime} min {algorithm === "dijkstra" && "(active)"}</p>
            )}
            {fwTime !== null && (
              <p>🧠 Floyd-Warshall: {fwTime} min {algorithm === "floyd" && "(active)"}</p>
            )}
          </div>

          {algorithm === "dijkstra" && routeResult && (
            <>
              <div className="full-path">
                <h3>🗺 Path Breakdown</h3>
                <p>{routeResult.route.join(" ➔ ")}</p>
              </div>

              <div className="map-section">
                <MapContainer center={[30.3255, 78.0414]} zoom={13} scrollWheelZoom={true} style={{ width: "100%", height: "100%" }}>
                  <TileLayer
                    attribution='&copy; OpenStreetMap contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {routeResult.route.map((name, idx) => {
                    const match = stations.find((s) => s.name === name);
                    return match && (
                      <Marker key={idx} position={[match.lat, match.lon]}>
                        <Popup>{match.name}</Popup>
                      </Marker>
                    );
                  })}
                  <Polyline
                    positions={routeResult.route
                      .map(name => stations.find(s => s.name === name))
                      .filter(Boolean)
                      .map(s => [s.lat, s.lon])}
                    color="blue"
                  />
                </MapContainer>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default MainPage;
