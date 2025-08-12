from sqlalchemy import Column, Integer, String, Date, Time, DECIMAL, ForeignKey, Text, Enum, UniqueConstraint, func, DateTime, Computed, Numeric, Index
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base
import enum

class Trade(Base):
    __tablename__ = "trades"
    id = Column(Integer, primary_key=True)
    trade_name = Column(String(50), unique=True, nullable=False)

class Employee(Base):
    __tablename__ = "employees"

    emp_no = Column(String(20), primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    DOJ = Column(Date, nullable=False)
    base_pay = Column(DECIMAL(12, 2), nullable=True)
    Food_All = Column(DECIMAL(12, 2))
    WS_Allowance = Column(DECIMAL(12, 2))
    HRA = Column(DECIMAL(12, 2))
    SPL_Allown = Column(DECIMAL(12, 2))
    Fixed_OT = Column(DECIMAL(12, 2))
    OT = Column(Enum('YES', 'NO'), nullable=False)

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

class Attendance(Base):
    __tablename__ = "attendance"

    emp_no = Column(String(32), ForeignKey("employees.emp_no", onupdate="CASCADE", ondelete="RESTRICT"), primary_key=True)
    att_date = Column(Date, primary_key=True)  # Composite PK with emp_no
    status = Column(String(8), nullable=False, default="A")  # P, A, AL, EL, ML
    notes = Column(Text)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    employee = relationship("Employee", backref="attendance_records")

class AdvanceType(enum.Enum):
    ADVANCE = "advance"
    INCREASE = "increase"
    PAYMENT = "payment"
    DEFER = "defer"

class AdvanceAccount(Base):
    __tablename__ = "advance_accounts"

    emp_no = Column(String(20), primary_key=True)
    advance = Column(Numeric(12, 2), nullable=False, default=0)
    monthly_installment = Column(Numeric(12, 2), nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    transactions = relationship(
        "AdvanceTxn",
        back_populates="account",
        cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<AdvanceAccount(emp_no={self.emp_no}, advance={self.advance}, monthly_installment={self.monthly_installment})>"

class AdvanceTxn(Base):
    __tablename__ = "advance_txns"

    id = Column(Integer, primary_key=True, autoincrement=True)
    emp_no = Column(String(20), ForeignKey("advance_accounts.emp_no", onupdate="CASCADE", ondelete="CASCADE"), nullable=False)
    ts = Column(Date, nullable=False)  # transaction date
    ym = Column(String(7), Computed("DATE_FORMAT(ts, '%Y-%m')", persisted=True))
    
    type = Column(
        Enum(
            AdvanceType,
            name="adv_type",
            native_enum=False,
            values_callable=lambda enum_cls: [e.value for e in enum_cls]  # lowercase mapping
        ),
        nullable=False
    )
    
    amount = Column(Numeric(12, 2), nullable=False)
    note = Column(String(255))
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    account = relationship("AdvanceAccount", back_populates="transactions")

    __table_args__ = (
        Index("ix_adv_txns_emp", "emp_no"),
        Index("ix_adv_txns_emp_ym", "emp_no", "ym"),
        Index("ix_adv_txns_ym_type", "ym", "type"),
    )

    def __repr__(self):
        return f"<AdvanceTxn(emp_no={self.emp_no}, type={self.type}, amount={self.amount}, ts={self.ts})>"
