from decimal import Decimal
from fastapi import FastAPI, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from database import Base, engine, SessionLocal
from models import Timesheet, TimesheetEntry, Trade, Employee, Attendance, AdvanceAccount, AdvanceTxn, AdvanceType
from schemas import TimesheetIn, TimesheetEntryUpdate, TimesheetOut, TimesheetEntryIn, ReportOut, EmployeeOut, TimesheetEntryOut, TimesheetUpdate, TradeOut, AttendanceItemIn, AttendanceItemOut, AttendanceBulkIn, AdvanceCreateIn, AdvanceCreateOut, PaymentUpdateIn, PaymentUpdateOut, InstallmentUpdateIn, InstallmentUpdateOut, IncreaseAdvanceIn, IncreaseAdvanceOut, BalanceOut
from fastapi.middleware.cors import CORSMiddleware
from scheduler import start_scheduler, stop_scheduler, run_monthly_auto_deductions
from models import Employee
from schemas import EmployeeOut
from typing import List
import models
from datetime import datetime, date, time
from collections import defaultdict  
from models import Timesheet, TimesheetEntry
from sqlalchemy.orm import aliased
from datetime import timedelta



Base.metadata.create_all(bind=engine)

app = FastAPI()

# CORS for React
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/employees", response_model=List[EmployeeOut])
def get_employees(db: Session = Depends(get_db)):
    return db.query(Employee).all()





@app.post("/timesheets")
def create_timesheet(timesheet: TimesheetIn, db: Session = Depends(get_db)):
    ts = Timesheet(**{k: v for k, v in timesheet.dict().items() if k != "entries"})
    db.add(ts)
    db.commit()
    db.refresh(ts)

    for entry in timesheet.entries:
        entries_to_add = []

        if entry.from_time > entry.to_time:
            # ✅ Split logic fix: assign full break to Part 1, zero to Part 2
            first_hours = (
                (datetime.combine(datetime.today(), time(23, 59)) -
                 datetime.combine(datetime.today(), entry.from_time)).seconds
                - (entry.break_minutes * 60)
            ) / 3600.0

            part1 = TimesheetEntry(
                timesheet_id=ts.id,
                employee_emp_no=entry.employee_emp_no,
                trade_id=entry.trade_id,
                from_time=entry.from_time,
                to_time=time(23, 59),
                break_minutes = entry.break_minutes,  # ✅ full break here
                total_hours=round(first_hours, 2),
                remarks="Split overnight entry (Part 1)"
            )
            entries_to_add.append((ts.date, entry.employee_emp_no, first_hours, part1))

            # Create timesheet for next day
            new_ts_date = ts.date + timedelta(days=1)
            new_ts = Timesheet(**{**timesheet.dict(exclude={"entries"}), "date": new_ts_date})
            db.add(new_ts)
            db.commit()
            db.refresh(new_ts)

            second_hours = (
                (datetime.combine(datetime.today(), entry.to_time) -
                 datetime.combine(datetime.today(), time(0, 0))).seconds
            ) / 3600.0

            part2 = TimesheetEntry(
                timesheet_id=new_ts.id,
                employee_emp_no=entry.employee_emp_no,
                trade_id=entry.trade_id,
                from_time=time(0, 0),
                to_time=entry.to_time,
                break_minutes=0,  # ✅ no break on Day 2
                total_hours=round(second_hours, 2),
                remarks=f"Split overnight entry (Part 2 from timesheet {ts.sheet_no})"
            )
            entries_to_add.append((new_ts_date, entry.employee_emp_no, second_hours, part2))

        else:
            # Normal entry, nothing changes
            normal_entry = TimesheetEntry(
                timesheet_id=ts.id,
                **entry.dict()
            )
            entries_to_add.append((ts.date, entry.employee_emp_no, entry.total_hours, normal_entry))

    for entry_date, emp_no, hours, entry_obj in entries_to_add:
        # Check if total exceeds 24 hours
        total_existing_hours = db.query(func.coalesce(func.sum(TimesheetEntry.total_hours), 0))\
            .join(Timesheet)\
            .filter(Timesheet.date == entry_date, TimesheetEntry.employee_emp_no == emp_no)\
            .scalar()

        employee = db.query(Employee).filter(Employee.emp_no == emp_no).first()
        emp_name = employee.name if employee else "Unknown"

        if total_existing_hours + Decimal(str(hours)) > Decimal("24"):
            raise HTTPException(
                status_code=400,
                detail=f"Total hours for employee {emp_no} ({emp_name}) on {entry_date} exceed 24 hours."
            )

        db.add(entry_obj)

    db.commit()
    return {"message": "Timesheet(s) created successfully"}



