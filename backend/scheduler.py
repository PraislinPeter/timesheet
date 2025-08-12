# scheduler.py
from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session
from datetime import date
from decimal import Decimal
from database import SessionLocal
from models import AdvanceAccount, AdvanceTxn, AdvanceType

scheduler = BackgroundScheduler()

def run_monthly_auto_deductions() -> int:
    """
    Go through all employees with advances > 0
    and insert a PAYMENT transaction for the current month,
    ensuring we never deduct more than the remaining balance.
    """
    db: Session = SessionLocal()
    inserted_count = 0
    try:
        today = date.today()
        ym_str = today.strftime("%Y-%m")

        # Get all accounts with a positive balance
        accounts = db.query(AdvanceAccount).filter(AdvanceAccount.advance > 0).all()

        for acc in accounts:
            # Check if payment for this month already exists
            existing = db.query(AdvanceTxn).filter(
                AdvanceTxn.emp_no == acc.emp_no,
                AdvanceTxn.ym == ym_str,
                AdvanceTxn.type == AdvanceType.PAYMENT
            ).first()

            if existing:
                continue  # Skip if already paid/deducted

            balance_now = Decimal(str(acc.advance))
            installment = Decimal(str(acc.monthly_installment or 0))

            if balance_now <= 0 or installment <= 0:
                continue

            # Never deduct more than balance
            payment_amount = -float(min(balance_now, installment))

            txn = AdvanceTxn(
                emp_no=acc.emp_no,
                ts=today,
                type=AdvanceType.PAYMENT,
                amount=payment_amount,
                note="Auto monthly deduction"
            )
            db.add(txn)
            inserted_count += 1

        db.commit()
    finally:
        db.close()

    return inserted_count


def start_scheduler():
    """
    Starts APScheduler to run monthly deductions on the 1st of each month at 01:00.
    """
    scheduler.add_job(run_monthly_auto_deductions, "cron", day=1, hour=1, minute=0)
    scheduler.start()
    print("[Scheduler] Started: Auto deductions scheduled for 1st of each month at 01:00")


def stop_scheduler():
    scheduler.shutdown(wait=False)
    print("[Scheduler] Stopped")
