// utils/soundManager.js

let isSoundEnabled = true;

const playSound = (path, volume = 0.50) => {
  if (!isSoundEnabled) {
    console.log("🔇 Sound disabled");
    return;
  }

  console.log("🔔 Attempting to play:", path);

  try {
    const audio = new Audio(path);
    audio.volume = volume;

    audio.play()
      .then(() => console.log("✅ Sound played"))
      .catch((err) => console.log("❌ Sound blocked:", err));

  } catch (err) {
    console.log("Audio error:", err);
  }
};

export const unlockAudioOnFirstInteraction = () => {
  const unlock = () => {
    const audio = new Audio("/sounds/notificationarrive.mp3");
    audio.volume = 0;

    audio.play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
      })
      .catch((err) => {
        console.log("Audio unlock failed:", err);
      });
  };

  document.addEventListener("click", unlock, { once: true });
};
// ===============================
// SOUND TOGGLE CONTROL
// ===============================

export const enableSound = () => {
  isSoundEnabled = true;
};

export const disableSound = () => {
  isSoundEnabled = false;
};

export const toggleSound = () => {
  isSoundEnabled = !isSoundEnabled;
};

export const getSoundStatus = () => {
  return isSoundEnabled;
};

// ===============================
// SOUND EFFECTS
// ===============================

export const playHoverSound = () => {
  playSound("/sounds/menu.mp3",1);
};

export const playNotificationSound = () => {
  playSound("/sounds/notification.mp3", 0.05);
};

// ✅ NEW: Notification Arrive Sound
export const playNotificationArriveSound = () => {
  playSound("/sounds/notificationarrive.mp3", 1);
};