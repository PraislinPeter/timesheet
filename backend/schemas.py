from pydantic import BaseModel, Field
from typing import List, Optional, Annotated
from datetime import date, time

# Input model for a timesheet entry
class TimesheetEntryIn(BaseModel):
    employee_emp_no: str
    trade_id: int
    from_time: time
    to_time: time
    break_minutes: Optional[int] = 0
    total_hours: float
    remarks: Optional[str] = ""

# Input model for a full timesheet with entries
class TimesheetIn(BaseModel):
    date: date
    job_no: str
    ship: str
    site: str
    sheet_no: str
    checked_by: str
    authorized_by: str
    for_company: str
    entries: List[TimesheetEntryIn]

# Output model for an employee (without trade string now)
class EmployeeOut(BaseModel):
    emp_no: str
    name: str
    base_pay: float

    class Config:
        orm_mode = True

# Output for reporting summaries
class ReportOut(BaseModel):
    employee_name: str
    total_hours: float
    range: str

class TimesheetEntryOut(BaseModel):
    id: int
    employee_emp_no: str
    employee_name: Optional[str]= None
    trade_id: int
    trade_name: Optional[str]= None
    from_time: time
    to_time: time
    break_minutes: int
    total_hours: float
    remarks: Optional[str]= None
     
    model_config = {
        "from_attributes": True  # Pydantic v2
    }

# Output model for a full timesheet
class TimesheetOut(BaseModel):
    id: int
    job_no: str
    site: str
    ship: str
    checked_by: str
    authorized_by: str
    for_company: str
    date: date
    entries: List[TimesheetEntryOut]

    model_config = {
        "from_attributes": True
    }

# Partial update model for a timesheet entry
class TimesheetEntryUpdate(BaseModel):
    employee_emp_no: Optional[str] = None
    trade_id: Optional[int] = None
    from_time: Optional[time] = None
    to_time: Optional[time] = None
    break_minutes: Optional[int] = None
    total_hours: Optional[float] = None
    remarks: Optional[str] = None

# Partial update model for timesheet metadata
class TimesheetUpdate(BaseModel):
    date: Annotated[Optional[date], Field(default=None)]
    job_no: Optional[str] = None
    ship: Optional[str] = None
    site: Optional[str] = None
    sheet_no: Optional[str] = None
    checked_by: Optional[str] = None
    authorized_by: Optional[str] = None
    for_company: Optional[str] = None

# schemas.py
class TradeOut(BaseModel):
    id: int
    trade_name: str

    class Config:
        orm_mode = True









