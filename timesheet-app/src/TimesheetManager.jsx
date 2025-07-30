import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const TimesheetManager = () => {
  const [timesheets, setTimesheets] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchTimesheets();
  }, []);

  const fetchTimesheets = async () => {
    const res = await axios.get("http://localhost:8000/timesheets");
    setTimesheets(res.data);
  };

  return (
    
    <div style={{ padding: 20, width: "100%", marginLeft: '400px' }}>
      <h2 className="mb-4">All Timesheets</h2>
  
      <div style={{ overflowX: "auto" }}>
        <table className="table table-bordered w-100" style={{ minWidth: "800px" }}>
          <thead className="table-light">
            <tr>
              <th>ID</th>
              <th>Date</th>
              <th>Job No</th>
              <th>Site</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {timesheets.map((ts) => (
              <tr key={ts.id}>
                <td>{ts.id}</td>
                <td>{ts.date}</td>
                <td>{ts.job_no}</td>
                <td>{ts.site}</td>
                <td>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => navigate(`/timesheet/${ts.id}`)}
                  >
                    View Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
  
};


export default TimesheetManager;
