import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import MainPage from "./MainPage";
import AddStopPage from "./AddStopPage";
import "./index.css";

const App = () => {
  // State for managing light/dark theme
  const [theme, setTheme] = useState("light");

  // Update theme in document body on change
  useEffect(() => {
    document.body.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === "light" ? "dark" : "light"));
  };

  return (
    <Router>
      <div className="container">
        {/* Header section with title and theme toggle */}
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1>🚍 TransitFlow - Public Transport Optimizer</h1>
          <button onClick={toggleTheme} className="theme-toggle">
            {theme === "light" ? "🌙 Dark Mode" : "☀️ Light Mode"}
          </button>
        </header>

        {/* Navigation menu */}
        <nav style={{ textAlign: "center", marginBottom: "20px" }}>
          <Link 
            to="/" 
            style={{ marginRight: "20px", fontWeight: "bold", textDecoration: "none", color: "#3b82f6", fontSize: "18px" }}>
            🏠 Home
          </Link>

          <Link 
            to="/add-stop" 
            style={{ fontWeight: "bold", textDecoration: "none", color: "#3b82f6", fontSize: "18px" }}>
            ➕ Add Stop
          </Link>
        </nav>

        {/* Route configuration */}
        <Routes>
          <Route path="/" element={<MainPage />} />
          <Route path="/add-stop" element={<AddStopPage />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
