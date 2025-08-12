// AttendanceSheet.jsx
import React, { useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import { format } from "date-fns";
import "react-datepicker/dist/react-datepicker.css";

const STATUS_OPTIONS = ["P", "A", "AL", "EL", "ML"]; // Present, Absent, Annual Leave, Earned Leave, Sick Leave

export default function AttendanceSheet() {
  const [employees, setEmployees] = useState([]);
  const [date, setDate] = useState(new Date());
  const [rows, setRows] = useState([]); // [{emp_no, name, status, notes}]
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const toApi = (d) => format(d, "yyyy-MM-dd");

  // load employees once
  useEffect(() => {
    fetch("http://127.0.0.1:8000/employees")
      .then(r => r.json())
      .then(data => {
        const sorted = [...data].sort((a, b) => {
          const na = parseInt(a.emp_no?.replace(/\D/g, ""), 10);
          const nb = parseInt(b.emp_no?.replace(/\D/g, ""), 10);
          return na - nb;
        });
        setEmployees(sorted);
      })
      .catch(e => setError("Failed to load employees"));
  }, []);

  // load attendance for selected date
  useEffect(() => {
    if (!employees.length) return;
    setLoading(true);
    setError("");
    fetch(`http://127.0.0.1:8000/attendance?date=${toApi(date)}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        // build map for quick lookup
        const map = new Map((data || []).map(x => [x.emp_no, x]));
        const next = employees.map(emp => {
          const existing = map.get(emp.emp_no);
          return {
            emp_no: emp.emp_no,
            name: emp.name,
            status: existing?.status || "P", // default P
            notes: existing?.notes || ""
          };
        });
        setRows(next);
      })
      .catch(() => {
        // no records yet -> default all P
        const next = employees.map(emp => ({
          emp_no: emp.emp_no,
          name: emp.name,
          status: "P",
          notes: ""
        }));
        setRows(next);
      })
      .finally(() => setLoading(false));
  }, [date, employees]);

  const setAll = (status) => {
    setRows(rows => rows.map(r => ({ ...r, status })));
  };

  const updateRow = (idx, key, val) => {
    setRows(rows => {
      const clone = [...rows];
      clone[idx] = { ...clone[idx], [key]: val };
      return clone;
    });
  };

    const save = () => {
    setSaving(true);
    setError("");
    fetch("http://127.0.0.1:8000/attendance/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
        date: toApi(date),
        records: rows.map(r => ({
            emp_no: r.emp_no,
            status: r.status,
            notes: r.notes || ""
        }))
        })
    })
        .then(r => r.ok ? r.json() : r.text().then(t => Promise.reject(t)))
        .then(() => {
        // ✅ SUCCESS — trigger SalarySheet to refresh
        localStorage.setItem("attendance:updatedAt", String(Date.now())); // ping other tabs
        window.dispatchEvent(new CustomEvent("attendance:saved"));        // ping same tab

        alert("Attendance saved");
        })
        .catch(err => setError(typeof err === "string" ? err : "Failed to save attendance"))
        .finally(() => setSaving(false));
    };

  return (
    <div className="container-fluid my-4">
      <h2 className="fw-bold mb-3">Daily Attendance</h2>

      <div className="bg-white border rounded shadow-sm p-3 mb-3">
        <div className="d-flex gap-3 flex-wrap align-items-end">
          <div className="d-flex flex-column">
            <label className="form-label">Date</label>
            <DatePicker
              selected={date}
              onChange={setDate}
              dateFormat="dd/MM/yyyy"
              className="form-control"
            />
          </div>

          <div className="btn-group" role="group">
            <button className="btn btn-outline-secondary" onClick={() => setAll("P")}>Set all P</button>
            <button className="btn btn-outline-secondary" onClick={() => setAll("A")}>Set all A</button>
          </div>

          <button className="btn btn-primary" onClick={save} disabled={saving || loading}>
            {saving ? "Saving..." : "Save"}
          </button>

          {error && <div className="text-danger fw-semibold">{error}</div>}
        </div>
        <small className="text-muted">
          Defaults everyone to <strong>P</strong> (Present). Change only the exceptions.
        </small>
      </div>

      <div className="table-responsive">
        <table className="table table-bordered table-sm text-nowrap">
          <thead>
            <tr>
              <th className="text-center align-middle small">S.no</th>
              <th className="text-center align-middle small">Roll No</th>
              <th className="text-center align-middle small">Name</th>
              <th className="text-center align-middle small">Status</th>
              <th className="text-center align-middle small">Notes</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5}>Loading...</td></tr>
            ) : rows.map((r, idx) => (
              <tr key={r.emp_no}>
                <td>{idx + 1}</td>
                <td>{r.emp_no}</td>
                <td>{r.name}</td>
                <td>
                  <select
                    className="form-select form-select-sm"
                    value={r.status}
                    onChange={(e) => updateRow(idx, "status", e.target.value)}
                  >
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td>
                  <input
                    className="form-control form-control-sm"
                    value={r.notes}
                    onChange={(e) => updateRow(idx, "notes", e.target.value)}
                    placeholder="Optional"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
