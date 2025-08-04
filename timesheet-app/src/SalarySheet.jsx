import React from "react";

const SalarySheet = () => {
  const columns = [
    "S.no", "Roll No", "Name", "DOJ", "BASIC (OLD)", "Food All", "W/S Allowance",
    "HRA", "SPL Allown", "Fixed OT", "TOTAL SALARY", "CURRENT MONTH", "ML",
    "ABSENT/ AL/ EL", "Earned Att'n", "Basic Earned", "NOT", "HOT", "HRS/ NOT",
    "HRS/ HOT", "NOT", "HOT", "NOT/HOT HRS", "NOT/HOT Amount", "EARNED SALARY",
    "5238 Tank Cleaning", "AT and other Payable", "ALWN", "GROSS SALARY",
    "5% CONTRIBUTION", "ADV", "R/Off", "NET SALARY", "OLD", "Incr/Decr"
  ];

  const sampleRow = {
    "S.no": 1,
    "Roll No": "AMC 5001",
    Name: "PETER ANTONY FERNANDO",
    DOJ: "1-Jun-22",
    "ABSENT/ AL/ EL": "20.00",
    ADV: "-126.00",
    "5238 Tank Cleaning": "1110.00",
    "AT and other Payable": "407.50",
    ALWN: "500.00",
    "NET SALARY": "70,000.00",
    "R/Off": "-0.42",
    OLD: "70,000.00",
    "TOTAL SALARY": "70,000.00",
    "GROSS SALARY": "70,000.00",
    "NOT/HOT HRS": "78.00",
    "NOT/HOT Amount": "1000.00"
  };

  const getHeaderStyle = (col) => {
    if (col === "TOTAL SALARY") return { backgroundColor: "#e3dfec" }; // Velvet Scarf
    if (col === "GROSS SALARY") return { backgroundColor: "#f0d8c3" }; // Warm beige
    if (["NOT/HOT HRS", "NOT/HOT Amount"].includes(col)) return { backgroundColor: "#e5f99d" }; // Green
    if (col === "NET SALARY") return { backgroundColor: "#e3dfec" }; // Velvet Scarf again
    return { backgroundColor: "#e9ecdd" }; // Tint Of Mint (default)
  };

  const getCellStyle = (col, val) => {
    let style = {};

    if (col === "ABSENT/ AL/ EL" && parseFloat(val) > 0) {
      style.backgroundColor = "#fff2cc";
    }
    if (col === "ADV" && (val.includes("(") || parseFloat(val) < 0)) {
      style.color = "red";
    }
    if ((col === "5238 Tank Cleaning" || col === "AT and other Payable") && parseFloat(val) > 0) {
      style.backgroundColor = "#e2dfef";
    }
    if (col === "ALWN" && parseFloat(val) > 0) {
      style.backgroundColor = "#d9ead3";
    }
    if (col === "R/Off" && parseFloat(val) < 0) {
      style.color = "red";
    }
    if (col === "NET SALARY") {
      style.color = "#b100b1";
      style.fontWeight = "bold";
      style.backgroundColor = "#e3dfec";
    }
    if (col === "TOTAL SALARY") {
      style.backgroundColor = "#e3dfec";
    }
    if (col === "GROSS SALARY") {
      style.backgroundColor = "#f0d8c3";
    }
    if (["NOT/HOT HRS", "NOT/HOT Amount"].includes(col)) {
      style.backgroundColor = "#e5f99d";
    }

    return style;
  };

  const rows = new Array(5).fill(null).map((_, rowIdx) => (
    <tr key={rowIdx}>
      {columns.map((col, colIdx) => {
        const value = sampleRow[col] ?? "--";
        const style = getCellStyle(col, value);
        return (
          <td key={colIdx} className="text-center py-1 px-2" style={style}>
            {value}
          </td>
        );
      })}
    </tr>
  ));

  return (
    <div className="container-fluid my-4">
      <h2 className="text-center fw-bold mb-3">Staff Salaries - July 2025</h2>
      <div className="table-responsive">
        <table className="table table-bordered table-sm text-nowrap">
          <thead>
            <tr>
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  className="text-center align-middle small"
                  style={getHeaderStyle(col)}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>
      </div>
    </div>
  );
};

export default SalarySheet;
