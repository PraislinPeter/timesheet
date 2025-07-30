import React, { useState } from "react";

const time = () => {
  const [time, setTime] = useState("");

  const handleChange = (e) => {
    setTime(e.target.value);
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <label htmlFor="timeInput" style={{ marginRight: "10px" }}>
        Select Time:
      </label>
      <input
        id="timeInput"
        type="time"
        value={time}
        onChange={handleChange}
        style={{ padding: "5px", fontSize: "16px" }}
      />
      <p style={{ marginTop: "10px" }}>Selected Time: {time || "None"}</p>
    </div>
  );
};

export default time;
