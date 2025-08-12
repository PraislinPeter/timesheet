// SalarySheet.jsx
import React, { useEffect, useState } from "react";
import { getDaysInMonth, startOfMonth, format } from "date-fns";
import DatePicker from "react-datepicker";
import * as XLSX from "xlsx";
import "react-datepicker/dist/react-datepicker.css";
import { useNavigate } from "react-router-dom";

// PDF + ZIP
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import JSZip from "jszip";
import { saveAs } from "file-saver";

export default function SalarySheet() {
  const [employees, setEmployees] = useState([]);
  const [otHoursByEmp, setOtHoursByEmp] = useState({});
  const [absencesByEmp, setAbsencesByEmp] = useState({});
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [error, setError] = useState("");
  const [attendanceUpdatedAt, setAttendanceUpdatedAt] = useState(0);
  const [detailModal, setDetailModal] = useState({ show: false, emp: null, dates: [] });

  const toApi = (d) => format(d, "yyyy-MM-dd");
  const daysInSelectedMonth = selectedMonth ? getDaysInMonth(selectedMonth) : getDaysInMonth(new Date());
  const { start: winStart, end: winEnd } = getOtWindow(selectedMonth || new Date());

  function formatValue(val, decimals = 2) {
    const num = Number.parseFloat(val);
    if (!Number.isFinite(num) || num === 0) return "-";
    return num.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }

  function getOtWindow(monthDate) {
    if (!monthDate) return { start: null, end: null };
    const y = monthDate.getFullYear();
    const m = monthDate.getMonth();
    const end = new Date(y, m, 15);
    const start = new Date(y, m - 1, 15);
    return { start, end };
  }

  const sanitizeFilename = (s) =>
    String(s || "")
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, "_")
      .slice(0, 80);

  useEffect(() => {
    const handler = () => setAttendanceUpdatedAt(Date.now());
    const storageHandler = (e) => {
      if (e.key === "attendance:updatedAt") handler();
    };
    window.addEventListener("attendance:saved", handler);
    window.addEventListener("storage", storageHandler);
    return () => {
      window.removeEventListener("attendance:saved", handler);
      window.removeEventListener("storage", storageHandler);
    };
  }, []);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/employees")
      .then((res) => res.json())
      .then((data) => {
        const sorted = [...data].sort((a, b) => {
          const na = parseInt(a.emp_no?.replace(/\D/g, ""), 10);
          const nb = parseInt(b.emp_no?.replace(/\D/g, ""), 10);
          return na - nb;
        });
        setEmployees(sorted);
      })
      .catch(() => setError("Error fetching employees"));
  }, []);

  useEffect(() => {
    const stored = sessionStorage.getItem("salarySelectedMonth");
    if (stored) {
      setSelectedMonth(new Date(stored));
    } else {
      const m = startOfMonth(new Date());
      setSelectedMonth(m);
      sessionStorage.setItem("salarySelectedMonth", m.toISOString());
    }
  }, []);
  useEffect(() => {
    if (selectedMonth) {
      sessionStorage.setItem("salarySelectedMonth", selectedMonth.toISOString());
    }
  }, [selectedMonth]);

  useEffect(() => {
    if (!selectedMonth) return;
    const { start, end } = getOtWindow(selectedMonth);
    if (!start || !end) return;

    const summaryUrl = `http://127.0.0.1:8000/reports/summary?start=${toApi(start)}&end=${toApi(end)}`;
    const firstDay = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
    const lastDay = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0);
    const absencesUrl = `http://127.0.0.1:8000/attendance/absences?start=${toApi(firstDay)}&end=${toApi(lastDay)}`;

    Promise.all([fetch(summaryUrl), fetch(absencesUrl)])
      .then(async ([otRes, absRes]) => {
        if (!otRes.ok) throw new Error("OT fetch failed");
        if (!absRes.ok) throw new Error("Absences fetch failed");
        const otData = await otRes.json();
        const absData = await absRes.json();

        const otMap = {};
        (otData || []).forEach((row) => {
          otMap[row.emp_no] = {
            hrs_not: parseFloat(row.normal_ot) || 0,
            hrs_hot: parseFloat(row.holiday_ot) || 0,
          };
        });
        setOtHoursByEmp(otMap);

        const absMap = {};
        (absData || []).forEach((row) => {
          absMap[row.emp_no] = {
            count: row.count || 0,
            dates: row.dates || [],
          };
        });
        setAbsencesByEmp(absMap);

        setError("");
      })
      .catch((e) => {
        console.error(e);
        setOtHoursByEmp({});
        setAbsencesByEmp({});
        setError("Failed to load OT/Absence data for selected window.");
      });
  }, [selectedMonth, attendanceUpdatedAt]);

  function calculateTotalSalary(emp) {
    const parts = [
      emp.base_pay,
      emp.Food_All,
      emp.WS_Allowance,
      emp.HRA,
      emp.SPL_Allown,
      emp.Fixed_OT,
    ];
    return parts.reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
  }

  function getNonSlAbsenceDays(emp) {
    const dates = absencesByEmp[emp.emp_no]?.dates || [];
    return dates.filter((d) => (String(d.status || "").trim().toUpperCase()) !== "ML").length;
  }

  function calculateBasicEarned(emp) {
    const basic = parseFloat(emp.base_pay) || 0;
    const nonSlAbs = getNonSlAbsenceDays(emp);
    const presentDays = Math.max(0, daysInSelectedMonth - nonSlAbs);
    return (basic / daysInSelectedMonth) * presentDays;
  }

  function calcAbsenceDeduction(emp) {
    const basic = parseFloat(emp.base_pay) || 0;
    const nonSlAbs = getNonSlAbsenceDays(emp);
    return (basic / daysInSelectedMonth) * nonSlAbs;
  }

  function calcOtAmount(emp, hrs) {
    const basic = parseFloat(emp.base_pay) || 0;
    const hourlyBase = basic / 240;
    const notRate = hourlyBase * 1.25;
    const hotRate = hourlyBase * 1.5;
    const notHrs = parseFloat(hrs?.hrs_not) || 0;
    const hotHrs = parseFloat(hrs?.hrs_hot) || 0;
    return notHrs * notRate + hotHrs * hotRate;
  }

  function openDetailModal(emp) {
    const info = absencesByEmp[emp.emp_no] || { dates: [] };
    setDetailModal({ show: true, emp, dates: info.dates });
  }
  const closeModal = () => setDetailModal({ show: false, emp: null, dates: [] });

  // Columns for app + Excel (no zero hiding here)
  const columns = [
    "S.no", "Roll No", "Name", "DOJ",
    "BASIC", "Food All", "W/S Allowance", "HRA", "SPL Allown", "Fixed OT",
    "TOTAL SALARY",
    "ABSENT/ AL/ EL",  "Basic Earned",
    "HRS/ NOT", "HRS/ HOT", "NOT/HOT Amount", "5238 Tank Cleaning", "AT and other Payable", "ALWN",
    "GROSS SALARY", "5% CONTRIBUTION", "ADV", "R/Off", "NET SALARY",
  ];
  const tableColumns = [...columns, "Pay Slip"];

  function getHeaderStyle(col) {
    if (["HRS/ NOT", "HRS/ HOT", "NOT/HOT Amount"].includes(col)) return { backgroundColor: "#e5f99d" };
    if (col === "TOTAL SALARY" || col === "NET SALARY") return { backgroundColor: "#e3dfec" };
    if (col === "GROSS SALARY") return { backgroundColor: "#f0d8c3" };
    if (col === "Absence Deduction" || col === "Absence Days (non-SL)") return { backgroundColor: "#fde2e2" };
    if (col === "Pay Slip") return { backgroundColor: "#ddebf7" };
    return { backgroundColor: "#e9ecdd" };
  }

  function getCellStyle(col, val) {
    const style = {};
    if (col === "ABSENT/ AL/ EL" && Number(val) > 0) style.backgroundColor = "#fff2cc";
    if (col === "Absence Days (non-SL)" && Number(val) > 0) style.backgroundColor = "#fff2cc";
    if (col === "Absence Deduction" && Number(val) > 0) { style.backgroundColor = "#fde2e2"; style.color = "#b91c1c"; }
    if (col === "ADV" && Number(val) < 0) style.color = "red";
    if ((col === "5238 Tank Cleaning" || col === "AT and other Payable") && Number(val) > 0) style.backgroundColor = "#e2dfef";
    if (col === "ALWN" && Number(val) > 0) style.backgroundColor = "#d9ead3";
    if (col === "R/Off" && Number(val) < 0) style.color = "red";
    if (col === "NET SALARY") { style.color = "#b100b1"; style.fontWeight = "bold"; style.backgroundColor = "#e3dfec"; }
    if (col === "TOTAL SALARY") style.backgroundColor = "#e3dfec";
    if (col === "GROSS SALARY") style.backgroundColor = "#f0d8c3";
    if (col === "NOT/HOT Amount") style.backgroundColor = "#e5f99d";
    if (col === "Pay Slip") style.textAlign = "center";
    return style;
  }

  function buildRowData(emp, idx) {
    const hours = otHoursByEmp[emp.emp_no] || { hrs_not: 0, hrs_hot: 0 };
    const notHotAmount = calcOtAmount(emp, hours);
    const absenceAll = absencesByEmp[emp.emp_no]?.count ?? 0;
    const nonSlAbs = getNonSlAbsenceDays(emp);
    const absenceDeduction = calcAbsenceDeduction(emp);

    return {
      "S.no": idx + 1,
      "Roll No": emp.emp_no || "",
      "Name": emp.name || "",
      "DOJ": emp.DOJ || "",
      "BASIC": parseFloat(emp.base_pay) || 0,
      "Food All": parseFloat(emp.Food_All) || 0,
      "W/S Allowance": parseFloat(emp.WS_Allowance) || 0,
      "HRA": parseFloat(emp.HRA) || 0,
      "SPL Allown": parseFloat(emp.SPL_Allown) || 0,
      "Fixed OT": parseFloat(emp.Fixed_OT) || 0,
      "TOTAL SALARY": calculateTotalSalary(emp),
      "ABSENT/ AL/ EL": absenceAll,
      "Absence Days (non-SL)": nonSlAbs,
      "Absence Deduction": absenceDeduction,
      "Basic Earned": calculateBasicEarned(emp),
      "HRS/ NOT": parseFloat(hours.hrs_not) || 0,
      "HRS/ HOT": parseFloat(hours.hrs_hot) || 0,
      "NOT/HOT Amount": notHotAmount,
      "EARNED SALARY": parseFloat(emp.earned_salary) || 0,
      "5238 Tank Cleaning": parseFloat(emp.tank_cleaning) || 0,
      "AT and other Payable": parseFloat(emp.at_other_payable) || 0,
      "ALWN": parseFloat(emp.ALWN) || 0,
      "GROSS SALARY": parseFloat(emp.gross_salary) || (
        calculateBasicEarned(emp) +
        (parseFloat(emp.Food_All) || 0) +
        (parseFloat(emp.WS_Allowance) || 0) +
        (parseFloat(emp.HRA) || 0) +
        (parseFloat(emp.SPL_Allown) || 0) +
        (parseFloat(emp.Fixed_OT) || 0) +
        notHotAmount +
        (parseFloat(emp.ALWN) || 0) +
        (parseFloat(emp.at_other_payable) || 0) +
        (parseFloat(emp.tank_cleaning) || 0)
      ),
      "5% CONTRIBUTION": parseFloat(emp.contrib_5) || 0,
      "ADV": parseFloat(emp.ADV) || 0,
      "R/Off": parseFloat(emp.R_Off) || 0,
      "NET SALARY": parseFloat(emp.net_salary) || 0,
      "OLD": parseFloat(emp.OLD) || 0,
      "Incr/Decr": parseFloat(emp.incr_decr) || 0,
    };
  }

  function handleExport() {
    const dataRows = employees.map((emp, idx) => {
      const row = buildRowData(emp, idx);
      const obj = {};
      columns.forEach((col) => {
        obj[col] = typeof row[col] === "number" ? Number(row[col].toFixed(2)) : row[col];
      });
      return obj;
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(dataRows, { header: columns });
    ws["!freeze"] = { xSplit: 0, ySplit: 1 };
    ws["!cols"] = columns.map((c) => ({ wch: Math.max(12, c.length + 2) }));
    XLSX.utils.book_append_sheet(wb, ws, "Salaries");

    const { start, end } = getOtWindow(selectedMonth || new Date());
    const summary = [
      { Item: "Selected Month", Value: selectedMonth ? format(selectedMonth, "MMMM yyyy") : "" },
      { Item: "OT Window Start", Value: start ? format(start, "dd MMM yyyy") : "" },
      { Item: "OT Window End", Value: end ? format(end, "dd MMM yyyy") : "" },
      { Item: "Generated At", Value: format(new Date(), "dd MMM yyyy HH:mm") },
    ];
    const ws2 = XLSX.utils.json_to_sheet(summary);
    XLSX.utils.book_append_sheet(wb, ws2, "Summary");

    const fileName = `SalarySheet_${selectedMonth ? format(selectedMonth, "yyyy_MM") : "export"}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }

  // ============== PDF generation (hide zero lines; show absence deduction as red negative in Earnings) ==============
  const toNumber = (v) => (v ? parseFloat(v) || 0 : 0);

  function generatePayslipPdf(emp) {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const marginX = 40;

    const monthLabel = selectedMonth ? format(selectedMonth, "MMMM yyyy") : "";
    const { start: ws, end: we } = getOtWindow(selectedMonth || new Date());
    const hours = otHoursByEmp[emp.emp_no] || { hrs_not: 0, hrs_hot: 0 };
    const notHotAmount = calcOtAmount(emp, hours);
    const absenceAll = absencesByEmp[emp.emp_no]?.count ?? 0;

    const basic = toNumber(emp.base_pay);
    const basicEarned = calculateBasicEarned(emp);
    const nonSlAbs = getNonSlAbsenceDays(emp);
    const absenceDeduction = calcAbsenceDeduction(emp);

    const food = toNumber(emp.Food_All);
    const wsAll = toNumber(emp.WS_Allowance);
    const hra = toNumber(emp.HRA);
    const spl = toNumber(emp.SPL_Allown);
    const fixedOt = toNumber(emp.Fixed_OT);
    const alwn = toNumber(emp.ALWN);
    const atOther = toNumber(emp.at_other_payable);
    const tank = toNumber(emp.tank_cleaning);
    const fivePct = toNumber(emp.contrib_5);
    const adv = toNumber(emp.ADV);
    const roff = toNumber(emp.R_Off);

    const gross = toNumber(emp.gross_salary) || (basicEarned + food + wsAll + hra + spl + fixedOt + notHotAmount + alwn + atOther + tank);
    const net = toNumber(emp.net_salary) || (gross - fivePct + adv + roff);

    // Header
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Staff Pay Slip", marginX, 50);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Month: ${monthLabel}`, marginX, 70);
    if (ws && we) doc.text(`OT Window: ${format(ws, "dd MMM yyyy")} - ${format(we, "dd MMM yyyy")}`, marginX, 88);

    // Employee block
    autoTable(doc, {
      startY: 105,
      styles: { fontSize: 10, cellPadding: 6 },
      head: [["Employee No.", "Name", "DOJ"]],
      body: [[emp.emp_no || "-", emp.name || "-", emp.DOJ || "-"]],
      theme: "grid",
      headStyles: { fillColor: [79, 70, 229], textColor: 255 },
      margin: { left: marginX, right: marginX },
    });

    // Earnings / Additions — hide zero rows; add Absence Deduction as red negative
    const earningsPairs = [
      ["BASIC", basic],
      //["Basic Earned", basicEarned],
      ["Food All", food],
      ["W/S Allowance", wsAll],
      ["HRA", hra],
      ["SPL Allown", spl],
      ["Fixed OT", fixedOt],
      ["NOT/HOT Amount", notHotAmount],
      ["ALWN", alwn],
      ["AT and other Payable", atOther],
      ["5238 Tank Cleaning", tank],
    ];
    const earningsRows = earningsPairs
      .filter(([_, v]) => Number(v) !== 0)
      .map(([k, v]) => [k, v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })]);

    if (absenceDeduction > 0) {
      earningsRows.push([
        { content: "Absence Deduction (from BASIC)", styles: { textColor: [185, 28, 28] } },
        { content: `- ${absenceDeduction.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, styles: { textColor: [185, 28, 28], halign: "right" } },
      ]);
    }

    const earningsStartY = (doc.lastAutoTable?.finalY || 120) + 15;
    autoTable(doc, {
      startY: earningsStartY,
      styles: { fontSize: 10, cellPadding: 6 },
      head: [["Earnings / Additions", "Amount"]],
      body: earningsRows,
      theme: "striped",
      columnStyles: { 0: { halign: "left" }, 1: { halign: "right" } },
      headStyles: { fillColor: [34, 197, 94], textColor: 255 },
      margin: { left: marginX, right: marginX },
      // keep gross as-is (based on Basic Earned) to avoid double deduction
      foot: [["GROSS SALARY", gross.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })]],
      footStyles: { fillColor: [240, 216, 195], halign: "right", textColor: 0, fontStyle: "bold" },
    });

    // Deductions — hide zero rows
    const dedPairs = [
      ["5% CONTRIBUTION", fivePct],
      ["ADV", adv],
      ["R/Off", roff],
    ];
    const dedRows = dedPairs
      .filter(([_, v]) => Number(v) !== 0)
      .map(([k, v]) => [k, v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })]);

    const dedStartY = (doc.lastAutoTable?.finalY || earningsStartY) + 15;
    if (dedRows.length) {
      autoTable(doc, {
        startY: dedStartY,
        styles: { fontSize: 10, cellPadding: 6 },
        head: [["Deductions / Adjustments", "Amount"]],
        body: dedRows,
        theme: "grid",
        columnStyles: { 0: { halign: "left" }, 1: { halign: "right" } },
        headStyles: { fillColor: [239, 68, 68], textColor: 255 },
        margin: { left: marginX, right: marginX },
        foot: [["NET SALARY", net.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })]],
        footStyles: { fillColor: [227, 223, 236], halign: "right", textColor: [177, 0, 177], fontStyle: "bold" },
      });
    } else {
      // still show NET if no deductions rendered
      const y = (doc.lastAutoTable?.finalY || earningsStartY) + 15;
      autoTable(doc, {
        startY: y,
        styles: { fontSize: 10, cellPadding: 6 },
        body: [["NET SALARY", net.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })]],
        theme: "plain",
        columnStyles: { 0: { halign: "left" }, 1: { halign: "right" } },
        margin: { left: marginX, right: marginX },
      });
    }
    const medicalLeaveDays = absenceAll - nonSlAbs;

    // Attendance & OT summary — hide zero rows except Days in Month
    const attPairs = [
      ["Days in Month", daysInSelectedMonth, true],
      ...(medicalLeaveDays > 0 ? [["Medical Leave", medicalLeaveDays, false]] : []),
      ["Absence Days (non-SL)", nonSlAbs, false],
      ["HRS/NOT", (hours.hrs_not || 0), false],
      ["HRS/HOT", (hours.hrs_hot || 0), false],
    ];
    const attRows = attPairs
      .filter(([_, v, always]) => always || Number(v) !== 0)
      .map(([k, v]) => [
        k,
        typeof v === "number"
          ? (k.startsWith("HRS/") ? v.toFixed(2) : v.toLocaleString("en-US"))
          : String(v),
      ]);

    const infoStartY = (doc.lastAutoTable?.finalY || dedStartY) + 18;
    if (attRows.length) {
      autoTable(doc, {
        startY: infoStartY,
        styles: { fontSize: 10, cellPadding: 6 },
        head: [["Attendance/OT", "Value"]],
        body: attRows,
        theme: "plain",
        columnStyles: { 0: { halign: "left" }, 1: { halign: "right" } },
        margin: { left: marginX, right: marginX },
      });
    }

    // Footer
    const yEnd = (doc.lastAutoTable?.finalY || infoStartY) + 30;
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text("This is a system-generated pay slip.", marginX, yEnd);

    return doc.output("blob");
  }

  function handleDownloadPayslip(emp) {
    const blob = generatePayslipPdf(emp);
    const base = sanitizeFilename(emp.name || emp.emp_no || "Employee");
    const fname = `Payslip_${base}_${selectedMonth ? format(selectedMonth, "yyyy_MM") : "export"}.pdf`;
    saveAs(blob, fname);
  }

  async function handleExportAllPayslipsZip() {
    const zip = new JSZip();
    const month = selectedMonth ? format(selectedMonth, "yyyy_MM") : "export";
    for (const emp of employees) {
      const blob = generatePayslipPdf(emp);
      const base = sanitizeFilename(emp.name || emp.emp_no || "Employee");
      zip.file(`Payslip_${base}_${month}.pdf`, blob);
    }
    const zipBlob = await zip.generateAsync({ type: "blob" });
    saveAs(zipBlob, `Payslips_${month}.zip`);
  }

  return (
    <div className="container-fluid my-4">
      {/* Custom modal styles */}
      <style>{`
        .custom-absence-modal .modal-content {
          border-radius: 16px;
          border: none;
          box-shadow: 0 10px 30px rgba(0,0,0,0.2);
          background: #fff;
          animation: scaleIn 0.25s ease-out;
        }
        .custom-absence-modal .modal-header {
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          color: white;
          border-bottom: none;
          border-top-left-radius: 16px;
          border-top-right-radius: 16px;
        }
        .custom-absence-modal .modal-title {
          font-size: 1.3rem;
          font-weight: 600;
        }
        .custom-absence-modal .modal-body {
          font-size: 1rem;
          padding: 1.5rem;
          max-height: 400px;
          overflow-y: auto;
        }
        .custom-absence-modal .modal-footer {
          border-top: none;
          padding: 1rem 1.5rem;
        }
        @keyframes scaleIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>

      <h2 className="text-center fw-bold mb-3">Staff Salaries</h2>

      {/* Month picker + actions */}
      <div className="bg-white border rounded shadow-sm p-3 mb-3">
        <div className="d-flex gap-2 flex-wrap align-items-end">
          <div className="d-flex flex-column">
            <label className="form-label">Select Month</label>
            <DatePicker
              selected={selectedMonth}
              onChange={(d) => setSelectedMonth(d)}
              dateFormat="MMMM yyyy"
              showMonthYearPicker
              className="form-control"
              placeholderText="Choose month"
            />
          </div>

          <button className="btn btn-secondary" onClick={() => setAttendanceUpdatedAt(Date.now())}>
            Refresh Data
          </button>

          <button className="btn btn-success" onClick={handleExport}>
            Export to Excel
          </button>

          <div className="vr d-none d-md-block" />

          <button className="btn btn-outline-primary" onClick={handleExportAllPayslipsZip}>
            Export All Pay Slips (ZIP)
          </button>

          {error && <div className="text-danger fw-semibold ms-auto">{error}</div>}
        </div>
        <small className="text-muted">
          OT window is <strong>15th of previous month</strong> to <strong>15th of selected month</strong>. Absence count shows <strong>all non-P</strong>. Basic Earned ignores <strong>SL</strong>.
          {winStart && winEnd && (
            <>
              {" "}Current window:&nbsp;
              <strong>{format(winStart, "dd MMM yyyy")}</strong> → <strong>{format(winEnd, "dd MMM yyyy")}</strong>
            </>
          )}
        </small>
      </div>

      {/* Table */}
      <div className="table-responsive">
        <table className="table table-bordered table-sm text-nowrap">
          <thead>
            <tr>
              {tableColumns.map((col, idx) => (
                <th key={idx} className="text-center align-middle small" style={getHeaderStyle(col)}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.map((emp, idx) => {
              const row = buildRowData(emp, idx);
              const absenceAll = row["ABSENT/ AL/ EL"];
              return (
                <tr key={emp.emp_no}>
                  {tableColumns.map((col) => {
                    if (col === "Pay Slip") {
                      return (
                        <td key={`${emp.emp_no}-payslip`} style={getCellStyle(col)}>
                          <button
                            className="btn btn-outline-primary btn-sm"
                            onClick={() => handleDownloadPayslip(emp)}
                            title="Download pay slip (PDF)"
                          >
                            ⬇️ Pay Slip
                          </button>
                        </td>
                      );
                    }
                    if (col === "ABSENT/ AL/ EL") {
                      return (
                        <td
                          key={`${emp.emp_no}-absall`}
                          style={{
                            ...getCellStyle(col, absenceAll),
                            cursor: absenceAll ? "pointer" : "default",
                            color: absenceAll ? "blue" : "inherit",
                            textDecoration: absenceAll ? "underline dotted" : "none",
                          }}
                          title={absenceAll ? "Click to view absence details" : ""}
                          onClick={() => absenceAll && openDetailModal(emp)}
                        >
                          {absenceAll > 0 ? (
                            <>
                              {absenceAll} <span style={{ fontSize: "0.8em", opacity: 0.6 }}>⬅️📅</span>
                            </>
                          ) : (
                            absenceAll
                          )}
                        </td>
                      );
                    }

                    const raw = row[col];
                    const isNumeric = typeof raw === "number";
                    return (
                      <td key={`${emp.emp_no}-${col}`} style={getCellStyle(col, raw)}>
                        {isNumeric
                            ? (col === "S.no"
                                ? raw // show as integer without .00
                                : col === "Absence Days (on-Medical Absence)"
                                  ? formatValue(raw, 0)
                                  : formatValue(raw))
                            : (raw || "")}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Absence details modal */}
      {detailModal.show && (
        <div className="modal custom-absence-modal" style={{ display: "block", background: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  Absence details — {detailModal.emp?.emp_no} {detailModal.emp?.name ? `(${detailModal.emp.name})` : ""}
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={closeModal}></button>
              </div>
              <div className="modal-body">
                {(detailModal.dates || []).length ? (
                  <ul className="list-group">
                    {detailModal.dates.map((d, i) => (
                      <li key={i} className="list-group-item">
                        ‣ {format(new Date(d.date), "dd MMM yyyy")} — <strong>{String(d.status || "").trim().toUpperCase()}</strong>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mb-0">No absence dates found.</p>
                )}
              </div>

              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={closeModal}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getOtWindow(monthDate) {
  if (!monthDate) return { start: null, end: null };
  const y = monthDate.getFullYear();
  const m = monthDate.getMonth();
  const end = new Date(y, m, 15);
  const start = new Date(y, m - 1, 15);
  return { start, end };
}
