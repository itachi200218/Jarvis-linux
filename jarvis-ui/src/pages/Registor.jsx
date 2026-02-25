import { useEffect, useRef, useState } from "react";
import "./Login.css";
import { registerUser } from "../api/authApi";

export default function Register() {
  const eyesRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmPasswordRef = useRef(null);

  const [focus, setFocus] = useState("none");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState("Awaiting registration data");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

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
        eye.style.transition = "transform 0.08s linear";
      });
    };

    window.addEventListener("mousemove", moveEyes);
    return () => window.removeEventListener("mousemove", moveEyes);
  }, []);

  // 🔴 Live password match check
  useEffect(() => {
    if (!password || !confirmPassword) {
      setError("");
      setStatus("Awaiting registration data");
      return;
    }

    if (password !== confirmPassword) {
      setError("Access keys do not match");
      setStatus("Mismatch detected");
    } else {
      setError("");
      setStatus("Access keys verified");
    }
  }, [password, confirmPassword]);

  // 🔐 REGISTER HANDLER
  const handleRegister = async () => {
    try {
      if (password !== confirmPassword) {
        setError("Access keys do not match");
        setStatus("Password mismatch detected");
        return;
      }

      setStatus("Registering user...");

      await registerUser({
        name,
        email,
        password,
        confirm_password: confirmPassword,
      });

      setStatus("Registration successful ✔");
      alert("Registration successful. Please login.");

      setName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.error(err);
      setStatus("Registration failed ❌");
      setError(err.message);
    }
  };

  return (
    <div className="page">
      <div className="card holo">

        <div
          className={`character ${
            focus === "password" && !showPassword ? "cover" : ""
          } ${error ? "alert" : ""}`}
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
          <p className="subtitle">User Registration Protocol</p>

          <input
            type="text"
            placeholder="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onFocus={() => setStatus("Capturing identity...")}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                emailRef.current?.focus();
              }
            }}
          />

          <input
            ref={emailRef}
            type="email"
            placeholder="Authorized Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={() => setStatus("Validating email...")}
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
              placeholder="Create Access Key"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setFocus("password")}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  confirmPasswordRef.current?.focus();
                }
              }}
            />
            <span onClick={() => setShowPassword(!showPassword)}>
              {showPassword ? "🙈" : "👁️"}
            </span>
          </div>

          <div className="password-box">
            <input
              ref={confirmPasswordRef}
              type={showPassword ? "text" : "password"}
              placeholder="Confirm Access Key"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onFocus={() => setFocus("password")}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (!error && password && confirmPassword) {
                    handleRegister();
                  }
                }
              }}
            />
            <span onClick={() => setShowPassword(!showPassword)}>
              {showPassword ? "🙈" : "👁️"}
            </span>
          </div>

          {error && (
            <p style={{ color: "#ff4d4d", fontSize: "12px" }}>
              ⚠ {error}
            </p>
          )}

          <button
            onClick={handleRegister}
            disabled={!!error || !password || !confirmPassword}
            style={{
              opacity: error ? 0.5 : 1,
              cursor: error ? "not-allowed" : "pointer",
            }}
          >
            INITIATE REGISTRATION
          </button>

        </div>

      </div>
    </div>
  );
}
