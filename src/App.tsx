import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Optimizer from "./pages/Optimizer";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/rsi_optimizer/:symbol" element={<Optimizer />} />
      </Routes>
    </Router>
  );
}
