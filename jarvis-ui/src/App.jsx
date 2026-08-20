import { Routes, Route } from "react-router-dom";
import { useEffect } from "react";

import usePresence from "./hooks/usePresence";

import JarvisApp from "./pages/JarvisApp";
import Login from "./pages/Login";
import Profile from "./pages/profile";
import ChatPage from "./pages/ChatPage";
import ChatDetail from "./pages/ChatDetail";
import WorkspacesPage from "./components/WorkspacesPage";
import Support from "./components/Support";
import ResetPassword from "./pages/ResetPassword";
import WallpaperPicker from "./components/WallpaperPicker";
import CallPage from "./pages/CallPage";

import { playNotificationSound } from "./utils/soundManager";
import { CallProvider } from "./context/CallContext";
import { JarvisNotifyProvider } from "./context/JarvisNotifyContext";
import { unlockAudioOnFirstInteraction } from "./utils/soundManager";

// import {
//   connectNotificationSocket,
//   disconnectNotificationSocket
// } from "./ws/notificationsSocket";


function App() {

  useEffect(() => {

    unlockAudioOnFirstInteraction();

  }, []);


  usePresence();


  // ==============================
  // OLD NOTIFICATION SOCKET
  // ==============================

  // useEffect(() => {

  //   const token = sessionStorage.getItem("jarvis_token");

  //   if (!token) return;

  //   connectNotificationSocket(token, (notification) => {

  //     window.dispatchEvent(
  //       new CustomEvent("NEW_NOTIFICATION", {
  //         detail: notification
  //       })
  //     );

  //   });

  //   return () => disconnectNotificationSocket();

  // }, []);


  return (

    <JarvisNotifyProvider>

      <CallProvider>

        <Routes>

          {/* ==============================
              MAIN APPLICATION
          ============================== */}

          <Route
            path="/"
            element={<JarvisApp />}
          />


          {/* ==============================
              AUTH
          ============================== */}

          <Route
            path="/auth"
            element={<Login />}
          />

          <Route
            path="/login"
            element={<Login />}
          />

          <Route
            path="/reset-password"
            element={<ResetPassword />}
          />


          {/* ==============================
              PROFILE
          ============================== */}

          <Route
            path="/profile"
            element={<Profile />}
          />

          <Route
            path="/profile/:email"
            element={<Profile />}
          />


          {/* ==============================
              CHAT
          ============================== */}

          <Route
            path="/chat"
            element={<ChatPage />}
          />

          <Route
            path="/chat/:chatId"
            element={<ChatDetail />}
          />


          {/* ==============================
              WORKSPACES
          ============================== */}

          <Route
            path="/workspaces"
            element={<WorkspacesPage />}
          />

          <Route
            path="/workspaces/:workspaceId"
            element={<WorkspacesPage />}
          />

          <Route
            path="/workspaces/:workspaceId/wallpaper"
            element={<WallpaperPicker />}
          />


          {/* ==============================
              SUPPORT
          ============================== */}

          <Route
            path="/support"
            element={<Support />}
          />

          <Route
            path="/support/:ticketId"
            element={<Support />}
          />


          {/* ==============================
              1-TO-1 CALL
          ============================== */}

          <Route
            path="/call/:userId"
            element={<CallPage />}
          />


          {/* ==============================
              GROUP CALL
          ============================== */}

          <Route
            path="/call/group/:callId"
            element={<CallPage />}
          />

        </Routes>

      </CallProvider>

    </JarvisNotifyProvider>

  );

}


export default App;