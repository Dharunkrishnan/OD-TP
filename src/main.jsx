// src/main.jsx
// Starts the React app. Router and AuthProvider are inside App.jsx – do not add them here.
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(<App />);