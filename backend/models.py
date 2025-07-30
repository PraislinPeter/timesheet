from sqlalchemy import Column, Integer, String, Date, Time, DECIMAL, ForeignKey, Text
from database import Base

class Trade(Base):
    __tablename__ = "trades"
    id = Column(Integer, primary_key=True)
    trade_name = Column(String(50), unique=True, nullable=False)

class Employee(Base):
    __tablename__ = "employees"
    emp_no = Column(String(20), primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    base_pay = Column(DECIMAL(10, 2), nullable=False, default=0.00)

class Timesheet(Base):
    __tablename__ = "timesheets"
    id = Column(Integer, primary_key=True)
    date = Column(Date, nullable=False)
    job_no = Column(String(50))
    ship = Column(String(100))
    site = Column(String(100))
    sheet_no = Column(String(50))
    checked_by = Column(String(100))
    authorized_by = Column(String(100))
    for_company = Column(String(100))

class TimesheetEntry(Base):
    __tablename__ = "timesheet_entries"
    id = Column(Integer, primary_key=True)
    timesheet_id = Column(Integer, ForeignKey("timesheets.id", ondelete="CASCADE"), nullable=False)
    employee_emp_no = Column(String(20), ForeignKey("employees.emp_no"), nullable=False)
    trade_id = Column(Integer, ForeignKey("trades.id"), nullable=True)
    from_time = Column(Time, nullable=False)
    to_time = Column(Time, nullable=False)
    break_minutes = Column(Integer, default=0)
    total_hours = Column(DECIMAL(5, 2))
    remarks = Column(Text)

