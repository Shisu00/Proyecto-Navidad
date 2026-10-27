export default function Notice({ tone = "info", children }) {
  const role = tone === "error" ? "alert" : "status";
  return (
    <p className={`notice notice-${tone}`} role={role}>
      {children}
    </p>
  );
}
