import { useRef, useState } from "react";

type RoomCodeCopyProps = {
  roomId: string;
  label?: string;
};

export const RoomCodeCopy = ({ roomId, label = "Room code" }: RoomCodeCopyProps) => {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const copyTimeoutRef = useRef<number | null>(null);
  const roomInputRef = useRef<HTMLInputElement | null>(null);

  const scheduleCopyReset = () => {
    if (copyTimeoutRef.current) {
      window.clearTimeout(copyTimeoutRef.current);
    }
    copyTimeoutRef.current = window.setTimeout(() => {
      setCopyStatus("idle");
    }, 2000);
  };

  const fallbackCopyRoom = () => {
    const input = roomInputRef.current;
    if (!input) {
      return false;
    }
    input.focus();
    input.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    }
  };

  const handleCopyRoom = async () => {
    let success = false;
    if (navigator?.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(roomId);
        success = true;
      } catch {
        success = false;
      }
    }
    if (!success) {
      success = fallbackCopyRoom();
    }
    setCopyStatus(success ? "copied" : "failed");
    scheduleCopyReset();
  };

  return (
    <div className="room-copy-block">
      <span className="room-copy-label">{label}</span>
      <div className="room-copy">
        <input
          ref={roomInputRef}
          type="text"
          value={roomId}
          readOnly
          aria-label={label}
          onFocus={(event) => event.currentTarget.select()}
        />
        <button type="button" className="btn btn-secondary" onClick={handleCopyRoom}>
          {copyStatus === "copied" ? "Copied" : "Copy"}
        </button>
      </div>
      {copyStatus === "copied" ? (
        <span className="room-copy__status room-copy__status--ok">Copied to clipboard</span>
      ) : copyStatus === "failed" ? (
        <span className="room-copy__status room-copy__status--error">Copy failed</span>
      ) : null}
    </div>
  );
};
