import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { JarvisCodeBlock } from "../components/JarvisCodeBlock.jsx";

function JarvisPopup({
  id,
  messages = [],
  minimized,
  onClose,
  onMinimize,
  onSendMessage,
}) {
  const popupRef = useRef(null);
  const scrollRef = useRef(null);

  const [pos, setPos] = useState({
    x: 120 + Math.random() * 80,
    y: 80 + Math.random() * 60,
  });

  const [dragging, setDragging] = useState(false);
  const [zIndex, setZIndex] = useState(1000);
  const [input, setInput] = useState("");

  const offsetRef = useRef({ x: 0, y: 0 });

  /* ================= DRAG WINDOW ================= */
  const startDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const rect = popupRef.current.getBoundingClientRect();
    offsetRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    setDragging(true);
    setZIndex(Date.now());
  };

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

  /* ================= AUTO SCROLL ================= */
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop =
        scrollRef.current.scrollHeight;
    }
  }, [messages]);

  /* ================= SEND MESSAGE ================= */
  const handleSend = () => {
    if (!input.trim()) return;
    onSendMessage(id, input.trim());
    setInput("");
  };

  return (
    <div
      ref={popupRef}
      className="jarvis-popup"
      style={{
        left: pos.x,
        top: pos.y,
        zIndex,
        display: minimized ? "none" : "flex",
      }}
    >
      {/* ================= HEADER ================= */}
      <div
        className="jarvis-popup-header"
        onMouseDown={startDrag}
        style={{ cursor: "grab" }}
      >
        <span>JARVIS RESPONSE</span>

        <div className="window-controls">
          <button onClick={() => onMinimize(id)}>—</button>
          <button onClick={() => onClose(id)}>✕</button>
        </div>
      </div>

      {/* ================= CONTENT (SCROLL FIX) ================= */}
      <div className="jarvis-popup-content">
        <div className="jarvis-popup-scroll" ref={scrollRef}>
          {messages.map((msg, index) => (
            <div key={index} className={`msg ${msg.role}`}>
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
                {msg.text}
              </ReactMarkdown>
            </div>
          ))}
        </div>
      </div>

      {/* ================= INPUT ================= */}
      <div className="jarvis-popup-input">
        <input
          type="text"
          placeholder="Type here…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <button onClick={handleSend}>SEND</button>
      </div>
    </div>
  );
}

export default JarvisPopup;
