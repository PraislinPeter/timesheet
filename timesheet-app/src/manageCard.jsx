function ManageCard({
  emp_no,
  ym,
  onClose,
  onReload,
  createAdvance,
  increaseAdvance,
  setPaymentForMonth,
  updateInstallment,
}) {
  const [advAmt, setAdvAmt] = useState("");
  const [advNote, setAdvNote] = useState("");
  const [monthlyInstallment, setMonthlyInstallment] = useState("");
  const [installmentNote, setInstallmentNote] = useState("");
  const [applyToMonth, setApplyToMonth] = useState(true);
  const [payAmt, setPayAmt] = useState("");
  const [payNote, setPayNote] = useState("");

  const monthDate = new Date(
    Number(ym.slice(0, 4)),
    Number(ym.slice(5)) - 1,
    1
  );
  const toApiDate = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;

  const handle = async (fn) => {
    try {
      await fn();
      await onReload();
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  return (
    <div className="card mt-3">
      <div className="card-header d-flex justify-content-between align-items-center">
        <strong>Manage: {emp_no}</strong>
        <button className="btn btn-sm btn-outline-secondary" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="card-body">
        <div className="row g-3">
          {/* Advance / Top-up */}
          <div className="col-md-4">
            <h6>New advance / top-up</h6>
            <div className="input-group input-group-sm mb-2">
              <span className="input-group-text">AED</span>
              <input
                className="form-control"
                type="number"
                step="0.01"
                value={advAmt}
                onChange={(e) => setAdvAmt(e.target.value)}
              />
            </div>
            <input
              className="form-control form-control-sm mb-2"
              placeholder="Note (optional)"
              value={advNote}
              onChange={(e) => setAdvNote(e.target.value)}
            />
            <div className="btn-group btn-group-sm">
              <button
                className="btn btn-success"
                disabled={!advAmt || Number(advAmt) <= 0 || monthlyInstallment === ""}
                onClick={() =>
                  handle(() =>
                    createAdvance({
                      emp_no,
                      ts: toApiDate(monthDate),
                      amount: Number(advAmt),
                      monthly_installment: Number(monthlyInstallment),
                      note: advNote || "Advance given",
                    })
                  )
                }
              >
                Post advance
              </button>
              <button
                className="btn btn-outline-success"
                disabled={!advAmt || Number(advAmt) <= 0}
                onClick={() => {
                  if (
                    window.confirm(
                      `Top-up AED ${Number(advAmt).toFixed(2)} for ${emp_no}?`
                    )
                  ) {
                    handle(() =>
                      increaseAdvance({
                        emp_no,
                        ts: toApiDate(monthDate),
                        amount: Number(advAmt),
                        note: advNote || "Top-up",
                      })
                    );
                  }
                }}
              >
                Top-up
              </button>
            </div>
            <div className="mt-3">
              <label className="form-label form-label-sm mb-1">
                Monthly installment (AED)
              </label>
              <input
                className="form-control form-control-sm"
                type="number"
                step="0.01"
                value={monthlyInstallment}
                onChange={(e) => setMonthlyInstallment(e.target.value)}
              />
            </div>
          </div>

          {/* Payment */}
          <div className="col-md-4">
            <h6>Payment for {ym}</h6>
            <div className="input-group input-group-sm mb-2">
              <span className="input-group-text">AED</span>
              <input
                className="form-control"
                type="number"
                step="0.01"
                value={payAmt}
                onChange={(e) => setPayAmt(e.target.value)}
              />
            </div>
            <input
              className="form-control form-control-sm mb-2"
              placeholder="Note (optional)"
              value={payNote}
              onChange={(e) => setPayNote(e.target.value)}
            />
            <div className="btn-group btn-group-sm">
              <button
                className="btn btn-outline-primary"
                disabled={payAmt === "" || Number(payAmt) < 0}
                onClick={() => {
                  if (
                    window.confirm(
                      `Set payment of AED ${Number(payAmt).toFixed(
                        2
                      )} for ${emp_no} (${ym})?`
                    )
                  ) {
                    handle(() =>
                      setPaymentForMonth({
                        emp_no,
                        ym,
                        amount: Number(payAmt),
                        note: payNote,
                      })
                    );
                  }
                }}
              >
                Set payment
              </button>
              <button
                className="btn btn-outline-warning"
                onClick={() => {
                  if (window.confirm(`Defer payment for ${ym}?`)) {
                    handle(() =>
                      setPaymentForMonth({
                        emp_no,
                        ym,
                        amount: 0,
                        note: "Deferred",
                      })
                    );
                  }
                }}
              >
                Defer this month
              </button>
            </div>
          </div>

          {/* Installment */}
          <div className="col-md-4">
            <h6>Change installment</h6>
            <input
              className="form-control form-control-sm mb-2"
              placeholder="Note (optional)"
              value={installmentNote}
              onChange={(e) => setInstallmentNote(e.target.value)}
            />
            <button
              className="btn btn-sm btn-outline-dark"
              disabled={monthlyInstallment === "" || Number(monthlyInstallment) <= 0}
              onClick={() =>
                handle(() =>
                  updateInstallment({
                    emp_no,
                    monthly_installment: Number(monthlyInstallment),
                    ym,
                    apply_to_month: applyToMonth,
                    note: installmentNote,
                  })
                )
              }
            >
              Update installment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
