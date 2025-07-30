import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

const TimesheetDetail = () => {
  const { id } = useParams();
  const [timesheet, setTimesheet] = useState(null);
  const [timesheetForm, setTimesheetForm] = useState({});
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [entryForm, setEntryForm] = useState({});

  useEffect(() => {
    fetchTimesheet();
  }, [id]);

  const fetchTimesheet = async () => {
    const res = await axios.get(`http://localhost:8000/timesheets/${id}`);
    setTimesheet(res.data);
    setTimesheetForm(res.data);
  };

  const handleTimesheetChange = (e) => {
    const { name, value } = e.target;
    setTimesheetForm((prev) => ({ ...prev, [name]: value }));
  };

  const saveTimesheet = async () => {
    const confirmSave = window.confirm("Are you sure you want to update this timesheet?");
    if (!confirmSave) return;
  
    const rawPayload = {
      job_no: timesheetForm.job_no,
      ship: timesheetForm.ship,
      site: timesheetForm.site,
      sheet_no: timesheetForm.sheet_no,
      checked_by: timesheetForm.checked_by,
      authorized_by: timesheetForm.authorized_by,
      for_company: timesheetForm.for_company,
      date:
        typeof timesheetForm.date === "string"
          ? timesheetForm.date
          : new Date(timesheetForm.date).toISOString().split("T")[0],
    };
  
    const payload = Object.fromEntries(
      Object.entries(rawPayload).filter(([_, v]) => v !== undefined)
    );
  
    console.log("Final sanitized payload:", payload);
  
    try {
      await axios.put(`http://localhost:8000/timesheets/${id}`, payload);
      fetchTimesheet();
    } catch (err) {
      console.error("❌ Failed to update timesheet:", err.response?.data || err.message);
    }
  };
  
  
  

  const handleEntryEdit = (entry) => {
    setEditingEntryId(entry.id);
    setEntryForm({ ...entry });
  };

  const handleEntryChange = (e) => {
    const { name, value } = e.target;
    setEntryForm((prev) => ({ ...prev, [name]: value }));
  };

  const saveEntry = async () => {
    const confirmSave = window.confirm("Are you sure you want to update this entry?");
    if (!confirmSave) return;
  
    try {
      await axios.put(`http://localhost:8000/time-entries/${editingEntryId}`, entryForm);
      setEditingEntryId(null);
      fetchTimesheet();
    } catch (err) {
      console.error("❌ Failed to update entry:", err.response?.data || err.message);
    }
  };
  

  if (!timesheet) return <div>Loading...</div>;

  return (
    <div className="p-4">
      <h2>Timesheet #{timesheet.id}</h2>

      <div className="mb-3">
        <input name="date" value={timesheetForm.date} onChange={handleTimesheetChange} />
        <input name="job_no" value={timesheetForm.job_no} onChange={handleTimesheetChange} placeholder="Job No" />
        <input name="site" value={timesheetForm.site} onChange={handleTimesheetChange} placeholder="Site" />
        <input name="ship" value={timesheetForm.ship} onChange={handleTimesheetChange} placeholder="Ship" />
        <input name="checked_by" value={timesheetForm.checked_by} onChange={handleTimesheetChange} placeholder="Checked By" />
        <input name="authorized_by" value={timesheetForm.authorized_by} onChange={handleTimesheetChange} placeholder="Authorized By" />
        <input name="for_company" value={timesheetForm.for_company} onChange={handleTimesheetChange} placeholder="Company" />
        <button onClick={saveTimesheet}>💾 Save Timesheet</button>
      </div>

      <h4 className="mt-4">Entries</h4>
      <h4 className="mt-4">Entries</h4>
<table className="table table-bordered">
  <thead>
    <tr>
      <th>Employee Name</th>
      <th>Trade</th>
      <th>From</th>
      <th>To</th>
      <th>Break (min)</th>
      <th>Total Hours</th>
      <th>Remarks</th>
      <th>Action</th>
    </tr>
  </thead>
  <tbody>
    {timesheet.entries.map((entry) => (
      <tr key={entry.id}>
        <td>{entry.employee_name}</td>
        <td>{entry.trade_name}</td>
        <td>
          {editingEntryId === entry.id ? (
            <input
              name="from_time"
              value={entryForm.from_time}
              onChange={handleEntryChange}
              type="time"
            />
          ) : (
            entry.from_time
          )}
        </td>
        <td>
          {editingEntryId === entry.id ? (
            <input
              name="to_time"
              value={entryForm.to_time}
              onChange={handleEntryChange}
              type="time"
            />
          ) : (
            entry.to_time
          )}
        </td>
        <td>
          {editingEntryId === entry.id ? (
            <input
              name="break_minutes"
              value={entryForm.break_minutes}
              onChange={handleEntryChange}
              type="number"
            />
          ) : (
            entry.break_minutes
          )}
        </td>
        <td>
          {editingEntryId === entry.id ? (
            <input
              name="total_hours"
              value={entryForm.total_hours}
              onChange={handleEntryChange}
              type="number"
              step="0.25"
            />
          ) : (
            entry.total_hours
          )}
        </td>
        <td>
          {editingEntryId === entry.id ? (
            <input
              name="remarks"
              value={entryForm.remarks}
              onChange={handleEntryChange}
            />
          ) : (
            entry.remarks
          )}
        </td>
        <td>
          {editingEntryId === entry.id ? (
            <button onClick={saveEntry}>💾 Save</button>
          ) : (
            <button onClick={() => handleEntryEdit(entry)}>✏️ Edit</button>
          )}
        </td>
      </tr>
    ))}
  </tbody>
</table>

    </div>
  );
};

export default TimesheetDetail;


