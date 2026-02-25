import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import { AuthProvider } from "./context/authcontext_temp.jsx";
import { NotificationProvider } from "./components/NotificationContext.jsx";


ReactDOM.createRoot(document.getElementById("root")).render(
  <AuthProvider>
    <NotificationProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </NotificationProvider>
  </AuthProvider>
);
