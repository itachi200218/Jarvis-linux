import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getMyProfile,
  updateProfileName,
  changePassword,
  uploadProfileAvatar,
  getUserProfile,
} from "../api/profileApi";
import { useAuth } from "../context/authcontext_temp.jsx";
import "../App.css";
import API from "../api/api";
import { useJarvisNotify } from "../context/JarvisNotifyContext";
import { playHoverSound } from "../utils/soundManager";

export default function Profile() {
  const navigate = useNavigate();
  const { email } = useParams();
  const isMyProfile = !email;

  const { user, logout, refreshUser } = useAuth();
  const { notify } = useJarvisNotify(); // ✅ ONLY ADDITION

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editMode, setEditMode] = useState(false);
  const [passwordMode, setPasswordMode] = useState(false);

  const [newName, setNewName] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [savingProfile, setSavingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const [avatarPreview, setAvatarPreview] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // =========================
  // LOAD PROFILE
  // =========================
  useEffect(() => {
    async function loadProfile() {
      try {
        const data = email
          ? await getUserProfile(decodeURIComponent(email))
          : await getMyProfile();

        setProfile(data);
        setNewName(data.name);
      } catch (err) {
        setError(err.message || "Failed to load profile");
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [email]);

  // =========================
  // UPDATE NAME
  // =========================
  const handleProfileUpdate = async () => {
    if (savingProfile) return;

    try {
      setSavingProfile(true);
      await updateProfileName(newName);
      setProfile({ ...profile, name: newName });
      setEditMode(false);

      notify({
        type: "success",
        message: "Profile identity synchronized."
      });

    } catch (err) {
      notify({
        type: "error",
        message: err.message || "Profile update failed."
      });
    } finally {
      setSavingProfile(false);
    }
  };

  // =========================
  // CHANGE PASSWORD
  // =========================
  const handlePasswordChange = async () => {
    if (changingPassword) return;

    if (!oldPassword || !newPassword) {
      notify({
        type: "error",
        message: "Password fields incomplete. Operation aborted."
      });
      return;
    }

    try {
      setChangingPassword(true);
      await changePassword(oldPassword, newPassword);

      notify({
        type: "success",
        message: "Password updated. Security integrity maintained."
      });

      setOldPassword("");
      setNewPassword("");
      setPasswordMode(false);

    } catch (err) {
      notify({
        type: "error",
        message: err.message || "Password update failed."
      });
    } finally {
      setChangingPassword(false);
    }
  };

  // =========================
  // UPLOAD AVATAR
  // =========================
  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setAvatarPreview(URL.createObjectURL(file));

    try {
      setUploadingAvatar(true);
      await uploadProfileAvatar(file);
      await refreshUser();
      const updated = await getMyProfile();
      setProfile(updated);

      notify({
        type: "success",
        message: "Avatar updated. Visual identity refreshed."
      });

    } catch (err) {
      notify({
        type: "error",
        message: err.message || "Avatar upload failed."
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  if (loading) return <div className="status">🔄 Loading profile…</div>;

  if (error) {
    return (
      <div className="status error">
        🔒 {error}
        <br />
        <button onClick={() => navigate("/")}>Return to Jarvis</button>
      </div>
    );
  }

  return (
    <div className="hud profile-hud">
      <div className="hud-frame profile-frame">

        <div className="hud-header">
          <div className="hud-title">USER PROFILE</div>
          <div className="hud-subtitle">Identity & Security Module</div>
        </div>

        <div className="profile-card">
          <div className="profile-avatar-section">
            <img
              src={avatarPreview || profile.avatar || "/default-avatar.png"}
              alt="Profile"
              className="profile-avatar"
            />

           {isMyProfile && (
  <label
    className="avatar-upload-btn"
    onMouseEnter={playHoverSound}   // ✅ ADD THIS
  >
    {uploadingAvatar ? "UPLOADING..." : "CHANGE PHOTO"}

    <input
      type="file"
      accept="image/png, image/jpeg"
      hidden
      onChange={handleAvatarUpload}
    />

  </label>

            )}
          </div>

          <p><strong>Name:</strong> {profile.name}</p>
          <p><strong>Email:</strong> {profile.email}</p>

          <p>
            <strong>Role:</strong>{" "}
            {isMyProfile && user ? user.role.toUpperCase() : "USER"}
          </p>

          <p>
            <strong>Secure Mode:</strong>{" "}
            {profile.secure_mode ? "ENABLED 🔐" : "DISABLED"}
          </p>
        </div>

        {isMyProfile && (
          <div className="profile-actions">
            <button
  onMouseEnter={playHoverSound}
  onClick={() => setEditMode(true)}
>
  EDIT PROFILE
</button>
            <button
  onMouseEnter={playHoverSound}
  onClick={() => setPasswordMode(true)}
>
  CHANGE PASSWORD
</button>

           <button
  className="danger"
  onMouseEnter={playHoverSound}
  onClick={async () => {
    try {
      await API.post("/auth/offline", {
        email: profile.email,
      });
    } catch (e) {}

    logout();
    navigate("/");
  }}
>
  LOGOUT
</button>
          </div>
        )}

        {editMode && (
          <div className="profile-modal">
            <h3>Edit Name</h3>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <button
  onMouseEnter={playHoverSound}
  onClick={handleProfileUpdate}
>
  {savingProfile ? "SAVING..." : "SAVE"}
</button>
            <button
  onMouseEnter={playHoverSound}
  onClick={() => setEditMode(false)}
>
  CANCEL
</button>
          </div>
        )}

        {passwordMode && (
          <div className="profile-modal">
            <h3>Change Password</h3>
            <input
              type="password"
              placeholder="Current password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
            />
            <input
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <button
  onMouseEnter={playHoverSound}
  onClick={handlePasswordChange}
>
  {changingPassword ? "UPDATING..." : "UPDATE"}
</button>
            <button  onMouseEnter={playHoverSound} 
            onClick={() => setPasswordMode(false)}>CANCEL</button>
          </div>
        )}

        <div className="profile-footer">
 <button
  onMouseEnter={playHoverSound}
  onClick={() => navigate("/")}
>
  ⬅ RETURN TO JARVIS
</button>
        </div>

      </div>
    </div>
  );
}
