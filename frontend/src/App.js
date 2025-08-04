import React from "react";
import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import DiveCalculator from "./components/DiveCalculator";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<DiveCalculator />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;