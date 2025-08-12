import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

const OPEN_WIDTH = 250;
const CLOSED_WIDTH = 70;

const Navbar = () => {
  const location = useLocation();

  // remember collapsed state across reloads
  const [isOpen, setIsOpen] = useState(() => {
    const stored = localStorage.getItem("sidebarOpen");
    return stored ? stored === "true" : true;
  });

  useEffect(() => {
    localStorage.setItem("sidebarOpen", String(isOpen));
  }, [isOpen]);

  const toggleSidebar = () => setIsOpen((o) => !o);

  // active when the current path === item OR starts with it (for nested pages)
  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  const navItems = [
    { to: "/", icon: "📥", label: "Enter Timesheet" },
    { to: "/attendance", icon: "🗓️", label: "Attendance" },
    { to: "/salary", icon: "📊", label: "View Salary" },
    { to: "/total-hours", icon: "⏱️", label: "Total Hours" },
    { to: "/manage-timesheets", icon: "🗂️", label: "Manage Timesheets" },
    

    // ✅ New link for Job Hours Report
    { to: "/job-hours", icon: "💼", label: "Job Hours" },
    { to: "/advances", icon: "💳", label: "Advances" },
  ];


  const sidebarWidth = isOpen ? OPEN_WIDTH : CLOSED_WIDTH;

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={toggleSidebar}
        className="btn btn-dark shadow"
        style={{
          position: "fixed",
          top: "1rem",
          left: `${sidebarWidth + 10}px`,
          zIndex: 1050,
          transition: "left 0.3s ease",
          fontSize: "1.25rem",
          padding: "0.5rem 0.75rem",
          borderRadius: "5px",
        }}
        aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
        title={isOpen ? "Collapse sidebar" : "Expand sidebar"}
      >
        {isOpen ? "←" : "→"}
      </button>

      {/* Sidebar */}
      <div
        className="py-4 px-2"
        style={{
          backgroundColor: "#0c2a64",
          width: `${sidebarWidth}px`,
          height: "100vh",
          position: "fixed",
          top: 0,
          left: 0,
          overflowY: "auto",
          transition: "width 0.3s ease",
          zIndex: 1040,
        }}
      >
        <div
          className="fw-bold text-center mb-5 text-white"
          style={{ fontSize: "1.3rem" }}
        >
          {isOpen ? "Timesheet App" : "⏱️"}
        </div>

        <ul className="nav flex-column">
          {navItems.map(({ to, icon, label }) => {
            const active = isActive(to);
            return (
              <li className="nav-item mb-3" key={to}>
                <Link
                  to={to}
                  className={`nav-link d-flex align-items-center ${
                    active ? "bg-light text-dark" : "text-white"
                  }`}
                  style={{
                    justifyContent: isOpen ? "flex-start" : "center",
                    padding: "0.5rem",
                    fontSize: "1.1rem",
                    gap: isOpen ? "0.5rem" : 0,
                    borderRadius: "0.375rem",
                    opacity: active ? 1 : 0.9,
                  }}
                  title={!isOpen ? label : undefined} // tooltip when collapsed
                >
                  <span aria-hidden="true">{icon}</span>
                  {isOpen && <span>{label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Add left padding to your main content wrapper so it doesn't sit under the sidebar */}
      {/* Example: <div style={{ paddingLeft: sidebarWidth + 20 }}> ... </div> */}
    </>
  );
};

export default Navbar;
