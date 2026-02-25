import { useEffect, useRef, useState } from "react";
import "./Login.css";
import { loginUser, registerUser } from "../api/authApi";
import { useNavigate } from "react-router-dom";
import { useJarvisNotify } from "../context/JarvisNotifyContext";
import { playHoverSound } from "../utils/soundManager";
export default function Login() {
  const eyesRef = useRef(null);
  const passwordRef = useRef(null);        // ✅ added
  const confirmPasswordRef = useRef(null); // ✅ added
  const navigate = useNavigate();
  const { notify } = useJarvisNotify();

  const [focus, setFocus] = useState("none");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState("Awaiting credentials");
  const [mode, setMode] = useState("login");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mismatch, setMismatch] = useState(false);
const cardRef = useRef(null);

  // 👀 Eyes follow mouse
  useEffect(() => {
    const moveEyes = (e) => {
      if (!eyesRef.current) return;

      const eyes = eyesRef.current.querySelectorAll(".eye");
      eyes.forEach((eye) => {
        const rect = eye.getBoundingClientRect();
        const eyeX = rect.left + rect.width / 2;
        const eyeY = rect.top + rect.height / 2;

        const angle = Math.atan2(e.clientY - eyeY, e.clientX - eyeX);
        const moveX = Math.cos(angle) * 6;
        const moveY = Math.sin(angle) * 6;

        eye.style.transform = `translate(${moveX}px, ${moveY}px)`;
      });
    };

    window.addEventListener("mousemove", moveEyes);
    return () => window.removeEventListener("mousemove", moveEyes);
  }, []);

  // 🔴 Password mismatch detection
  useEffect(() => {
    if (mode !== "register") {
      setMismatch(false);
      return;
    }

    if (!password || !confirmPassword) {
      setMismatch(false);
      setStatus("Awaiting registration data");
      return;
    }

    if (password !== confirmPassword) {
      setMismatch(true);
      setStatus("Mismatch detected");
    } else {
      setMismatch(false);
      setStatus("Access keys verified");
    }
  }, [password, confirmPassword, mode]);

  // 🔐 AUTH HANDLER
  const handleAuth = async () => {
    try {
      if (mode === "login") {
        setStatus("Authenticating...");

        const res = await loginUser({ email, password });

        sessionStorage.setItem("jarvis_token", res.access_token);

        setStatus("Authentication successful ✔");

        notify({
          type: "success",
          message: "Authentication successful. Welcome back."
        });

        setTimeout(() => {
          navigate("/");
        }, 700);

      } else {
        setStatus("Registering user...");

        await registerUser({
          name,
          email,
          password,
          confirm_password: confirmPassword,
        });

        setStatus("Registration successful ✔");

        notify({
          type: "success",
          message: "Registration complete. Identity stored securely."
        });

        setMode("login");
      }
    } catch (err) {
      console.error(err);
      setStatus("Access denied ❌");

      notify({
        type: "error",
        message: err.message || "Authentication failed"
      });
    }
  };

  useEffect(() => {
    const handleUnload = () => {
      const token = sessionStorage.getItem("jarvis_token");
      if (!token) return;

      navigator.sendBeacon(
        "http://127.0.0.1:8000/auth/offline",
        new Blob([], {
          type: "application/json",
        })
      );
    };

    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, []);

  return (
    <div className="page">
      <div className="card holo">

        <div
          className={`character
            ${focus === "password" && !showPassword ? "cover" : ""}
            ${mismatch ? "alert" : ""}
          `}
        >
          <div className="robot-head" ref={eyesRef}>
            <div className="visor">
              <div className="eye"><span className="pupil" /></div>
              <div className="eye"><span className="pupil" /></div>
            </div>
            <div className="mouth">
              <span></span><span></span><span></span><span></span>
            </div>
          </div>
          <div className="ai-status">{status}</div>
        </div>

        <div className="form">
          <h2>J.A.R.V.I.S</h2>
          <p className="subtitle">Secure Access Interface</p>

          <div className="robot-home-btn"    onMouseEnter={playHoverSound}  
          onClick={() => navigate("/")}>
            <span className="home-dot"></span>
            RETURN TO HOME
          </div>

          <div
            className={`robot-toggle ${mode}`}
       onMouseEnter={playHoverSound}  
            onClick={() => {
              const next = mode === "login" ? "register" : "login";
              setMode(next);
              setName("");
              setEmail("");
              setPassword("");
              setConfirmPassword("");
              setMismatch(false);
              setStatus(
                next === "login"
                  ? "Authentication protocol activated"
                  : "Registration protocol activated"
              );
            }}
          >
            <span className="dot"></span>
            AUTH MODE: {mode.toUpperCase()}
          </div>

          {mode === "register" && (
            <input
              type="text"
              placeholder="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                }
              }}
            />
          )}

          <input
            type="email"
            placeholder="Authorized Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                passwordRef.current?.focus();
              }
            }}
          />

          <div className="password-box">
            <input
              ref={passwordRef}
              type={showPassword ? "text" : "password"}
              placeholder={mode === "login" ? "Access Key" : "Create Access Key"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setFocus("password")}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (mode === "register") {
                    confirmPasswordRef.current?.focus();
                  } else {
                    handleAuth();
                  }
                }
              }}
            />
            <span onClick={() => setShowPassword(!showPassword)}>
              {showPassword ? "🙈" : "👁️"}
            </span>
          </div>

          {mode === "register" && (
            <div className="password-box">
              <input
                ref={confirmPasswordRef}
                type="password"
                placeholder="Confirm Access Key"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (!mismatch) handleAuth();
                  }
                }}
              />
            </div>
          )}

          <button
            disabled={mode === "register" && mismatch}
               onMouseEnter={playHoverSound}  
            onClick={handleAuth}
          >
            {mode === "login" ? "INITIATE LOGIN" : "INITIATE REGISTRATION"}
          </button>
        </div>
      </div>
    </div>
  );
}
