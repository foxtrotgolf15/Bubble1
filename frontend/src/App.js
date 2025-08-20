import React from "react";
import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import USNavyDiveCalculator from "./components/USNavyDiveCalculator";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<USNavyDiveCalculator />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;