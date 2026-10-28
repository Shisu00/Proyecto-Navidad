import { useRef } from "react";
import { useCedulaPhoto } from "../hooks/useCedulaPhoto.js";
import { labels } from "../lib/labels.js";
import Notice from "./Notice.jsx";

// Abre la cámara del teléfono, que enfoca y usa flash mejor que la vista en vivo del navegador
export default function CedulaPhotoButton({ onRun, disabled }) {
  const inputRef = useRef(null);
  const { status, readFile } = useCedulaPhoto(onRun);

  function handleChange(event) {
    const [file] = event.target.files;
    // Permite volver a elegir la misma foto si hubo que repetirla
    event.target.value = "";
    readFile(file);
  }

  return (
    <>
      <button
        type="button"
        className="button"
        disabled={disabled || status === "reading"}
        onClick={() => inputRef.current?.click()}
      >
        {status === "reading" ? labels.delivery.readingPhoto : labels.delivery.takePhoto}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={handleChange}
      />
      {status === "unreadable" ? (
        <Notice tone="warning">{labels.delivery.photoUnreadable}</Notice>
      ) : null}
    </>
  );
}
