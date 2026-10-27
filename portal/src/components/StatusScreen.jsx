export default function StatusScreen({ title, body, children }) {
  return (
    <main className="screen">
      <div className="screen-panel" role="status">
        <h1>{title}</h1>
        {body ? <p>{body}</p> : null}
        {children}
      </div>
    </main>
  );
}
