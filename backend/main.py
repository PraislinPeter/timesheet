from decimal import Decimal
from fastapi import FastAPI, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import Base, engine, SessionLocal
from models import Timesheet, TimesheetEntry, Trade, Employee
from schemas import TimesheetIn, TimesheetEntryUpdate, TimesheetOut, TimesheetEntryIn, ReportOut, EmployeeOut, TimesheetEntryOut, TimesheetUpdate, TradeOut
from fastapi.middleware.cors import CORSMiddleware
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