def get_date_range(start: date, end: date):
    current = start
    while current <= end:
        yield current
        current += timedelta(days=1)

@app.get("/reports/summary")
def get_summary(start: date = Query(...), end: date = Query(...), db: Session = Depends(get_db)):
    # 1. Build full date list
    all_dates = [d.strftime("%Y-%m-%d") for d in get_date_range(start, end)]

    # 2. Get timesheets and entries
    timesheets = db.query(Timesheet).filter(Timesheet.date >= start, Timesheet.date <= end).all()
    timesheet_map = {ts.id: ts.date for ts in timesheets}
    timesheet_ids = list(timesheet_map.keys())

    # 3. Get all employees
    employees = db.query(Employee).all()
    employee_map = {emp.emp_no: emp.name for emp in employees}

    # 4. Initialize report structure
    report = {
        emp.emp_no: {
            "emp_no": emp.emp_no,
            "employee_name": emp.name,
            "OT": emp.OT,
            "entries_by_date": {
                date_str: {"total_hours": 0.0, "timesheet_ids": []}
                for date_str in all_dates
            }
        }
        for emp in employees
    }

    # 5. Fill in timesheet entries
    if timesheet_ids:
        entries = db.query(TimesheetEntry).filter(TimesheetEntry.timesheet_id.in_(timesheet_ids)).all()

        for entry in entries:
            emp_id = entry.employee_emp_no
            if emp_id not in report:
                continue
            ts_date = timesheet_map[entry.timesheet_id].strftime("%Y-%m-%d")
            entry_data = report[emp_id]["entries_by_date"][ts_date]
            entry_data["total_hours"] += float(entry.total_hours or 0)
            entry_data["timesheet_ids"].append(entry.timesheet_id)

    # 6. Calculate total, normal OT, holiday OT
    for emp in report.values():
        total = 0.0
        hot = 0.0
        not_ = 0.0

        for date_str, entry in emp["entries_by_date"].items():
            hrs = entry["total_hours"]
            total += hrs
            dt = datetime.strptime(date_str, "%Y-%m-%d")
            if dt.weekday() == 6:  # Sunday
                hot += hrs
            elif hrs > 8:
                not_ += hrs - 8

        emp["total_hours"] = round(total, 2)
        emp["holiday_ot"] = round(hot, 2)
        emp["normal_ot"] = round(not_, 2)

    return list(report.values())

@app.get("/timesheets", response_model=List[TimesheetOut])
def get_all_timesheets(db: Session = Depends(get_db)):
    timesheets = db.query(Timesheet).all()
    for ts in timesheets:
        ts.entries = db.query(TimesheetEntry).filter_by(timesheet_id=ts.id).all()
    return timesheets

