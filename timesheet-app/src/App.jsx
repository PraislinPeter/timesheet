import React from "react";
import { Routes, Route } from "react-router-dom";
import Navbar from "./Navbar";
import TimesheetForm from "./TimesheetForm";
import TimesheetReport from "./TimesheetReport";
import TimesheetManager from "./TimesheetManager";
import TimesheetViewer from "./TimesheetViewer";
import TimesheetDetail from "./TimesheetDetail";
import SalarySheet from "./SalarySheet";
import AttendanceSheet from "./attendance";
import AttendanceViewer from "./AttendanceViewer";
import './App.css';
import AttendanceHome from "./AttendanceHome";
import JobHoursReport from "./jobhours";
import AdvanceAdmin from "./AdvanceAdmin"; // ✅ NEW

const App = () => {
  return (
    <div className="d-flex">
      <Navbar />
      <div style={{ marginLeft: "300px", padding: "20px", width: "100%" }}>
        <Routes>
          <Route path="/" element={<TimesheetForm />} />
          <Route path="/salary" element={<SalarySheet />} />
          <Route path="/total-hours" element={<TimesheetReport />} />
          <Route path="/manage-timesheets" element={<TimesheetManager />} />
          <Route path="/timesheet/:id" element={<TimesheetDetail />} />
          <Route path="/timesheets/view" element={<TimesheetViewer />} />
          <Route path="/attendance/add" element={<AttendanceSheet />} />
          <Route path="/attendance/view" element={<AttendanceViewer />} />
          <Route path="/attendance" element={<AttendanceHome />} />
          <Route path="/job-hours" element={<JobHoursReport />} />
+         <Route path="/advances" element={<AdvanceAdmin />} /> {/* ✅ NEW */}
        </Routes>
      </div>
    </div>
  );
};
export default App;
