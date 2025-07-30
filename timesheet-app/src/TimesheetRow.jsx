import React, { useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import axios from "axios";

const TimesheetRow = ({ index, data, onChange }) => {
  const [employees, setEmployees] = useState([]);
  const [trades, setTrades] = useState([]);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const res = await axios.get("http://localhost:8000/employees");
        setEmployees(res.data);
      } catch (err) {
        console.error("Error fetching employees:", err);
      }
    };

    const fetchTrades = async () => {
      try {
        const res = await axios.get("http://localhost:8000/trades");
        setTrades(res.data);
      } catch (err) {
        console.error("Error fetching trades:", err);
      }
    };

    fetchEmployees();
    fetchTrades();
  }, []);

  const parseTime = (timeStr) => {
    const [hours, minutes] = timeStr.split(":").map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  };

  const formatTime = (dateObj) =>
    dateObj ? dateObj.toTimeString().slice(0, 5) : "";

  const handleChange = (field, value) => {
    const updated = { ...data, [field]: value };

    if (["from", "to", "breakH", "breakM"].includes(field)) {
      updated.total = calculateTotal(updated);
    }

    onChange(updated);
  };

  const handleTimeChange = (field, date) => {
    handleChange(field, formatTime(date));
  };

  const calculateTotal = ({ from, to, breakH, breakM }) => {
    if (!from || !to) return "";

    const [fromH, fromM] = from.split(":").map(Number);
    const [toH, toM] = to.split(":").map(Number);
    let start = fromH * 60 + fromM;
    let end = toH * 60 + toM;
    if (end < start) end += 1440;

    const breakMinutes = (parseInt(breakH) || 0) * 60 + (parseInt(breakM) || 0);
    const totalMinutes = end - start - breakMinutes;
    return (totalMinutes / 60).toFixed(2);
  };

  return (
    <tr>
      <td>{index + 1}</td>

      {/* Name Dropdown */}
      <td>
        <input
          list={`employee-list-${index}`}
          className="form-control"
          value={data.name}
          onChange={(e) => handleChange("name", e.target.value)}
        />
        <datalist id={`employee-list-${index}`}>
          {employees.map((emp) => (
            <option key={emp.emp_no} value={emp.name} />
          ))}
        </datalist>
      </td>


      {/* Trade Dropdown */}
      <td>
        <select
          className="form-control"
          value={data.trade}
          onChange={(e) => handleChange("trade", e.target.value)}
        >
          <option value="">Select Trade</option>
          {trades.map((trade) => (
            <option key={trade.id} value={trade.trade_name}>
              {trade.trade_name}
            </option>
          ))}
        </select>
      </td>

      {/* From Time */}
      <td>
        <DatePicker
          selected={data.from ? parseTime(data.from) : null}
          onChange={(date) => handleTimeChange("from", date)}
          showTimeSelect
          showTimeSelectOnly
          timeIntervals={15}
          timeFormat="HH:mm"
          dateFormat="HH:mm"
          placeholderText="Select Time"
          className="form-control"
        />
      </td>

      {/* To Time */}
      <td>
        <DatePicker
          selected={data.to ? parseTime(data.to) : null}
          onChange={(date) => handleTimeChange("to", date)}
          showTimeSelect
          showTimeSelectOnly
          timeIntervals={15}
          timeFormat="HH:mm"
          dateFormat="HH:mm"
          placeholderText="Select Time"
          className="form-control"
        />
      </td>

      {/* Break Time (Hours + Minutes) */}
      <td className="d-flex gap-1 justify-content-center">
        <input
          type="number"
          className="form-control"
          placeholder="H"
          style={{ width: "50%" }}
          value={data.breakH || ""}
          onChange={(e) => handleChange("breakH", e.target.value)}
        />
        <input
          type="number"
          className="form-control"
          placeholder="M"
          style={{ width: "50%" }}
          value={data.breakM || ""}
          onChange={(e) => handleChange("breakM", e.target.value)}
        />
      </td>

      {/* Total Time */}
      <td>
        <input
          type="text"
          className="form-control"
          value={data.total || ""}
          readOnly
        />
      </td>

      {/* Remarks */}
      <td>
        <input
          type="text"
          className="form-control"
          value={data.remarks || ""}
          onChange={(e) => handleChange("remarks", e.target.value)}
        />
      </td>
    </tr>
  );
};

export default TimesheetRow;


