import React from "react";
import { Link } from "react-router-dom";

const Navbar = () => {
  return (
    <div
      className="text-white p-4"
      style={{
        backgroundColor: "#0c2a64",
        width: "330px",
        height: "100vh",
        position: "fixed",
        top: 0,
        left: 0,
        overflowY: "auto",
        fontSize: "1.5rem",
      }}
    >
      <h3 className="fw-bold mb-5">Timesheet App</h3>
      <ul className="nav flex-column">
        <li className="nav-item mb-5">
          <Link to="/" className="nav-link text-white">
            📥 Enter Timesheet
          </Link>
        </li>
        <li className="nav-item mb-5">
          <Link to="/salary" className="nav-link text-white">
            📊 View Salary
          </Link>
        </li>
        <li className="nav-item mb-5">
          <Link to="/total-hours" className="nav-link text-white">
            ⏱️ Total Hours
          </Link>
        </li>
        <li className="nav-item mb-5">
          <Link to="/manage-timesheets" className="nav-link text-white">
            🗂️ Manage Timesheets
          </Link>
        </li>
      </ul>
    </div>
  );
};

export default Navbar;

