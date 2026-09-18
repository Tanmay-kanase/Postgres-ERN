import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Layout({ title, children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h2>PERN ERP</h2>
        <NavLink to="/enquiries" className={({ isActive }) => (isActive ? "active" : "")}>
          Enquiries
        </NavLink>
        <NavLink to="/quotations" className={({ isActive }) => (isActive ? "active" : "")}>
          Quotations
        </NavLink>
        <NavLink to="/sales-orders" className={({ isActive }) => (isActive ? "active" : "")}>
          Sales Orders
        </NavLink>
        <div className="role-badge">{user?.role}</div>
        <div style={{ padding: "16px 20px 0" }}>
          <div style={{ fontSize: 13, marginBottom: 10 }}>{user?.name}</div>
          <button className="btn-secondary" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </aside>
      <main className="main">
        <div className="topbar">
          <h1>{title}</h1>
        </div>
        {children}
      </main>
    </div>
  );
}
