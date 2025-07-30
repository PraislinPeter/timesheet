import React, { useState, useEffect } from "react";
import TimesheetRow from "./TimesheetRow";
import logo from "./assets/logo.png";
import "bootstrap/dist/css/bootstrap.min.css";

const TimesheetForm = () => {
  const [employees, setEmployees] = useState([]);

  const [formData, setFormData] = useState({
    ship: "",
    site: "",
    date: "",
    jobNo: "",
    sheetNo: "",
    rows: Array(20).fill().map(() => ({
      name: "", trade: "", from: "", to: "",
      breakH: "", breakM: "", total: "", remarks: ""
    })),
    checkedBy: "",
    authorizedBy: "",
    forCompany: "",
  });

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const res = await fetch("http://localhost:8000/employees");
        const data = await res.json();
        setEmployees(data);
      } catch (err) {
        console.error("Failed to fetch employees", err);
      }
    };
    fetchEmployees();
  }, []);
  const [trades, setTrades] = useState([]);

useEffect(() => {
  const fetchTrades = async () => {
    try {
      const res = await fetch("http://localhost:8000/trades");
      const data = await res.json();
      setTrades(data);
    } catch (err) {
      console.error("Failed to fetch trades", err);
    }
  };
  fetchTrades();
}, []);


  const getEmployeeId = (name) => {
    const emp = employees.find(
      (e) => e.name.toLowerCase().trim() === name.toLowerCase().trim()
    );
    return emp?.emp_no || null;
  };
  const getTradeId = (tradeName) => {
    const trade = trades.find(
      (t) => t.trade_name.toLowerCase().trim() === tradeName.toLowerCase().trim()
    );
    return trade?.id || null;
  };
  
  const updateRow = (index, newRow) => {
    const updatedRows = [...formData.rows];
    updatedRows[index] = newRow;
    setFormData({ ...formData, rows: updatedRows });
  };

  const validateForm = () => {
    const errors = [];
  
    if (!formData.date) errors.push("Date is required.");
    if (!formData.jobNo) {
      errors.push("Job No. is required.");
    } else if (isNaN(formData.jobNo)) {
      errors.push("Job No. must be a number.");
    }
  
    if (!formData.ship) errors.push("Ship is required.");
    if (!formData.site) errors.push("Site is required.");
  
    if (!formData.sheetNo) {
      errors.push("Sheet No. is required.");
    } else if (isNaN(formData.sheetNo)) {
      errors.push("Sheet No. must be a number.");
    }
  
    if (!formData.checkedBy) errors.push("Checked By is required.");
    if (!formData.authorizedBy) errors.push("Authorized By is required.");
  
    const validEntries = formData.rows.filter((r) => r.name && r.from && r.to);
  
    if (validEntries.length === 0) {
      errors.push("At least one timesheet entry with Name, From and To time is required.");
    }
  
    validEntries.forEach((entry, index) => {
      if (!getEmployeeId(entry.name)) {
        errors.push(`Row ${index + 1}: Invalid employee name "${entry.name}".`);
      }
      if (isNaN(parseFloat(entry.total))) {
        errors.push(`Row ${index + 1}: Total hours must be a number.`);
      }
    });
  
    return errors;
  };
  
  const handleSubmit = async () => {
    const errors = validateForm();

    if (errors.length > 0) {
      alert("Form has errors:\n\n" + errors.join("\n"));
      return;
    }

    const formatted = {
      date: formData.date,
      ship: formData.ship,
      site: formData.site,
      job_no: formData.jobNo,
      sheet_no: formData.sheetNo,
      checked_by: formData.checkedBy,
      authorized_by: formData.authorizedBy,
      for_company: formData.forCompany,
      entries: formData.rows
    .filter((r) => r.name && r.from && r.to)
    .map((r) => ({
      employee_emp_no: getEmployeeId(r.name), // ✅ Correct field name
      trade_id: r.trade ? getTradeId(r.trade) : undefined, // ✅ Must be added
      from_time: r.from,
      to_time: r.to,
      break_minutes: (parseInt(r.breakH || 0) * 60) + parseInt(r.breakM || 0),
      total_hours: parseFloat(r.total || 0),
      remarks: r.remarks || ""
    }))

    };
    console.log("Submitting payload:", formatted); // ✅ LOG HERE
    try {
      const response = await fetch("http://127.0.0.1:8000/timesheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formatted)
      });

      const result = await response.json();
      console.log("Submitted:", result);

      if (response.ok) {
        alert("Timesheet submitted successfully!");
      } else {
        alert("Submission failed: " + JSON.stringify(result.detail || result));
      }
    } catch (err) {
      console.error("Submission failed:", err);
      alert("Submission failed. Check console.");
    }
  };

  return (
    <div style={{ marginLeft: '175px', padding: '20px', fontFamily: 'Arial, sans-serif', fontSize: '14px' }}>
      <div className="text-center mb-4">
        <img src={logo} alt="Logo" style={{ width: "100px", marginBottom: "10px" }} />
        <h5 className="fw-bold text-primary mb-1">PRAISE ADONAI SHIPS & BOATS REPAIRING EST.</h5>
        <div className="d-flex justify-content-center gap-4 mb-1">
          <span className="text-dark">Contact: 050 6764720</span>
          <span className="text-dark">Contact: 056 4771261</span>
        </div>
        <p className="fst-italic text-muted">Place for solution</p>
        <div className="d-flex justify-content-center flex-wrap text-secondary gap-3">
          <span>* Mechanical Eqptmt.Maint. & Installation</span>
          <span>* Laser Alignment</span>
          <span>* Valve Repair & Testing</span>
          <span>* Repair & Maintenance of Ships</span>
          <span>* Fabrication Works</span>
        </div>
      </div>

      <div className="row align-items-center mb-3">
        <div className="col-md-4">
          <label className="form-label fw-bold">SHIP</label>
          <input className="form-control" value={formData.ship} onChange={(e) => setFormData({ ...formData, ship: e.target.value })} />
        </div>
        <div className="col-md-4 text-center">
          <h2 className="fw-bold">TIME SHEET</h2>
        </div>
        <div className="col-md-4 text-end">
          <label className="form-label fw-bold">No.</label>
          <input className="form-control mb-2" value={formData.sheetNo} onChange={(e) => setFormData({ ...formData, sheetNo: e.target.value })} />
          <label className="form-label fw-bold">Date</label>
          <input type="date" className="form-control mb-2" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
          <label className="form-label fw-bold">Job No.</label>
          <input className="form-control" value={formData.jobNo} onChange={(e) => setFormData({ ...formData, jobNo: e.target.value })} />
        </div>
      </div>

      <div className="mb-3">
        <label className="form-label fw-bold">SITE</label>
        <input className="form-control" value={formData.site} onChange={(e) => setFormData({ ...formData, site: e.target.value })} />
      </div>

      <table className="table table-bordered table-sm text-center mt-3">
        <thead className="table-primary">
          <tr>
            <th>Sl.No</th>
            <th>Name</th>
            <th>Trade</th>
            <th>From</th>
            <th>To</th>
            <th style={{ width: "220px" }}>Break</th>
            <th>Total Hrs.</th>
            <th>Remarks</th>
          </tr>
        </thead>
        <tbody>
          {formData.rows.map((row, i) => (
            <TimesheetRow
              key={i}
              index={i}
              data={row}
              onChange={(updated) => updateRow(i, updated)}
            />
          ))}
        </tbody>
      </table>

      <div className="row text-center mt-5">
        <div className="col">
          <input type="text" className="form-control" placeholder="Checked by"
            value={formData.checkedBy}
            onChange={(e) => setFormData({ ...formData, checkedBy: e.target.value })} />
        </div>
        <div className="col">
          <input type="text" className="form-control" placeholder="Authorised Signature"
            value={formData.authorizedBy}
            onChange={(e) => setFormData({ ...formData, authorizedBy: e.target.value })} />
        </div>
        <div className="col">
        <div className="form-control text-start fw-bold bg-light">
          For: PRAISE ADONAI
        </div>
        </div>
      </div>

      <div className="text-end mt-4">
        <button className="btn btn-success px-4 py-2 fw-bold" onClick={handleSubmit}>
          Submit Timesheet
        </button>
      </div>
    </div>
  );
};

export default TimesheetForm;

