import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(true);
  const location = useLocation();

  const toggleSidebar = () => setIsOpen(!isOpen);
  const isActive = (path) => location.pathname === path;

  const navItems = [
    { to: "/", icon: "📥", label: "Enter Timesheet" },
    { to: "/salary", icon: "📊", label: "View Salary" },
    { to: "/total-hours", icon: "⏱️", label: "Total Hours" },
    { to: "/manage-timesheets", icon: "🗂️", label: "Manage Timesheets" },
  ];

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={toggleSidebar}
        className="btn btn-dark shadow"
        style={{
          position: "fixed",
          top: "1rem",
          left: isOpen ? "260px" : "80px",
          zIndex: 1050,
          transition: "left 0.3s ease",
          fontSize: "1.25rem",
          padding: "0.5rem 0.75rem",
          borderRadius: "5px",
        }}
      >
        {isOpen ? "←" : "→"}
      </button>

      {/* Sidebar */}
      <div
        className="py-4 px-2"
        style={{
          backgroundColor: "#0c2a64",
          width: isOpen ? "250px" : "70px",
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
              <li className="nav-item mb-4 text-center" key={to}>
                <Link
                  to={to}
                  className={`nav-link d-flex align-items-center ${
                    active
                      ? "bg-light text-dark"
                      : "text-white hover-opacity-75"
                  }`}
                  style={{
                    justifyContent: isOpen ? "flex-start" : "center",
                    padding: "0.5rem",
                    fontSize: "1.2rem",
                    gap: isOpen ? "0.5rem" : 0,
                    borderRadius: "0.375rem",
                  }}
                >
                  <span>{icon}</span>
                  {isOpen && <span>{label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
};

export default Navbar;
