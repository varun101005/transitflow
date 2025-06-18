from flask import Flask, request, jsonify
from flask_cors import CORS
import networkx as nx
import json
from geopy.distance import geodesic

# Starting the Flask app
app = Flask(__name__)
CORS(app)  # Allow cross-origin stuff for frontend

STATION_FILE = 'stations.json'

# === File I/O Stuff ===
def load_station_data():
    # Yeah, just slurping up the whole JSON file
    with open(STATION_FILE, 'r') as file:
        return json.load(file)

def persist_stations(data):
    with open(STATION_FILE, 'w') as out:
        json.dump(data, out, indent=4)

# === Load and Prep ===
stations = load_station_data()
G = nx.Graph()

# Toss all the nodes in
for station in stations:
    G.add_node(station['name'], pos=(station['lat'], station['lon']))  # storing lat/lon as node attributes

# === Hardwired Edges (semi-manual) ===
preset_routes = [
    ("Graphic Era Deemed", "Graphic Era Hill"),
    ("Graphic Era Deemed", "Max Hospital"),
    ("Max Hospital", "Pacific Mall"),
    ("Pacific Mall", "Clock Tower"),
    ("Clock Tower", "Karanpur"),
    ("Karanpur", "Garhi Cantt"),
    ("Garhi Cantt", "Khalanga"),
    ("Khalanga", "Raipur"),
    ("Graphic Era Deemed", "Jogiwala"),
    ("Jogiwala", "Raipur"),
    ("ISBT", "Majra"),
    ("Majra", "Subhash Nagar"),
    ("Subhash Nagar", "Clock Tower"),
    ("FRI Dehradun", "ISBT"),
    ("FRI Dehradun", "Prem Nagar"),
    ("Prem Nagar", "Sudhowala"),
    ("Sudhowala", "Banjarawala"),
    ("Banjarawala", "ISBT"),
    ("Clock Tower", "Mussoorie")
]

# Hook up manual edges
for a, b in preset_routes:
    s_a = next((s for s in stations if s['name'] == a), None)
    s_b = next((s for s in stations if s['name'] == b), None)

    if not s_a or not s_b:
        print(f"⚠️ Skipping: {a} -> {b} (station data missing)")
        continue

    distance_m = geodesic((s_a['lat'], s_a['lon']), (s_b['lat'], s_b['lon'])).meters
    G.add_edge(a, b, weight=distance_m / 100)  # just a heuristic divisor

# === Auto-connect to nearest neighbors (2 per station) ===
for base in stations:
    proximity = []
    for other in stations:
        if base['name'] == other['name']:
            continue
        d = geodesic((base['lat'], base['lon']), (other['lat'], other['lon'])).meters
        proximity.append((d, other['name']))
    
    proximity.sort()
    closest = proximity[:2]  # Pick top 2
    for dist, neighbor in closest:
        if not G.has_edge(base['name'], neighbor):
            G.add_edge(base['name'], neighbor, weight=dist / 100)

# === Floyd-Warshall All-Pairs Calculation ===
floyd_result = dict(nx.floyd_warshall(G, weight='weight'))

# Helper to grab the closest station
def nearest_station(lat, lon):
    closest = None
    shortest = float('inf')
    for s in stations:
        d = geodesic((lat, lon), (s['lat'], s['lon'])).meters
        if d < shortest:
            shortest = d
            closest = s['name']
    return closest

# ==== API ROUTES ====

@app.route('/')
def index():
    return "🚍 TransitFlow Backend is Live!"

@app.route('/stations', methods=['GET'])
def list_stations():
    return jsonify(stations)

@app.route('/route', methods=['GET'])
def get_single_route():
    try:
        # Parse query params
        lat = float(request.args.get('lat', 0))
        lon = float(request.args.get('lon', 0))
        dest = request.args.get('to')
        start = request.args.get('from')

        if not dest:
            return jsonify({"error": "Missing destination"}), 400

        if dest not in G.nodes:
            return jsonify({"error": "Unknown destination"}), 400

        if not start or start == "auto" or start not in G.nodes:
            start = nearest_station(lat, lon)

        if start not in G.nodes:
            return jsonify({"error": "Invalid starting point"}), 400

        # Compute route
        travel_path = nx.dijkstra_path(G, start, dest, weight='weight')
        duration = nx.dijkstra_path_length(G, start, dest, weight='weight')

        return jsonify({
            "from": start,
            "to": dest,
            "route": travel_path,
            "estimated_time_minutes": round(duration, 2)
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/fw_time', methods=['GET'])
def time_fw():
    a = request.args.get('from')
    b = request.args.get('to')

    if not a or not b:
        return jsonify({"error": "Missing parameters"}), 400

    if a not in floyd_result or b not in floyd_result[a]:
        return jsonify({"error": "Invalid station pair"}), 400

    eta = floyd_result[a][b]
    return jsonify({
        "from": a,
        "to": b,
        "estimated_time_minutes": round(eta, 2),
        "algorithm": "Floyd-Warshall"
    })

@app.route('/add-stop', methods=['POST'])
def add_stop():
    data = request.get_json()
    name = data.get('name')
    lat = data.get('lat')
    lon = data.get('lon')

    if not name or lat is None or lon is None:
        return jsonify({"error": "Missing fields"}), 400

    new_entry = {"name": name, "lat": lat, "lon": lon}
    stations.append(new_entry)
    persist_stations(stations)
    print(f"✅ Added: {new_entry}")
    return jsonify({"status": "success"}), 200

@app.route('/add-multiple-stops', methods=['POST'])
def bulk_add_stops():
    data = request.get_json()
    stop_list = data.get('stops', [])

    for stop in stop_list:
        n, lt, ln = stop.get('name'), stop.get('lat'), stop.get('lon')
        if not n or lt is None or ln is None:
            continue  # quietly skip incomplete entries
        stations.append({"name": n, "lat": lt, "lon": ln})
        print(f"➕ Stop Added: {n}")

    persist_stations(stations)
    return jsonify({"status": "success"}), 200

@app.route('/multi-route', methods=['POST'])
def multi_leg_route():
    data = request.get_json()
    hops = data.get('stops')

    if not hops or len(hops) < 2:
        return jsonify({"error": "At least two stops required"}), 400

    full_trip = []
    total_eta = 0

    try:
        for i in range(len(hops) - 1):
            leg_path = nx.dijkstra_path(G, hops[i], hops[i+1], weight='weight')
            leg_time = nx.dijkstra_path_length(G, hops[i], hops[i+1], weight='weight')
            total_eta += leg_time
            if i > 0:
                leg_path = leg_path[1:]  # remove duplicate nodes in path
            full_trip.extend(leg_path)

        return jsonify({
            "route": full_trip,
            "estimated_time_minutes": round(total_eta, 2)
        })

    except Exception as exc:
        return jsonify({"error": str(exc)}), 500

# === Launch ===
if __name__ == '__main__':
    app.run(debug=True)
