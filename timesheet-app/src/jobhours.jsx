// src/JobHoursReport.jsx
import React, { useState } from "react";

const API_BASE = "http://127.0.0.1:8000"; // change if your backend is elsewhere

export default function JobHoursReport() {
  const [jobNo, setJobNo] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fmt = (v, d = 2) => {
    if (v === null || v === undefined || Number.isNaN(v)) return "";
    return Number(v).toLocaleString(undefined, {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    });
  };

  const search = async () => {
    const q = jobNo.trim();
    if (!q) {
      setError("Enter a job number");
      return;
    }
    setLoading(true);
    setError("");
    setRows([]);
    try {
      const res = await fetch(`${API_BASE}/job-hours/${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError("Failed to load report. Check the job number and server logs.");
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter") search();
  };

  return (
    <div className="container my-4">
      <h2 className="fw-bold mb-3">Job Number Hours Report</h2>

      <div className="d-flex gap-2 mb-3">
        <input
          className="form-control"
          placeholder="Enter Job Number"
          value={jobNo}
          onChange={(e) => setJobNo(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button className="btn btn-primary" onClick={search} disabled={loading}>
          {loading ? "Loading..." : "Search"}
        </button>
      </div>

      {error && <div className="alert alert-danger py-2">{error}</div>}

      <div className="table-responsive">
        <table className="table table-bordered table-sm align-middle">
          <thead className="table-light">
            <tr>
              <th>Employee No</th>
              <th>Employee Name</th>
              <th className="text-end">Total Hours</th>
              <th className="text-end">Reg Hours</th>
              <th className="text-end">NOT Hours</th>
              <th className="text-end">HOT Hours</th>
              <th className="text-end">Base Value</th>
              <th className="text-end">OT Value</th>
              <th className="text-end">Total Value</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9}>Loading…</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9}>No data yet. Search a job number.</td>
              </tr>
            ) : (
              rows.map((r, i) => {
                const isTotal = r.emp_no === "TOTAL";
                return (
                  <tr key={`${r.emp_no}-${i}`} className={isTotal ? "table-light" : ""}>
                    <td style={{ fontWeight: isTotal ? 700 : 400 }}>{r.emp_no}</td>
                    <td style={{ fontWeight: isTotal ? 700 : 400 }}>{r.name}</td>
                    <td className="text-end">{fmt(r.total_hours, 2)}</td>
                    <td className="text-end">{fmt(r.reg_hours, 2)}</td>
                    <td className="text-end">{fmt(r.not_hours, 2)}</td>
                    <td className="text-end">{fmt(r.hot_hours, 2)}</td>
                    <td className="text-end">{fmt(r.base_value, 2)}</td>
                    <td className="text-end">{fmt(r.ot_value, 2)}</td>
                    <td className="text-end" style={{ fontWeight: isTotal ? 700 : 400 }}>
                      {fmt(r.total_value, 2)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <small className="text-muted d-block mt-2">
        Calc rules: subtract NOT/HOT from daily totals to get REG. REG value uses (REG/8) × (base / days-in-month of that day).
        OT value = NOT × (base/240×1.25) + HOT × (base/240×1.5). Totals sum across all timesheets for the job.
      </small>
    </div>
  );
}
