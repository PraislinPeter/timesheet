from pydantic import BaseModel, Field, validator
from typing import List, Optional, Annotated, Literal
from decimal import Decimal
from datetime import date, time


# Input model for a timesheet entry
class TimesheetEntryIn(BaseModel):
    employee_emp_no: str
    trade_id: Optional[int] = None
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

class EmployeeOut(BaseModel):
    emp_no: str
    name: str
    DOJ: date
    base_pay: Optional[Decimal]
    Food_All: Optional[Decimal]
    WS_Allowance: Optional[Decimal]
    HRA: Optional[Decimal]
    SPL_Allown: Optional[Decimal]
    Fixed_OT: Optional[Decimal]
    OT: Literal['YES', 'NO']

    class Config:
        from_attributes = True 

# Output for reporting summaries
class ReportOut(BaseModel):
    employee_name: str
    total_hours: float
    range: str

class TimesheetEntryOut(BaseModel):
    id: int
    employee_emp_no: str
    employee_name: Optional[str]= None
    trade_id: Optional[int] = None
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

class AttendanceItemIn(BaseModel):
    emp_no: str
    status: str = Field(pattern="^(P|A|AL|EL|ML)$")
    notes: Optional[str] = ""

class AttendanceBulkIn(BaseModel):
    date: date
    records: List[AttendanceItemIn]

class AttendanceItemOut(BaseModel):
    emp_no: str
    att_date: date
    status: str
    notes: Optional[str] = ""

class AdvanceCreateIn(BaseModel):
    emp_no: str = Field(..., example="AMC 5001")
    amount: float = Field(..., gt=0, example=5000.0)
    monthly_installment: float = Field(..., gt=0, example=500.0)
    ts: date = Field(default_factory=date.today, example="2025-08-15")
    note: Optional[str] = Field(default="Advance given")

class AdvanceCreateOut(BaseModel):
    message: str
    emp_no: str
    advance_amount: float
    monthly_installment: float
    payment_inserted: bool
    balance: float

class PaymentUpdateIn(BaseModel):
    amount: float = Field(..., description="New payment amount (<= 0). Use 0 to defer.")
    note: Optional[str] = None

    @validator("amount")
    def must_be_zero_or_negative(cls, v):
        if v > 0:
            raise ValueError("Payment amount must be <= 0 (use 0 to defer).")
        return v

class PaymentUpdateOut(BaseModel):
    message: str
    emp_no: str
    ym: str
    amount: float
    deferred: bool
    balance: float

class IncreaseAdvanceIn(BaseModel):
    emp_no: str = Field(..., example="AMC 5001")
    amount: float = Field(..., gt=0, example=1500.0)
    ts: date = Field(default_factory=date.today, example="2025-08-20")
    note: Optional[str] = Field(default="Advance increased")

class IncreaseAdvanceOut(BaseModel):
    message: str
    emp_no: str
    amount: float
    balance: float

class InstallmentUpdateIn(BaseModel):
    monthly_installment: float = Field(..., gt=0, example=800.0)
    ym: Optional[str] = Field(default=None, example="2025-08")  # which month to apply
    apply_to_month: bool = Field(default=True)
    note: Optional[str] = Field(default="Installment changed")

class InstallmentUpdateOut(BaseModel):
    message: str
    emp_no: str
    monthly_installment: float
    ym: str
    payment_adjusted: bool
    balance: float

class BalanceOut(BaseModel):
    emp_no: str
    balance: float
    monthly_installment: Optional[float] = 0.0