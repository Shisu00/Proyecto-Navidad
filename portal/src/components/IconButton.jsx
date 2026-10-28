import Icon from "./Icon.jsx";

// En pantallas anchas muestra solo el ícono; en el teléfono agrega el texto
export default function IconButton({ icon, label, onClick }) {
  return (
    <button type="button" className="icon-button" title={label} onClick={onClick}>
      <Icon name={icon} />
      <span className="icon-button-label">{label}</span>
    </button>
  );
}
