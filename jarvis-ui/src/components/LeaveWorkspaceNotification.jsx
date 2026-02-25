export default function LeaveWorkspaceNotification({
  visible,
  onConfirm,
  onCancel,
}) {
  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 20,
        right: 20,
        width: 320,
        background: "#0b0f1a",
        border: "1px solid #ff6b6b",
        borderRadius: 12,
        padding: 12,
        zIndex: 9999,
      }}
    >
      <h4 style={{ color: "#ff6b6b" }}>⚠️ Leave Workspace</h4>

      <p style={{ color: "#e6f1ff", fontSize: 14 }}>
        Are you sure you want to leave this workspace?
      </p>

      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button
          style={{ flex: 1 }}
          onClick={onConfirm}
        >
          Leave
        </button>

        <button
          style={{ flex: 1 }}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
