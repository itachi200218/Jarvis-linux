import { useNavigate, useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import API from "../api/api";
import "../styles/wallpaper-picker.css";
// import { playHoverSound } from "../utils/soundManager";
import { playNotificationSound } from "../utils/soundManager";
export default function WallpaperPicker() {

  const navigate = useNavigate();
  const { workspaceId } = useParams();

  const [selected, setSelected] = useState(null);
  const [customWallpapers, setCustomWallpapers] = useState([]);

  const wallpapers = [
    "wap1.jpg","wap2.jpg","wap3.jpg","wap4.jpg",
    "wap5.jpg","wap6.jpg","wap7.jpg",
    "wap8.jpeg","wap9.jpeg","wap10.jpeg",
    "wap11.jpeg","wap12.jpeg","wap13.jpeg",
    "wap14.jpeg","wap15.jpeg","wap16.jpeg"
  ];

  // ============================
  // LOAD ALL CUSTOM WALLPAPERS
  // ============================
  useEffect(() => {
    if (workspaceId) {
      loadCustomWallpapers();
    }
  }, [workspaceId]);

  const loadCustomWallpapers = async () => {
    try {
      const res = await API.get(
        `/workspace/${workspaceId}/wallpaper/custom`
      );
      setCustomWallpapers(res.data);
    } catch (err) {
      console.error("Failed to load custom wallpapers", err);
    }
  };

  // ============================
  // GO BACK
  // ============================
  const goBack = () => {
    navigate("/workspaces", {
      state: { workspaceId }
    });
  };

  // ============================
  // APPLY WALLPAPER
  // ============================
  const selectWallpaper = async (wp) => {
    try {
      setSelected(wp);

      await API.put(
        `/workspace/${workspaceId}/wallpaper`,
        null,
        {
          params: { wallpaper: wp }
        }
      );

      navigate("/workspaces", {
        state: { workspaceId }
      });

    } catch (err) {
      console.error("Wallpaper update failed", err);
    }
  };

  // ============================
  // UPLOAD CUSTOM WALLPAPER
  // ============================
  const handleCustomWallpaper = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append("file", file);

      await API.post(
        `/workspace/${workspaceId}/wallpaper/upload`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data"
          }
        }
      );

      await loadCustomWallpapers();

      navigate("/workspaces", {
        state: { workspaceId }
      });

    } catch (err) {
      console.error("Custom wallpaper upload failed", err);
    }
  };

  return (

    <div className="wallpaper-page">

      {/* HEADER */}
      <div className="wallpaper-header">

        <button
          className="jarvis-btn jarvis-back-btn"
           onMouseEnter={playNotificationSound}
          onClick={goBack}
        >
          ← BACK
        </button>

        <div className="wallpaper-title">
          Jarvis Wallpaper Control
        </div>

      </div>

      {/* CUSTOM UPLOAD BUTTON */}
      <div style={{ marginBottom: "20px" }}>

        <input
          type="file"
          accept="image/*"
          id="customWallpaperInput"
          style={{ display: "none" }}
          onChange={handleCustomWallpaper}
        />

        <button
          className="jarvis-btn jarvis-upload-btn"
          onMouseEnter={playNotificationSound}
          onClick={() =>
            document.getElementById("customWallpaperInput").click()
          }
        >
          + CUSTOM WALLPAPER
        </button>

      </div>

      {/* PRESET WALLPAPERS */}
      <div className="wallpaper-section-title">
        Preset Wallpapers
      </div>

      <div className="wallpaper-grid">

        {wallpapers.map((wp) => (

          <div
            key={wp}
            className={`wallpaper-item ${
              selected === wp ? "selected" : ""
            }`}
             onMouseEnter={playNotificationSound}
            onClick={() => selectWallpaper(wp)}
          >

            {/* ✅ Clean preset image */}
            <img
              src={`/wallpapers/${wp}`}
              alt={wp}
            />

            <div className="wallpaper-overlay">
              Apply
            </div>

          </div>

        ))}

      </div>

      {/* CUSTOM WALLPAPERS */}
      {customWallpapers.length > 0 && (

        <>
          <div className="wallpaper-section-title">
            Custom Wallpapers
          </div>

          <div className="wallpaper-grid">

            {customWallpapers.map((wp) => (

              <div
                key={wp}
                className={`wallpaper-item ${
                  selected === wp ? "selected" : ""
                }`}
                onMouseEnter={playNotificationSound}
                onClick={() => selectWallpaper(wp)}
              >

                <img
                  src={`http://localhost:8000/wallpapers/${wp}`}
                  alt={wp}
                />

                <div className="wallpaper-overlay">
                  Custom
                </div>

              </div>

            ))}

          </div>
        </>
      )}

    </div>
  );
}