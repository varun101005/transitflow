import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Popup
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

const App = () => {
  const [stationList, setStationList] = useState([]); 
  const [startStation, setStartStation] = useState("");
  const [endStation, setEndStation] = useState("");
  const [chosenAlgo, setChosenAlgo] = useState("dijkstra"); 
  const [routeData, setRouteData] = useState(null);
  const [fwDuration, setFwDuration] = useState(null);
  const [dijkstraDuration, setDijkstraDuration] = useState(null);
  const [msgError, setMsgError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  
  useEffect(() => {
    axios.get("http://127.0.0.1:5000/stations")
      .then(response => {
        setStationList(response.data);
      })
      .catch((err) => {
        console.error("Station fetch failed:", err);  
        setMsgError("Oops! Couldn’t load stations.");
      });
  }, []);

  const stationNames = stationList.map((item) => item.name);

  const fetchRoute = () => {
    setMsgError("");
    setRouteData(null); 
    setFwDuration(null);
    setDijkstraDuration(null);

    if (!startStation || !endStation) {
      setMsgError("Missing FROM or TO station.");
      return;
    }

    setIsLoading(true); 

    axios.get("http://127.0.0.1:5000/fw_time", {
      params: { from: startStation, to: endStation }
    }).then((res) => {
      setFwDuration(res.data.estimated_time_minutes); 
    });

    axios.get("http://127.0.0.1:5000/route", {
      params: {
        lat: 0, 
        lon: 0,
        from: startStation,
        to: endStation
      }
    }).then((res) => {
      setDijkstraDuration(res.data.estimated_time_minutes);
      if (chosenAlgo === "dijkstra") {
        setRouteData(res.data);
      }
      setIsLoading(false);
    }).catch(() => {
      setMsgError("Could not fetch route details.");
      setIsLoading(false);
    });
  };

  const swapStations = () => {
    const prevFrom = startStation;
    setStartStation(endStation);
    setEndStation(prevFrom);
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "900px", margin: "auto" }}>
      <h1>🚌TransitFlow - Find Best Route</h1>

      <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "1rem" }}>
        <div style={{ flex: 1 }}>
          <label><strong>Start 📍:</strong></label>
          <select
            value={startStation}
            onChange={(e) => setStartStation(e.target.value)}
            style={{ width: "100%", marginTop: "0.5rem" }}
          >
            <option value="">-- Choose Station --</option>
            {stationNames.map((st) => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>
        </div>

        <button
          onClick={swapStations}
          style={{
            height: "2.5rem",
            width: "2.5rem",
            borderRadius: "10%",
            marginTop: "1.5rem",
            backgroundColor: "#blue",
            border: "1px solid #ccc",
            cursor: "pointer"
          }}
          title="Swap directions"
        >
          ⇄
        </button>

        <div style={{ flex: 1 }}>
          <label><strong>End 🎯:</strong></label>
          <select
            value={endStation}
            onChange={(e) => setEndStation(e.target.value)}
            style={{ width: "100%", marginTop: "0.5rem" }}
          >
            <option value="">-- Choose Destination --</option>
            {stationNames.map((st) => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <label><strong>Choose Algorithm ⚙️:</strong></label>
        <select
          value={chosenAlgo}
          onChange={(e) => setChosenAlgo(e.target.value)}
          style={{ marginLeft: "1rem" }}
        >
          <option value="dijkstra">Dijkstra - Route + ETA</option>
          <option value="floyd">Floyd-Warshall - ETA Only</option>
        </select>
      </div>

      <button onClick={fetchRoute} disabled={isLoading}>
        {isLoading ? "Calculating..." : "Show Route"}
      </button>

      {msgError && <div style={{ color: "red", marginTop: "1rem" }}>{msgError}</div>}

      {(routeData || fwDuration || dijkstraDuration) && (
        <div style={{ marginTop: "2rem", background: "#f2f2f2", padding: "1rem", borderRadius: "8px" }}>
          <h3>🚦 Route Info</h3>
          <p><strong>From:</strong> {startStation}</p>
          <p><strong>To:</strong> {endStation}</p>
          {dijkstraDuration !== null && (
            <p>🧭 Dijkstra: {dijkstraDuration} min {chosenAlgo === "dijkstra" && "(Selected)"}</p>
          )}
          {fwDuration !== null && (
            <p>🧠 Floyd-Warshall: {fwDuration} min {chosenAlgo === "floyd" && "(Selected)"}</p>
          )}
        </div>
      )}

      {chosenAlgo === "dijkstra" && routeData && (
        <>
          <div style={{ marginTop: "1rem", background: "#f9f9f9", padding: "1rem", borderRadius: "8px" }}>
            <h3>🗺 Full Path</h3>
            <p>{routeData.route.join(" → ")}</p>
          </div>

          <div style={{ height: "400px", marginTop: "1rem" }}>
            <MapContainer
              center={[30.3255, 78.0414]}
              zoom={13}
              scrollWheelZoom={true}
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {routeData.route.map((stationName, index) => {
                const station = stationList.find((s) => s.name === stationName);
                return (
                  station && (
                    <Marker key={index} position={[station.lat, station.lon]}>
                      <Popup>{station.name}</Popup>
                    </Marker>
                  )
                );
              })}

              <Polyline
                positions={routeData.route
                  .map((name) => stationList.find((s) => s.name === name))
                  .filter(Boolean)
                  .map((s) => [s.lat, s.lon])}
                color="blue"
              />
            </MapContainer>
          </div>
        </>
      )}
    </div>
  );
};

export default App;
