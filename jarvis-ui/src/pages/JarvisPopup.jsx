import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { JarvisCodeBlock } from "../components/JarvisCodeBlock.jsx";

function JarvisPopup({ id, content, onClose, onMinimize, minimized }) {
  const popupRef = useRef(null);

  const [pos, setPos] = useState({
    x: 120 + Math.random() * 80,
    y: 80 + Math.random() * 60,
  });

  const [dragging, setDragging] = useState(false);
  const [zIndex, setZIndex] = useState(1000);

  const offsetRef = useRef({ x: 0, y: 0 });

  // ===== START DRAG =====
  const startDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const rect = popupRef.current.getBoundingClientRect();

    offsetRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    setDragging(true);
    setZIndex(Date.now()); // 🔥 bring to front
  };

  // ===== MOVE + STOP =====
  useEffect(() => {
    const move = (e) => {
      if (!dragging) return;

      setPos({
        x: e.clientX - offsetRef.current.x,
        y: e.clientY - offsetRef.current.y,
      });
    };

    const up = () => setDragging(false);

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);

    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [dragging]);

  return (
    <div
      ref={popupRef}
      className="jarvis-popup"
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        zIndex,
        userSelect: "none",
        display: minimized ? "none" : "block", // ✅ MINIMIZE
      }}
    >
      {/* HEADER = DRAG HANDLE */}
      <div
        className="jarvis-popup-header"
        onMouseDown={startDrag}
        style={{ cursor: "grab", display: "flex", justifyContent: "space-between" }}
      >
        <span>JARVIS RESPONSE</span>

        <div className="window-controls">
          {/* ➖ MINIMIZE */}
          <button
            onClick={() => onMinimize(id)}
            style={{ marginRight: "6px" }}
          >
            —
          </button>

          {/* ❌ CLOSE */}
          <button onClick={() => onClose(id)}>✕</button>
        </div>
      </div>

      <div className="jarvis-popup-content">
        <ReactMarkdown
          components={{
            pre({ children }) {
              return <>{children}</>;
            },
            code({ inline, children }) {
              if (inline) return <code>{children}</code>;
              return (
                <JarvisCodeBlock>
                  {String(children).trim()}
                </JarvisCodeBlock>
              );
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}

export default JarvisPopup;
