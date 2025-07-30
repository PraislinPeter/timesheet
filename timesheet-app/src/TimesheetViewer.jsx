import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";

const TimesheetViewer = () => {
  const { state } = useLocation();
  const [timesheets, setTimesheets] = useState([]);

  useEffect(() => {
    if (state?.ids?.length > 0) {
      fetchTimesheets(state.ids);
    }
  }, [state]);

  const fetchTimesheets = async (ids) => {
    try {
      const query = ids.map((id) => `timesheet_ids=${id}`).join("&");
      const url = `http://localhost:8000/timesheets/details?${query}`;
      console.log("📡 Fetching from:", url); // <--- prints the full URL
      const res = await axios.get(url);
      setTimesheets(res.data);
    } catch (err) {
      console.error("Failed to fetch timesheets:", err);
    }
  };
  
  if (timesheets.length === 0) return <div className="p-4">Loading timesheets...</div>;

  return (
    <div className="p-4">
      <h2>Selected Timesheets</h2>

      {timesheets.map((ts) => (
        <div key={ts.id} className="mb-5 border p-3 shadow-sm">
          <h4>Timesheet #{ts.id} – {ts.date}</h4>
          <p><strong>Job:</strong> {ts.job_no} | <strong>Site:</strong> {ts.site} | <strong>Ship:</strong> {ts.ship}</p>
          <p><strong>Checked By:</strong> {ts.checked_by} | <strong>Authorized By:</strong> {ts.authorized_by}</p>
          <p><strong>Company:</strong> {ts.for_company}</p>

          <h5 className="mt-3">Entries</h5>
          <table className="table table-bordered">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Trade</th>
                <th>From</th>
                <th>To</th>
                <th>Break (min)</th>
                <th>Total Hours</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {ts.entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.employee_name || entry.employee_id}</td>
                  <td>{entry.trade_name || entry.trade_id}</td>
                  <td>{entry.from_time}</td>
                  <td>{entry.to_time}</td>
                  <td>{entry.break_minutes}</td>
                  <td>{entry.total_hours}</td>
                  <td>{entry.remarks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
};

export default TimesheetViewer;


