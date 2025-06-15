from flask import Flask, request, jsonify
from flask_cors import CORS
import networkx as nx
import json
from geopy.distance import geodesic

app = Flask(__name__)
CORS(app)  

with open('stations.json') as f:
    stations = json.load(f)

G = nx.Graph()

for s in stations:
    G.add_node(s['name'], pos=(s['lat'], s['lon'])) 

custom_links = [
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

for src, dest in custom_links:
    n1 = next((s for s in stations if s["name"] == src), None)
    n2 = next((s for s in stations if s["name"] == dest), None)

    if not n1 or not n2:
        print(f"⚠️  Skipping edge {src} → {dest} (missing station data)")
        continue

    d = geodesic((n1['lat'], n1['lon']), (n2['lat'], n2['lon'])).meters
    G.add_edge(src, dest, weight=d / 100) 

for s1 in stations:
    dists = []
    for s2 in stations:
        if s1['name'] == s2['name']:
            continue
        dist = geodesic((s1['lat'], s1['lon']), (s2['lat'], s2['lon'])).meters
        dists.append((dist, s2['name']))
    dists.sort()
    for d, near in dists[:2]:  
        if not G.has_edge(s1['name'], near):
            G.add_edge(s1['name'], near, weight=d / 100)

fw_matrix = dict(nx.floyd_warshall(G, weight='weight'))

def get_nearest_station(lat, lon):
    nearest = None
    shortest = float('inf')
    for s in stations:
        dist = geodesic((lat, lon), (s['lat'], s['lon'])).meters
        if dist < shortest:
            shortest = dist
            nearest = s['name']
    return nearest

@app.route('/')
def home():
    return "🚍 TransitFlow Backend is Running!" 
@app.route('/stations', methods=['GET'])
def stations_list():
    return jsonify(stations)

@app.route('/route', methods=['GET'])
def compute_route():
    try:
        lat = float(request.args.get('lat', 0))
        lon = float(request.args.get('lon', 0))
        destination = request.args.get('to')
        origin = request.args.get('from')

        if not destination:
            return jsonify({"error": "Missing destination"}), 400

        if destination not in G.nodes:
            return jsonify({"error": "Unknown destination"}), 400

        if not origin or origin == "auto" or origin not in G.nodes:
            origin = get_nearest_station(lat, lon)

        if origin not in G.nodes:
            return jsonify({"error": "Invalid starting point"}), 400

        path = nx.dijkstra_path(G, origin, destination, weight='weight')
        duration = nx.dijkstra_path_length(G, origin, destination, weight='weight')

        return jsonify({
            "from": origin,
            "to": destination,
            "route": path,
            "estimated_time_minutes": round(duration, 2)
        })

    except Exception as err:
        return jsonify({"error": str(err)}), 500

@app.route('/fw_time', methods=['GET'])
def floyd_time():
    start = request.args.get('from')
    end = request.args.get('to')

    if not start or not end:
        return jsonify({"error": "Missing from/to"}), 400

    if start not in fw_matrix or end not in fw_matrix[start]:
        return jsonify({"error": "Invalid station pair"}), 400

    eta = fw_matrix[start][end]

    return jsonify({
        "from": start,
        "to": end,
        "estimated_time_minutes": round(eta, 2),
        "algorithm": "Floyd-Warshall"
    })
    
if __name__ == '__main__':
    app.run(debug=True)
