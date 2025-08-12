// AttendanceHome.jsx
import React from "react";
import { useNavigate } from "react-router-dom";

export default function AttendanceHome() {
  const navigate = useNavigate();

  return (
    <div className="container my-5 text-center">
      <h2 className="mb-4 fw-bold">Attendance</h2>
      <div className="d-flex flex-column align-items-center gap-3">
        <button
          className="btn btn-primary btn-lg px-5"
          onClick={() => navigate("/attendance/add")}
        >
          ➕ Add Attendance
        </button>
        <button
          className="btn btn-outline-primary btn-lg px-5"
          onClick={() => navigate("/attendance/view")}
        >
          📅 View Attendance
        </button>
      </div>
    </div>
  );
}