@app.put("/time-entries/{entry_id}")
def update_time_entry(entry_id: int, data: TimesheetEntryUpdate, db: Session = Depends(get_db)):
    entry = db.query(TimesheetEntry).filter_by(id=entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    
    for key, value in data.dict(exclude_unset=True).items():
        setattr(entry, key, value)

    db.commit()
    db.refresh(entry)
    return {"message": "Entry updated", "entry": entry.id}

@app.get("/timesheets/details", response_model=List[TimesheetOut])
def get_timesheets_by_ids(timesheet_ids: List[int] = Query(...), db: Session = Depends(get_db)):
    timesheets = db.query(Timesheet).filter(Timesheet.id.in_(timesheet_ids)).all()
    if not timesheets:
        raise HTTPException(status_code=404, detail="No timesheets found for provided IDs")

    for timesheet in timesheets:
        entries = (
            db.query(
                TimesheetEntry.id,
                TimesheetEntry.employee_emp_no,
                Employee.name.label("employee_name"),
                TimesheetEntry.trade_id,
                Trade.trade_name.label("trade_name"),
                TimesheetEntry.from_time,
                TimesheetEntry.to_time,
                TimesheetEntry.break_minutes,
                TimesheetEntry.total_hours,
                TimesheetEntry.remarks,
            )
            .join(Employee, TimesheetEntry.employee_emp_no == Employee.emp_no)
            .outerjoin(Trade, TimesheetEntry.trade_id == Trade.id)  # ✅ outer join
            .filter(TimesheetEntry.timesheet_id == timesheet.id)
            .all()
        )

        timesheet.entries = [
            {
                "id": entry.id,
                "employee_emp_no": entry.employee_emp_no,
                "employee_name": entry.employee_name,
                "trade_id": entry.trade_id,
                "trade_name": entry.trade_name or "N/A",  # ✅ default to "N/A"
                "from_time": entry.from_time.strftime("%H:%M") if entry.from_time else None,
                "to_time": entry.to_time.strftime("%H:%M") if entry.to_time else None,
                "break_minutes": entry.break_minutes,
                "total_hours": entry.total_hours,
                "remarks": entry.remarks
            }
            for entry in entries
        ]

    return timesheets


@app.get("/timesheets/{timesheet_id}", response_model=TimesheetOut)
def get_timesheet_by_id(timesheet_id: int, db: Session = Depends(get_db)):
    timesheet = db.query(Timesheet).filter(Timesheet.id == timesheet_id).first()
    if not timesheet:
        raise HTTPException(status_code=404, detail="Timesheet not found")

    results = (
        db.query(
            TimesheetEntry.id,
            TimesheetEntry.employee_emp_no.label("employee_emp_no"),
            TimesheetEntry.trade_id,
            Employee.name.label("employee_name"),
            Trade.trade_name.label("trade_name"),
            TimesheetEntry.from_time,
            TimesheetEntry.to_time,
            TimesheetEntry.break_minutes,
            TimesheetEntry.total_hours,
            TimesheetEntry.remarks
        )
        .join(Employee, TimesheetEntry.employee_emp_no == Employee.emp_no)
        .outerjoin(Trade, TimesheetEntry.trade_id == Trade.id)  # ✅ outer join
        .filter(TimesheetEntry.timesheet_id == timesheet.id)
        .all()
    )

    timesheet.entries = [
        TimesheetEntryOut(
            id=row.id,
            employee_emp_no=row.employee_emp_no,
            employee_name=row.employee_name,
            trade_id=row.trade_id,
            trade_name=row.trade_name or "N/A",  # ✅ default to "N/A"
            from_time=row.from_time.strftime("%H:%M") if row.from_time else None,
            to_time=row.to_time.strftime("%H:%M") if row.to_time else None,
            break_minutes=row.break_minutes,
            total_hours=row.total_hours,
            remarks=row.remarks
        )
        for row in results
    ]

    return timesheet




    
@app.put("/timesheets/{timesheet_id}")
def update_timesheet(timesheet_id: int, data: TimesheetUpdate, db: Session = Depends(get_db)):
    print("Data received:", data)
    print("Parsed date type:", type(data.date))

    timesheet = db.query(Timesheet).filter_by(id=timesheet_id).first()
    if not timesheet:
        raise HTTPException(status_code=404, detail="Timesheet not found")

    for key, value in data.dict(exclude_unset=True).items():
        setattr(timesheet, key, value)

    db.commit()
    db.refresh(timesheet)
    return {"message": "Timesheet updated", "timesheet_id": timesheet.id}

@app.get("/employees", response_model=List[EmployeeOut])
def get_employees(db: Session = Depends(get_db)):
    return db.query(Employee).all()


@app.get("/trades", response_model=List[TradeOut])
def get_trades(db: Session = Depends(get_db)):
    return db.query(Trade).all()

from typing import List

@app.get("/attendance", response_model=List[AttendanceItemOut])
def get_attendance(date: date = Query(...), db: Session = Depends(get_db)):
    rows = db.query(Attendance).filter(Attendance.att_date == date).all()
    return [
        AttendanceItemOut(emp_no=r.emp_no, att_date=r.att_date, status=r.status, notes=r.notes or "")
        for r in rows
    ]

@app.post("/attendance/bulk")
def upsert_attendance_bulk(payload: AttendanceBulkIn, db: Session = Depends(get_db)):
    emp_nos = {e.emp_no for e in db.query(Employee.emp_no).all()}
    missing = [r.emp_no for r in payload.records if r.emp_no not in emp_nos]
    if missing:
        raise HTTPException(status_code=400, detail=f"Unknown emp_no(s): {', '.join(missing)}")

    for rec in payload.records:
        row = (
            db.query(Attendance)
            .filter(Attendance.emp_no == rec.emp_no, Attendance.att_date == payload.date)
            .one_or_none()
        )
        if row:
            row.status = rec.status
            row.notes = rec.notes or ""
        else:
            db.add(Attendance(emp_no=rec.emp_no, att_date=payload.date, status=rec.status, notes=rec.notes or ""))

    db.commit()
    return {"ok": True}

@app.get("/attendance/summary")
def attendance_summary(month: int, year: int, db: Session = Depends(get_db)):
    """
    Returns absence count (excluding SL) for each employee in the 15th-to-15th window.
    month = selected month (1–12)
    year = selected year
    """
    # Determine window: 15th of previous month → 15th of current month
    if month == 1:
        prev_month = 12
        prev_year = year - 1
    else:
        prev_month = month - 1
        prev_year = year

    start = date(prev_year, prev_month, 15)
    end = date(year, month, 15)

    # Get all employees first
    emp_list = db.query(Employee.emp_no).all()
    base = {e.emp_no: {"emp_no": e.emp_no, "absent_non_sl": 0} for e in emp_list}

    # Count non-SL absences in range
    rows = (
        db.query(Attendance.emp_no, func.count().label("absent_non_sl"))
        .filter(Attendance.att_date >= start, Attendance.att_date < end)
        .filter(Attendance.status != "SL")  # exclude Sick Leave
        .group_by(Attendance.emp_no)
        .all()
    )

    for emp_no, absent_non_sl in rows:
        base[emp_no]["absent_non_sl"] = absent_non_sl

    return list(base.values())


@app.get("/attendance/absences")
def get_absences(
    start: date = Query(...),
    end: date = Query(...),
    db: Session = Depends(get_db),
):
    # Pull records in range
    rows = (
        db.query(Attendance)
        .filter(Attendance.att_date >= start, Attendance.att_date <= end)
        .all()
    )

    abs_map = {}
    for r in rows:
        status_clean = (r.status or "").strip().upper()
        if status_clean == "P":
            continue  # exclude only Present

        emp = r.emp_no
        if emp not in abs_map:
            abs_map[emp] = {"count": 0, "dates": []}

        abs_map[emp]["count"] += 1
        abs_map[emp]["dates"].append({
            "date": r.att_date.isoformat(),  # <-- att_date, not date
            "status": status_clean
        })

    # Return grouped list
    return [
        {"emp_no": emp, "count": v["count"], "dates": v["dates"]}
        for emp, v in abs_map.items()
    ]


@app.get("/attendance/details")
def get_absence_details(emp_no: str, start: date = Query(...), end: date = Query(...), db: Session = Depends(get_db)):
    """
    Returns absence details for a single employee within date range (excluding SL).
    """
    rows = (
        db.query(Attendance.att_date, Attendance.status)
        .filter(Attendance.emp_no == emp_no)
        .filter(Attendance.att_date >= start, Attendance.att_date < end)
        .filter(Attendance.status != "SL")
        .all()
    )
    return [{"date": r.att_date.isoformat(), "status": r.status} for r in rows]

from calendar import monthrange
from datetime import datetime

def days_in_month(d: datetime) -> int:
    return monthrange(d.year, d.month)[1]

@app.get("/job-hours/{job_no}")
def job_hours_by_job(job_no: str, db: Session = Depends(get_db)):
    """
    Per-employee hours & values for a job number.
    Rules:
      - Subtract NOT/HOT from total to get REG.
      - REG value uses base/day-of-month for that date: (REG/8) * (base / days_in_month(date))
      - HOT value = HOT_hrs * 1.5 * (base/240)
      - NOT value = NOT_hrs * 1.25 * (base/240)
      - Sum across all timesheets and days.
    """
    rows = (
        db.query(
            Timesheet.date.label("ts_date"),
            Timesheet.job_no.label("job_no"),
            TimesheetEntry.employee_emp_no.label("emp_no"),
            TimesheetEntry.total_hours.label("hours"),
            Employee.name.label("name"),
            Employee.base_pay.label("base_pay"),
            Employee.OT.label("ot_flag"),
        )
        .join(Timesheet, Timesheet.id == TimesheetEntry.timesheet_id)
        .join(Employee, Employee.emp_no == TimesheetEntry.employee_emp_no)
        .filter(Timesheet.job_no == job_no)
        .all()
    )

    # Sum hours per employee per day first
    per_emp_day = {}   # (emp_no, date_str) -> total_hrs
    emp_info = {}      # emp_no -> {name, base_pay, ot_flag}
    for r in rows:
        date_str = r.ts_date.isoformat()
        key = (r.emp_no, date_str)
        per_emp_day[key] = per_emp_day.get(key, 0.0) + float(r.hours or 0.0)
        emp_info.setdefault(r.emp_no, {
            "name": r.name,
            "base_pay": float(r.base_pay or 0.0),
            "ot_flag": (r.ot_flag or "NO"),
        })

    # Roll up to employee level with your rules
    result = []
    totals = {
        "total_hours": 0.0, "reg_hours": 0.0, "not_hours": 0.0, "hot_hours": 0.0,
        "reg_value": 0.0, "ot_value": 0.0, "total_value": 0.0
    }

    per_emp = {}  # emp_no -> accumulators
    for (emp_no, date_str), hrs in per_emp_day.items():
        info = emp_info[emp_no]
        rec = per_emp.setdefault(emp_no, {
            "emp_no": emp_no,
            "name": info["name"],
            "base_pay": info["base_pay"],
            "ot_flag": info["ot_flag"],
            "total_hours": 0.0,
            "reg_hours": 0.0,
            "not_hours": 0.0,
            "hot_hours": 0.0,
            "reg_value": 0.0,  # money
        })

        rec["total_hours"] += hrs
        dt = datetime.strptime(date_str, "%Y-%m-%d")

        if dt.weekday() == 6:  # Sunday => all HOT
            hot = hrs
            not_ = 0.0
            reg = 0.0
        else:
            hot = 0.0
            not_ = max(0.0, hrs - 8.0)
            reg = max(0.0, hrs - not_)

        rec["hot_hours"] += hot
        rec["not_hours"] += not_
        rec["reg_hours"] += reg

        # Regular value uses base/day-of-month for that date
        dim = days_in_month(dt)
        day_rate = (rec["base_pay"] / dim) if dim else 0.0
        rec["reg_value"] += (reg / 8.0) * day_rate

    # Compute OT money and totals per employee
    for emp_no, rec in per_emp.items():
        hourly = rec["base_pay"] / 240.0 if rec["base_pay"] else 0.0
        if rec["ot_flag"] == "YES":
            ot_value = rec["not_hours"] * (hourly * 1.25) + rec["hot_hours"] * (hourly * 1.5)
        else:
            ot_value = 0.0

        total_value = rec["reg_value"] + ot_value

        out = {
            "job_no": job_no,
            "emp_no": rec["emp_no"],
            "name": rec["name"],
            "total_hours": round(rec["total_hours"], 2),
            "reg_hours": round(rec["reg_hours"], 2),
            "not_hours": round(rec["not_hours"], 2),
            "hot_hours": round(rec["hot_hours"], 2),
            "base_value": round(rec["reg_value"], 2),
            "ot_value": round(ot_value, 2),
            "total_value": round(total_value, 2),
        }
        result.append(out)

        # grand totals
        totals["total_hours"] += rec["total_hours"]
        totals["reg_hours"]   += rec["reg_hours"]
        totals["not_hours"]   += rec["not_hours"]
        totals["hot_hours"]   += rec["hot_hours"]
        totals["reg_value"]   += rec["reg_value"]
        totals["ot_value"]    += ot_value
        totals["total_value"] += total_value

    # TOTAL row
    result.append({
        "job_no": job_no,
        "emp_no": "TOTAL",
        "name": "",
        "total_hours": round(totals["total_hours"], 2),
        "reg_hours": round(totals["reg_hours"], 2),
        "not_hours": round(totals["not_hours"], 2),
        "hot_hours": round(totals["hot_hours"], 2),
        "base_value": round(totals["reg_value"], 2),
        "ot_value": round(totals["ot_value"], 2),
        "total_value": round(totals["total_value"], 2),
    })
    return result

# ======== Utility ========

def insert_payment_for_month(db: Session, emp_no: str, ts: date):
    acc = db.query(AdvanceAccount).filter_by(emp_no=emp_no).first()
    if not acc or acc.advance <= 0:
        return
    ym_str = ts.strftime("%Y-%m")
    existing = db.query(AdvanceTxn).filter(
        AdvanceTxn.emp_no == emp_no,
        AdvanceTxn.ym == ym_str,
        AdvanceTxn.type == AdvanceType.PAYMENT
    ).first()
    if existing:
        return
    amount = -min(acc.advance, acc.monthly_installment)
    txn = AdvanceTxn(
        emp_no=emp_no,
        ts=ts,
        type=AdvanceType.PAYMENT,
        amount=amount,
        note="Auto monthly deduction"
    )
    db.add(txn)


# ====================== ADVANCES API ======================
def _current_ym() -> str:
    return date.today().strftime("%Y-%m")

def _ym_to_ts(ym: str) -> date:
    return date.fromisoformat(f"{ym}-01")


@app.post("/advances", response_model=AdvanceCreateOut)
def add_advance(data: AdvanceCreateIn, db: Session = Depends(get_db)):
    acc = db.query(AdvanceAccount).filter_by(emp_no=data.emp_no).first()
    if not acc:
        acc = AdvanceAccount(
            emp_no=data.emp_no,
            advance=0,
            monthly_installment=data.monthly_installment
        )
        db.add(acc)
        db.flush()
    else:
        acc.monthly_installment = data.monthly_installment

    # Insert ADVANCE
    db.add(AdvanceTxn(
        emp_no=data.emp_no,
        ts=data.ts,
        type=AdvanceType.ADVANCE,
        amount=data.amount,
        note=data.note or "Advance given"
    ))
    db.flush()

    # Re-read fresh balance after triggers
    fresh_balance = Decimal(str(db.query(AdvanceAccount.advance)
                                  .filter_by(emp_no=data.emp_no)
                                  .scalar() or 0))
    ym_str = data.ts.strftime("%Y-%m")

    # Upsert a PAYMENT for that month, but never overpay
    payment_exists = db.query(AdvanceTxn).filter(
        and_(
            AdvanceTxn.emp_no == data.emp_no,
            AdvanceTxn.ym == ym_str,
            AdvanceTxn.type == AdvanceType.PAYMENT
        )
    ).first()

    payment_inserted = False
    if not payment_exists and fresh_balance > 0:
        payment_amount = -float(min(fresh_balance, Decimal(str(acc.monthly_installment))))
        db.add(AdvanceTxn(
            emp_no=data.emp_no,
            ts=data.ts,
            type=AdvanceType.PAYMENT,
            amount=payment_amount,
            note="Auto monthly deduction (same month as advance)"
        ))
        payment_inserted = True

    db.commit()

    # Final balance to return
    final_balance = db.query(AdvanceAccount.advance).filter_by(emp_no=data.emp_no).scalar() or 0.0

    return AdvanceCreateOut(
        message="Advance created successfully",
        emp_no=data.emp_no,
        advance_amount=data.amount,
        monthly_installment=data.monthly_installment,
        payment_inserted=payment_inserted,
        balance=float(final_balance)
    )


@app.put("/payments/{emp_no}/{ym}", response_model=PaymentUpdateOut)
def update_or_defer_payment(emp_no: str, ym: str, body: PaymentUpdateIn, db: Session = Depends(get_db)):
    acc = db.query(AdvanceAccount).filter_by(emp_no=emp_no).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Employee account not found")

    # Reject overpayment: |amount| cannot exceed balance
    balance_now = Decimal(str(acc.advance or 0))
    proposed = Decimal(str(body.amount))  # <= 0
    if proposed < 0 and abs(proposed) > balance_now:
        raise HTTPException(
            status_code=400,
            detail=f"Payment amount {proposed} exceeds current balance {balance_now}."
        )

    created = False
    payment_txn = db.query(AdvanceTxn).filter(
        and_(
            AdvanceTxn.emp_no == emp_no,
            AdvanceTxn.ym == ym,
            AdvanceTxn.type == AdvanceType.PAYMENT
        )
    ).order_by(AdvanceTxn.ts.desc(), AdvanceTxn.id.desc()).first()

    if payment_txn:
        payment_txn.amount = float(proposed)
        if body.note is not None:
            payment_txn.note = body.note
        elif proposed == 0:
            payment_txn.note = "Deferred"
    else:
        ts = _ym_to_ts(ym)
        db.add(AdvanceTxn(
            emp_no=emp_no,
            ts=ts,
            type=AdvanceType.PAYMENT,
            amount=float(proposed),
            note=body.note or ("Deferred" if proposed == 0 else "Manual payment set")
        ))
        created = True

    # If deferring (amount==0), ensure a DEFER audit row exists
    deferred = (proposed == 0)
    if deferred:
        exists = db.query(AdvanceTxn).filter(
            and_(
                AdvanceTxn.emp_no == emp_no,
                AdvanceTxn.ym == ym,
                AdvanceTxn.type == AdvanceType.DEFER
            )
        ).first()
        if not exists:
            db.add(AdvanceTxn(
                emp_no=emp_no,
                ts=_ym_to_ts(ym),
                type=AdvanceType.DEFER,
                amount=0.0,
                note="Deferred (audit)"
            ))

    db.commit()

    new_balance = db.query(AdvanceAccount.advance).filter_by(emp_no=emp_no).scalar() or 0.0

    return PaymentUpdateOut(
        message=("Payment created" if created else "Payment updated"),
        emp_no=emp_no,
        ym=ym,
        amount=float(proposed),
        deferred=deferred,
        balance=float(new_balance)
    )


@app.post("/advances/increase", response_model=IncreaseAdvanceOut)
def increase_advance(body: IncreaseAdvanceIn, db: Session = Depends(get_db)):
    acc = db.query(AdvanceAccount).filter_by(emp_no=body.emp_no).first()
    if not acc:
        raise HTTPException(404, "Employee account not found")
    if body.amount <= 0:
        raise HTTPException(400, "Increase amount must be > 0")

    db.add(AdvanceTxn(
        emp_no=body.emp_no,
        ts=body.ts,
        type=AdvanceType.INCREASE,
        amount=body.amount,
        note=body.note
    ))
    db.commit()

    new_balance = db.query(AdvanceAccount.advance).filter_by(emp_no=body.emp_no).scalar() or 0.0

    return IncreaseAdvanceOut(
        message="Advance increased",
        emp_no=body.emp_no,
        amount=body.amount,
        balance=float(new_balance)
    )


@app.put("/advances/{emp_no}/installment", response_model=InstallmentUpdateOut)
def update_installment(emp_no: str, body: InstallmentUpdateIn, db: Session = Depends(get_db)):
    acc = db.query(AdvanceAccount).filter_by(emp_no=emp_no).first()
    if not acc:
        raise HTTPException(404, "Employee account not found")

    acc.monthly_installment = body.monthly_installment

    ym = body.ym or _current_ym()
    payment_adjusted = False

    if body.apply_to_month:
        # If there's a DEFER for that month, don't change the payment row
        defer_exists = db.query(AdvanceTxn).filter(
            and_(
                AdvanceTxn.emp_no == emp_no,
                AdvanceTxn.ym == ym,
                AdvanceTxn.type == AdvanceType.DEFER
            )
        ).first()

        if not defer_exists:
            payment_txn = db.query(AdvanceTxn).filter(
                and_(
                    AdvanceTxn.emp_no == emp_no,
                    AdvanceTxn.ym == ym,
                    AdvanceTxn.type == AdvanceType.PAYMENT
                )
            ).order_by(AdvanceTxn.ts.desc(), AdvanceTxn.id.desc()).first()

            # Guard: new payment amount must not exceed balance
            balance_now = Decimal(str(acc.advance or 0))
            new_amount = -Decimal(str(body.monthly_installment))
            if abs(new_amount) > balance_now:
                raise HTTPException(
                    status_code=400,
                    detail=f"Payment amount {new_amount} exceeds current balance {balance_now}."
                )

            new_amount_f = float(new_amount)

            if payment_txn:
                payment_txn.amount = new_amount_f
                if body.note:
                    payment_txn.note = body.note
                payment_adjusted = True
            else:
                db.add(AdvanceTxn(
                    emp_no=emp_no,
                    ts=_ym_to_ts(ym),
                    type=AdvanceType.PAYMENT,
                    amount=new_amount_f,
                    note=body.note or "Auto monthly deduction (installment changed)"
                ))
                payment_adjusted = True

    db.commit()

    new_balance = db.query(AdvanceAccount.advance).filter_by(emp_no=emp_no).scalar() or 0.0

    return InstallmentUpdateOut(
        message="Installment updated",
        emp_no=emp_no,
        monthly_installment=body.monthly_installment,
        ym=ym,
        payment_adjusted=payment_adjusted,
        balance=float(new_balance)
    )


@app.get("/advances/{emp_no}/balance", response_model=BalanceOut)
def get_advance_balance(emp_no: str, db: Session = Depends(get_db)):
    acc = db.query(AdvanceAccount).filter_by(emp_no=emp_no).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Employee account not found")
    return BalanceOut(emp_no=emp_no, balance=float(acc.advance or 0.0))

@app.on_event("startup")
def _on_startup():
    start_scheduler()

@app.on_event("shutdown")
def _on_shutdown():
    stop_scheduler()

# Optional: manual trigger for testing from Postman
@app.post("/cron/run-auto-payments")
def cron_run_now():
    inserted = run_monthly_auto_deductions()
    return {"message": "Auto deductions executed", "inserted": inserted}



@app.get("/advances/{emp_no}/history")
def get_advance_history(emp_no: str, db: Session = Depends(get_db)):
    txns = (
        db.query(AdvanceTxn)
        .filter(AdvanceTxn.emp_no == emp_no)
        .order_by(AdvanceTxn.ts.desc(), AdvanceTxn.id.desc())
        .all()
    )

    if not txns:
        raise HTTPException(status_code=404, detail="No transactions found for this employee")

    return [
        {
            "id": t.id,
            "ts": t.ts.isoformat(),
            "ym": t.ym,
            "type": t.type.value if t.type else None,
            "amount": float(t.amount or 0.0),
            "note": t.note or ""
        }
        for t in txns
    ]

@app.get("/advances/balances", response_model=List[BalanceOut])
def get_all_advance_balances(db: Session = Depends(get_db)):
    """
    Retrieves the advance balance and monthly installment
    for all employees who have an account.
    """
    all_accounts = db.query(AdvanceAccount).all()

    balances_list = []
    for acc in all_accounts:
        balances_list.append(
            BalanceOut(
                emp_no=acc.emp_no,
                balance=float(acc.advance or 0.0),
                monthly_installment=float(acc.monthly_installment or 0.0)
            )
        )

    return balances_list


