import React, { useState, useEffect } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useNavigate, useLocation } from "react-router-dom";

const TimesheetReport = () => {
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [reportData, setReportData] = useState([]);
  const [filteredData, setFilteredData] = useState([]); // ✅ holds only OT=YES
  const [error, setError] = useState("");
  const location = useLocation();
  const navigate = useNavigate();

  // Load saved dates from session
  useEffect(() => {
    const storedStart = sessionStorage.getItem("reportStartDate");
    const storedEnd = sessionStorage.getItem("reportEndDate");
    if (!startDate && storedStart) setStartDate(new Date(storedStart));
    if (!endDate && storedEnd) setEndDate(new Date(storedEnd));
  }, []);

  // Save dates to session
  useEffect(() => {
    if (startDate) sessionStorage.setItem("reportStartDate", startDate.toISOString());
  }, [startDate]);

  useEffect(() => {
    if (endDate) sessionStorage.setItem("reportEndDate", endDate.toISOString());
  }, [endDate]);

  // Auto-fetch when both dates are set
  useEffect(() => {
    if (startDate && endDate) {
      fetchReport();
    }
  }, [startDate, endDate]);

  const formatToApi = (date) => format(date, "yyyy-MM-dd");
  const formatDisplayDate = (date) => format(new Date(date), "dd-MMM-yy");

  const fetchReport = async () => {
    setError("");

    if (!startDate || !endDate) {
      setError("Both dates are required.");
      return;
    }
    if (startDate > endDate) {
      setError("Start date cannot be after end date.");
      return;
    }

    const url = `http://127.0.0.1:8000/reports/summary?start=${formatToApi(startDate)}&end=${formatToApi(endDate)}`;

    try {
      const res = await fetch(url);
      const data = await res.json();

      setReportData(data);
      // ✅ Filter OT=YES here (case-insensitive)
      const onlyYes = (data || []).filter(e => String(e.OT || "").toUpperCase() === "YES");
      setFilteredData(onlyYes);
    } catch (err) {
      console.error("Failed to fetch report", err);
      setReportData([]);
      setFilteredData([]);
    }
  };

  const exportToExcel = () => {
    if (filteredData.length === 0) return;

    const allDates = Object.keys(filteredData[0].entries_by_date).sort();

    const exportRows = filteredData.map((emp, idx) => {
      const row = {
        "SL NO.": idx + 1,
        "STAFF NAME": emp.employee_name,
        "EMP NO": emp.emp_no,
        "TOTAL HOURS": emp.total_hours,
        "NORMAL OT": emp.normal_ot,
        "HOLIDAY OT": emp.holiday_ot,
      };
      allDates.forEach((date) => {
        row[formatDisplayDate(date)] = emp.entries_by_date[date]?.total_hours ?? "-";
      });
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Timesheet Report");

    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(blob, `Timesheet_Report_${formatToApi(startDate)}_to_${formatToApi(endDate)}.xlsx`);
  };

  const handleView = (timesheetIds) => {
    navigate("/timesheets/view", { state: { ids: timesheetIds } });
  };

  const allDates =
    filteredData.length > 0
      ? Object.keys(filteredData[0].entries_by_date).sort()
      : [];

  return (
    <div className="d-flex" style={{ minHeight: "100vh", marginLeft: "350px" }}>
      <div className="flex-grow-1 d-flex justify-content-center align-items-start mt-5">
        <div style={{ maxWidth: "1400px", width: "100%" }}>
          <h3>Timesheet Report</h3>

          {/* Filter Bar */}
          <div
            className="bg-white border rounded shadow-sm p-3 mb-4"
            style={{ position: "sticky", top: 0, zIndex: 10 }}
          >
            <div className="d-flex mb-3 gap-4 flex-wrap">
              <div className="d-flex flex-column">
                <label className="form-label">Start Date</label>
                <DatePicker
                  selected={startDate}
                  onChange={(date) => setStartDate(date)}
                  dateFormat="dd/MM/yyyy"
                  className="form-control"
                  placeholderText="dd/mm/yyyy"
                />
              </div>

              <div className="d-flex flex-column">
                <label className="form-label">End Date</label>
                <DatePicker
                  selected={endDate}
                  onChange={(date) => setEndDate(date)}
                  dateFormat="dd/MM/yyyy"
                  className="form-control"
                  placeholderText="dd/mm/yyyy"
                />
              </div>

              <div className="d-flex gap-2 align-self-end">
                <button className="btn btn-primary" onClick={fetchReport}>
                  Go
                </button>
                <button
                  className="btn btn-success"
                  onClick={exportToExcel}
                  disabled={filteredData.length === 0}
                >
                  Export to Excel
                </button>
              </div>
            </div>

            {error && <div className="text-danger fw-semibold">{error}</div>}
          </div>

          {/* Table */}
          <table className="table table-bordered text-center">
            <thead className="table-primary">
              <tr>
                <th>SL NO.</th>
                <th>STAFF NAME</th>
                <th>EMP NO</th>
                <th>TOTAL HOURS</th>
                <th>NORMAL OT</th>
                <th>HOLIDAY OT</th>
                {allDates.map((date) => {
                  const isSunday = new Date(date).getDay() === 0;
                  return (
                    <th
                      key={date}
                      style={isSunday ? { backgroundColor: "#ffe6e6" } : {}}
                    >
                      {formatDisplayDate(date)}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={allDates.length + 6}>No data available</td>
                </tr>
              ) : (
                filteredData.map((emp, index) => (
                  <tr key={index}>
                    <td>{index + 1}</td>
                    <td>{emp.employee_name}</td>
                    <td>{emp.emp_no}</td>
                    <td>{emp.total_hours}</td>
                    <td>{emp.normal_ot}</td>
                    <td>{emp.holiday_ot}</td>
                    {allDates.map((date) => {
                      const entry = emp.entries_by_date[date];
                      const day = new Date(date).getDay();
                      const isSunday = day === 0;

                      return (
                        <td key={date}>
                          {entry && entry.total_hours > 0 ? (
                            <button
                              className="btn btn-link p-0"
                              title={`Timesheet IDs: ${entry.timesheet_ids.join(", ")}`}
                              onClick={() => handleView(entry.timesheet_ids)}
                            >
                              {entry.total_hours} hrs
                            </button>
                          ) : isSunday ? (
                            <span style={{ color: "#999" }}>-</span>
                          ) : (
                            <span style={{ color: "red", fontWeight: "bold" }}>A</span>
                          )}
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
    </div>
  );
};

export default TimesheetReport;
