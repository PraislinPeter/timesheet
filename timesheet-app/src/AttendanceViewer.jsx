// AttendanceViewer.jsx
import React, { useEffect, useMemo, useState } from "react";
import DatePicker from "react-datepicker";
import { addDays, eachDayOfInterval, format } from "date-fns";
import { useLocation } from "react-router-dom";
import "react-datepicker/dist/react-datepicker.css";

export default function AttendanceViewer() {
  const loc = useLocation();
  const initialStart =
    loc.state?.start ||
    new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const initialEnd = loc.state?.end || addDays(initialStart, 29);

  const [employees, setEmployees] = useState([]);
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [matrix, setMatrix] = useState(new Map()); // key `${emp_no}|${date}` -> status

  const dates = useMemo(
    () => eachDayOfInterval({ start, end }),
    [start, end]
  );
  const toApi = (d) => format(d, "yyyy-MM-dd");

  // Load employees
  useEffect(() => {
    fetch("http://127.0.0.1:8000/employees")
      .then((r) => r.json())
      .then((data) => {
        const sorted = [...data].sort((a, b) => {
          const na = parseInt(a.emp_no?.replace(/\D/g, ""), 10);
          const nb = parseInt(b.emp_no?.replace(/\D/g, ""), 10);
          return na - nb;
        });
        setEmployees(sorted);
      })
      .catch(() => setError("Failed to load employees"));
  }, []);

  const fetchRangeFast = async () => {
    const url = `http://127.0.0.1:8000/attendance/range?start=${toApi(
      start
    )}&end=${toApi(end)}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error("no-range-endpoint");
    return r.json();
  };

  const fetchRangeFallback = async () => {
    const results = await Promise.all(
      dates.map(async (d) => {
        const r = await fetch(
          `http://127.0.0.1:8000/attendance?date=${toApi(d)}`
        );
        if (!r.ok) return [];
        const list = await r.json();
        return (list || []).map((x) => ({
          date: toApi(d),
          emp_no: x.emp_no,
          status: x.status || ""
        }));
      })
    );
    return results.flat();
  };

  const load = async () => {
    if (!employees.length) return;
    setLoading(true);
    setError("");
    try {
      let rows;
      try {
        rows = await fetchRangeFast();
      } catch {
        rows = await fetchRangeFallback();
      }
      const map = new Map();
      (rows || []).forEach((r) => {
        map.set(`${r.emp_no}|${r.date}`, (r.status || "").toUpperCase());
      });
      setMatrix(map);
    } catch (e) {
      setError("Failed to load attendance for the selected range");
      setMatrix(new Map());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [start, end, employees]);

  return (
    <div className="container-fluid my-4">
      <h2 className="fw-bold mb-3">Attendance Viewer</h2>

      <div className="bg-white border rounded shadow-sm p-3 mb-3">
        <div className="d-flex gap-3 flex-wrap align-items-end">
          <div className="d-flex flex-column">
            <label className="form-label">Start</label>
            <DatePicker
              selected={start}
              onChange={setStart}
              dateFormat="dd/MM/yyyy"
              className="form-control"
            />
          </div>
          <div className="d-flex flex-column">
            <label className="form-label">End</label>
            <DatePicker
              selected={end}
              onChange={setEnd}
              dateFormat="dd/MM/yyyy"
              className="form-control"
            />
          </div>
          <button className="btn btn-secondary" onClick={load} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
          {error && <div className="text-danger fw-semibold">{error}</div>}
        </div>
        <small className="text-muted">
          Employees are rows. Dates are columns. Cells show recorded status only.
        </small>
      </div>

      <div className="table-responsive">
        <table className="table table-bordered table-sm text-nowrap">
          <thead>
            <tr>
              <th>Employee</th>
              {dates.map((d) => (
                <th key={toApi(d)} className="text-center">
                  {format(d, "dd-MMM")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={dates.length + 1}>Loading...</td>
              </tr>
            ) : (
              employees.map((emp) => (
                <tr key={emp.emp_no}>
                  <td>{emp.emp_no} - {emp.name}</td>
                  {dates.map((d) => {
                    const key = `${emp.emp_no}|${toApi(d)}`;
                    const val = matrix.get(key) ?? ""; // blank if no record
                    const bg =
                      val === "A"
                        ? "#fde2e2"
                        : val === "AL" || val === "EL"
                        ? "#fff2cc"
                        : val === "ML"
                        ? "#e6f0ff"
                        : "transparent";
                    return (
                      <td
                        key={toApi(d)}
                        className="text-center"
                        style={{
                          background: bg,
                          fontWeight: val === "A" ? 600 : 400
                        }}
                      >
                        {val}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
