import React, { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";

/** -------------------- Helpers -------------------- */
const API = (p, init) => fetch(`http://127.0.0.1:8000${p}`, init);

// "1,000.50" => 1000.5; returns NaN if invalid
const normalizeNumber = (v) => {
  if (v === null || v === undefined) return NaN;
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v.replace(/,/g, "").trim());
  return Number(v);
};

async function readError(r) {
  try {
    const j = await r.json();
    return j?.detail || JSON.stringify(j);
  } catch {
    try { return await r.text(); } catch { return `HTTP ${r.status}`; }
  }
}

/** -------------------- Toasts -------------------- */
function useToasts() {
  const [toasts, setToasts] = useState([]);
  const push = (type, title, msg) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, type, title, msg }]);
    setTimeout(() => setToasts((t) => t.filter(x => x.id !== id)), 4000);
  };
  return {
    toasts,
    success: (title, msg) => push("success", title, msg),
    error: (title, msg) => push("danger", title, msg),
    info: (title, msg) => push("info", title, msg),
    warn: (title, msg) => push("warning", title, msg),
    remove: (id) => setToasts((t) => t.filter(x => x.id !== id)),
  };
}

function Toasts({ items, onClose }) {
  return (
    <div className="position-fixed top-0 end-0 p-3" style={{ zIndex: 1080 }}>
      {items.map(t => (
        <div key={t.id} className={`toast show align-items-center text-bg-${t.type} mb-2`} role="alert">
          <div className="d-flex">
            <div className="toast-body">
              <strong className="me-2">{t.title}</strong>{t.msg}
            </div>
            <button type="button" className="btn-close btn-close-white me-2 m-auto" onClick={() => onClose(t.id)} aria-label="Close"></button>
          </div>
        </div>
      ))}
    </div>
  );
}

/** -------------------- Main -------------------- */
export default function AdvanceAdmin() {
  const [accounts, setAccounts] = useState([]); // [{emp_no, balance, monthly_installment}]
  const [allEmployees, setAllEmployees] = useState([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(null);
  const [month, setMonth] = useState(() => new Date());
  const [showAddModal, setShowAddModal] = useState(false);
  const toast = useToasts();

  const ym = format(month, "yyyy-MM");

  const loadBalances = async () => {
    try {
      const r = await API("/advances/balances");
      if (!r.ok) throw new Error(`Error ${r.status}`);
      const data = await r.json();
      setAccounts(Array.isArray(data) ? data : []);
    } catch (e) {
      setAccounts([]);
      toast.error("Couldn’t load balances", String(e?.message || e));
    }
  };

  const loadEmployees = async () => {
    try {
      const r = await API("/employees");
      if (!r.ok) throw new Error(`Error ${r.status}`);
      const data = await r.json();
      setAllEmployees(Array.isArray(data) ? data : []);
    } catch (e) {
      setAllEmployees([]);
      toast.error("Couldn’t load employees", String(e?.message || e));
    }
  };

  useEffect(() => {
    loadEmployees();
    loadBalances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const ql = q.toLowerCase();
    return accounts.filter((a) => {
      const emp = allEmployees.find((e) => e.emp_no === a.emp_no);
      const name = (emp?.name || "").toLowerCase();
      const empNo = (a.emp_no || "").toString().toLowerCase();
      return empNo.includes(ql) || name.includes(ql);
    });
  }, [accounts, allEmployees, q]);

  const empName = (emp_no) =>
    allEmployees.find((e) => e.emp_no === emp_no)?.name || "";

  /** ---------- API wrappers with error surfacing ---------- */
  const createAdvance = async (body) => {
    // REQUIRE amount > 0 and monthly_installment > 0 for CREATE
    const payload = { ...body };
    payload.amount = normalizeNumber(body.amount);
    if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
      throw new Error("Amount must be a positive number.");
    }
    const mi = normalizeNumber(body.monthly_installment);
    if (!Number.isFinite(mi) || mi <= 0) {
      throw new Error("Monthly installment is required and must be > 0.");
    }
    payload.monthly_installment = mi;

    const r = await API("/advances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error(await readError(r));
  };

  const increaseAdvance = async (body) => {
    const amt = normalizeNumber(body.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      throw new Error("Amount must be a positive number.");
    }
    const payload = { ...body, amount: amt };
    const r = await API("/advances/increase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error(await readError(r));
  };

  const setPaymentForMonth = async ({ emp_no, ym, amount, note }) => {
    const normAmt = normalizeNumber(amount);
    const payload = {
      amount: normAmt === 0 ? 0 : -Math.abs(normAmt),
      note: note || (normAmt === 0 ? "Deferred" : undefined),
    };
    const r = await API(
      `/payments/${encodeURIComponent(emp_no)}/${encodeURIComponent(ym)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    if (!r.ok) throw new Error(await readError(r));
  };

  const updateInstallment = async (body) => {
    const mi = normalizeNumber(body.monthly_installment);
    if (!Number.isFinite(mi) || mi <= 0)
      throw new Error("Monthly installment must be > 0.");
    const payload = { ...body, monthly_installment: mi };
    const r = await API(
      `/advances/${encodeURIComponent(body.emp_no)}/installment`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    if (!r.ok) throw new Error(await readError(r));
  };

  return (
    <>
      <div className="container my-4">
        {/* Header */}
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <h4 className="m-0">Advance Management</h4>
            <div className="text-muted small">Create, top-up, and manage payroll advances</div>
          </div>
          <button className="btn btn-success" onClick={() => setShowAddModal(true)}>
            <i className="bi bi-plus-lg me-1" /> Add Advance
          </button>
        </div>

        {/* Filters */}
        <div className="card shadow-sm mb-3">
          <div className="card-body py-3">
            <div className="row g-3 align-items-end">
              <div className="col-sm-6 col-md-5 col-lg-4">
                <label className="form-label mb-1">Search employee</label>
                <input
                  className="form-control"
                  placeholder="Type emp no or name…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
              <div className="col-sm-6 col-md-4 col-lg-3">
                <label className="form-label mb-1">Month</label>
                <input
                  type="month"
                  className="form-control"
                  value={ym}
                  onChange={(e) => {
                    const [Y, M] = e.target.value.split("-").map(Number);
                    setMonth(new Date(Y, M - 1, 1));
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="card shadow-sm">
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover table-nowrap align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th style={{width: 120}}>Emp No</th>
                    <th>Name</th>
                    <th className="text-end" style={{width: 140}}>Balance</th>
                    <th className="text-end" style={{width: 200}}>Monthly Installment</th>
                    <th className="text-end" style={{width: 190}}></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a) => (
                    <tr key={a.emp_no} className={selected === a.emp_no ? "table-primary" : ""}>
                      <td className="fw-medium">{a.emp_no}</td>
                      <td>{empName(a.emp_no)}</td>
                      <td className="text-end">AED {Number(a.balance || 0).toFixed(2)}</td>
                      <td className="text-end">AED {Number(a.monthly_installment || 0).toFixed(2)}</td>
                      <td className="text-end">
                        <div className="btn-group">
                          <button
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => setSelected(a.emp_no)}
                          >
                            Manage
                          </button>
                          <HistoryButton emp_no={a.emp_no} />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!filtered.length && (
                    <tr>
                      <td colSpan={5} className="text-center text-muted py-4">
                        No employees found for this filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Manage panel */}
        {selected && (
          <ManageCard
            emp_no={selected}
            ym={ym}
            onClose={() => setSelected(null)}
            onReload={async () => {
              await loadBalances();
              toast.success("Refreshed", "Balances updated.");
            }}
            createAdvance={async (p) => {
              await createAdvance(p);
              toast.success("Advance created", "The advance was posted.");
            }}
            increaseAdvance={async (p) => {
              await increaseAdvance(p);
              toast.success("Top-up posted", "The advance was increased.");
            }}
            setPaymentForMonth={async (p) => {
              await setPaymentForMonth(p);
              toast.success("Payment updated", "Payment recorded for the month.");
            }}
            updateInstallment={async (p) => {
              await updateInstallment(p);
              toast.success("Installment updated", "Monthly installment changed.");
            }}
          />
        )}
      </div>

      {showAddModal && (
        <AddAdvanceModal
          employees={allEmployees}
          defaultMonth={month}
          onClose={() => setShowAddModal(false)}
          onCreate={async (payload) => {
            await createAdvance(payload);
            await loadBalances();
            setShowAddModal(false);
            toast.success("Advance created", "The advance was posted.");
          }}
        />
      )}

      <Toasts items={toast.toasts} onClose={toast.remove} />
    </>
  );
}

/** -------------------- Manage Card -------------------- */
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
  const [posting, setPosting] = useState(false);
  const [topping, setTopping] = useState(false);
  const [paying, setPaying] = useState(false);
  const [updatingIns, setUpdatingIns] = useState(false);

  const monthDate = new Date(
    Number(ym.slice(0, 4)),
    Number(ym.slice(5)) - 1,
    1
  );
  const toApiDate = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;

  const validateCreate = () => {
    const amt = normalizeNumber(advAmt);
    const mi = normalizeNumber(monthlyInstallment);
    const errs = {};
    if (!Number.isFinite(amt) || amt <= 0) errs.amount = "Enter a valid positive amount.";
    if (!Number.isFinite(mi) || mi <= 0) errs.mi = "Monthly installment is required.";
    return { valid: Object.keys(errs).length === 0, errs, amt, mi };
  };

  const validateTopUp = () => {
    const amt = normalizeNumber(advAmt);
    if (!Number.isFinite(amt) || amt <= 0) return { valid: false, amt, msg: "Enter a valid positive amount." };
    return { valid: true, amt };
  };

  const handleTopUp = async () => {
    const { valid, amt, msg } = validateTopUp();
    if (!valid) return alert(msg);
    if (!window.confirm(`Confirm top-up of AED ${amt.toFixed(2)}?`)) return;
    try {
      setTopping(true);
      await increaseAdvance({
        emp_no,
        ts: toApiDate(monthDate),
        amount: amt,
        note: advNote || "Top-up",
      });
      await onReload();
      setAdvAmt("");
      setAdvNote("");
    } catch (e) {
      alert(e.message || "Failed to top-up.");
    } finally {
      setTopping(false);
    }
  };

  const handleSetPayment = async (amount, note) => {
    const amt = normalizeNumber(amount);
    const isDefer = amt === 0;
    if (
      !window.confirm(
        isDefer ? `Confirm defer for ${ym}?` : `Confirm payment AED ${amt}?`
      )
    )
      return;
    try {
      setPaying(true);
      await setPaymentForMonth({ emp_no, ym, amount: amt, note });
      await onReload();
      setPayAmt("");
      setPayNote("");
    } catch (e) {
      alert(e.message || "Failed to set payment.");
    } finally {
      setPaying(false);
    }
  };

  const handleUpdateInstallment = async () => {
    const mi = normalizeNumber(monthlyInstallment);
    if (!Number.isFinite(mi) || mi <= 0)
      return alert("Enter a valid monthly installment.");
    try {
      setUpdatingIns(true);
      await updateInstallment({
        emp_no,
        monthly_installment: mi,
        ym,
        apply_to_month: applyToMonth,
        note: installmentNote,
      });
      if (applyToMonth) {
        await setPaymentForMonth({
          emp_no,
          ym,
          amount: mi,
          note: installmentNote || "Updated with installment",
        });
      }
      await onReload();
    } catch (e) {
      alert(e.message || "Failed to update installment.");
    } finally {
      setUpdatingIns(false);
    }
  };

  const handlePostAdvance = async () => {
    const { valid, errs, amt, mi } = validateCreate();
    if (!valid) {
      const msg = [errs.amount, errs.mi].filter(Boolean).join("\n");
      return alert(msg);
    }
    try {
      setPosting(true);
      // Try create; if the server says it already exists, offer to top-up
      try {
        await createAdvance({
          emp_no,
          ts: toApiDate(monthDate),
          amount: amt,
          monthly_installment: mi, // required
          note: (advNote || "Advance given"),
        });
      } catch (e) {
        const msg = String(e.message || "");
        const exists = /exists|duplicate|already/i.test(msg) || /409|Conflict/i.test(msg);
        if (exists) {
          const ok = window.confirm(
            "An advance already exists for this employee. Post this as a Top-up instead?"
          );
          if (!ok) throw e;
          await increaseAdvance({
            emp_no,
            ts: toApiDate(monthDate),
            amount: amt,
            note: advNote || "Top-up",
          });
        } else {
          throw e;
        }
      }
      await onReload();
      setAdvAmt("");
      setAdvNote("");
      // keep monthlyInstallment filled for convenience
    } catch (e) {
      alert(e.message || "Failed to add advance.");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="card shadow-sm mt-3">
      <div className="card-header d-flex justify-content-between align-items-center">
        <div>
          <strong>Manage</strong> <span className="text-muted">• {emp_no} • {ym}</span>
        </div>
        <button className="btn btn-sm btn-outline-secondary" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="card-body">
        <div className="row g-4">
          {/* Create / Top-up */}
          <div className="col-md-5">
            <div className="p-3 border rounded-3 h-100">
              <div className="d-flex align-items-center mb-2">
                <h6 className="m-0">New Advance / Top-up</h6>
                <span className="badge bg-light text-dark ms-2">Quick Actions</span>
              </div>

              <div className="mb-2">
                <label className="form-label mb-1">Amount (AED)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-control"
                  placeholder="e.g. 1500.00"
                  value={advAmt}
                  onChange={(e) => setAdvAmt(e.target.value)}
                />
                <div className="form-text">Required for both new advance and top-up.</div>
              </div>

              <div className="mb-2">
                <label className="form-label mb-1">Monthly installment (AED)</label>
                <input
                  type="number"
                  step="0.01"
                  className={`form-control ${monthlyInstallment && normalizeNumber(monthlyInstallment) > 0 ? "" : "is-invalid"}`}
                  placeholder="e.g. 500.00"
                  value={monthlyInstallment}
                  onChange={(e) => setMonthlyInstallment(e.target.value)}
                />
                <div className="invalid-feedback">Monthly installment is required &gt; 0 when creating an advance.</div>
                <div className="form-text">Required to <em>create</em> a new advance. Not required for a top-up.</div>
              </div>

              <div className="mb-3">
                <label className="form-label mb-1">Note</label>
                <input
                  className="form-control"
                  placeholder="Advance given / Top-up"
                  value={advNote}
                  onChange={(e) => setAdvNote(e.target.value)}
                />
              </div>

              <div className="d-flex gap-2">
                <button
                  className="btn btn-success"
                  disabled={!advAmt || !monthlyInstallment || posting}
                  onClick={handlePostAdvance}
                >
                  {posting ? "Posting…" : "Post Advance"}
                </button>
                <button
                  className="btn btn-outline-success"
                  disabled={!advAmt || topping}
                  onClick={handleTopUp}
                >
                  {topping ? "Posting…" : "Top-up"}
                </button>
              </div>
            </div>
          </div>

          {/* Payment */}
          <div className="col-md-3">
            <div className="p-3 border rounded-3 h-100">
              <h6 className="mb-2">Payment for {ym}</h6>
              <div className="mb-2">
                <label className="form-label mb-1">Amount (AED)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-control"
                  placeholder="e.g. 500.00"
                  value={payAmt}
                  onChange={(e) => setPayAmt(e.target.value)}
                />
              </div>
              <div className="mb-3">
                <label className="form-label mb-1">Note</label>
                <input
                  className="form-control"
                  placeholder="Installment for month"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                />
              </div>
              <div className="d-flex gap-2">
                <button
                  className="btn btn-outline-primary"
                  disabled={!payAmt && normalizeNumber(payAmt) !== 0 || paying}
                  onClick={() => handleSetPayment(payAmt, payNote)}
                >
                  {paying ? "Saving…" : "Set Payment"}
                </button>
                <button
                  className="btn btn-outline-warning"
                  disabled={paying}
                  onClick={() => handleSetPayment(0, "Deferred")}
                >
                  Defer
                </button>
              </div>
            </div>
          </div>

          {/* Change Installment */}
          <div className="col-md-4">
            <div className="p-3 border rounded-3 h-100">
              <h6 className="mb-2">Change Installment</h6>
              <div className="mb-2">
                <label className="form-label mb-1">Monthly installment (AED)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-control"
                  placeholder="e.g. 500.00"
                  value={monthlyInstallment}
                  onChange={(e) => setMonthlyInstallment(e.target.value)}
                />
              </div>
              <div className="form-check form-switch mb-2">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={applyToMonth}
                  onChange={() => setApplyToMonth((v) => !v)}
                  id="applyToMonthSwitch"
                />
                <label className="form-check-label" htmlFor="applyToMonthSwitch">
                  Apply to {ym}
                </label>
              </div>
              <div className="mb-3">
                <label className="form-label mb-1">Note</label>
                <input
                  className="form-control"
                  placeholder="Updated with installment"
                  value={installmentNote}
                  onChange={(e) => setInstallmentNote(e.target.value)}
                />
              </div>
              <button
                className="btn btn-outline-dark"
                disabled={!monthlyInstallment || updatingIns}
                onClick={handleUpdateInstallment}
              >
                {updatingIns ? "Updating…" : "Update Installment"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** -------------------- Add Advance Modal (Create) -------------------- */
function AddAdvanceModal({ employees, defaultMonth, onClose, onCreate }) {
  const [empNo, setEmpNo] = useState("");
  const [amount, setAmount] = useState("");
  const [installment, setInstallment] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState({ empNo: false, amount: false, installment: false });

  const ym = format(defaultMonth, "yyyy-MM");
  const ts = `${defaultMonth.getFullYear()}-${String(defaultMonth.getMonth() + 1).padStart(2, "0")}-${String(defaultMonth.getDate()).padStart(2, "0")}`;

  // validation
  const amtNum = normalizeNumber(amount);
  const miNum = normalizeNumber(installment);
  const vEmp = !!empNo;
  const vAmt = Number.isFinite(amtNum) && amtNum > 0;
  const vMi  = Number.isFinite(miNum)  && miNum  > 0;

  // payoff estimate
  const monthsToClear = vAmt && vMi ? Math.ceil(amtNum / miNum) : null;
  // assume first installment in the same posting month; finish in month + (monthsToClear - 1)
  const payoffMonth = monthsToClear
    ? new Date(defaultMonth.getFullYear(), defaultMonth.getMonth() + (monthsToClear - 1), 1)
    : null;
  const payoffText = monthsToClear
    ? `${monthsToClear} month${monthsToClear > 1 ? "s" : ""} — ${format(payoffMonth, "MMM yyyy")}`
    : "Enter amount & installment";

  const empName = employees.find(e => e.emp_no === empNo)?.name || "";

  const onSubmit = async (e) => {
    e?.preventDefault();
    setTouched({ empNo: true, amount: true, installment: true });
    if (!(vEmp && vAmt && vMi)) return;

    try {
      setSubmitting(true);
      await onCreate({
        emp_no: empNo,
        ts,
        amount: amtNum,
        monthly_installment: miNum, // REQUIRED
        note: note || "Advance given",
      });
    } catch (err) {
      alert(err?.message || "Failed to create advance.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal d-block" tabIndex="-1" role="dialog" aria-modal="true" style={{ background: "rgba(0,0,0,0.45)" }}>
      <div className="modal-dialog modal-lg modal-dialog-centered" role="document">
        <div className="modal-content shadow">
          {/* Header */}
          <div className="modal-header">
            <div>
              <h5 className="modal-title mb-0">Add Advance</h5>
              <small className="text-muted">Posting for month: <strong>{ym}</strong></small>
            </div>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
          </div>

          {/* Body */}
          <form onSubmit={onSubmit} noValidate>
            <div className="modal-body">
              <div className="row g-4">
                {/* Left: Form */}
                <div className="col-md-7">
                  <div className="mb-3">
                    <label className="form-label">Employee <span className="text-danger">*</span></label>
                    <select
                      className={`form-select ${touched.empNo && !vEmp ? "is-invalid" : ""}`}
                      value={empNo}
                      onChange={(e) => setEmpNo(e.target.value)}
                      onBlur={() => setTouched((t) => ({ ...t, empNo: true }))}
                      required
                    >
                      <option value="">-- Select --</option>
                      {employees.map((e) => (
                        <option key={e.emp_no} value={e.emp_no}>
                          {e.emp_no} — {e.name}
                        </option>
                      ))}
                    </select>
                    <div className="invalid-feedback">Please select an employee.</div>
                  </div>

                  <div className="row g-3">
                    <div className="col-sm-6">
                      <label className="form-label">Amount (AED) <span className="text-danger">*</span></label>
                      <input
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        className={`form-control ${touched.amount && !vAmt ? "is-invalid" : ""}`}
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        onBlur={() => setTouched((t) => ({ ...t, amount: true }))}
                        placeholder="e.g. 1500.00"
                        required
                      />
                      <div className="invalid-feedback">Enter a positive amount.</div>
                    </div>
                    <div className="col-sm-6">
                      <label className="form-label">Monthly installment (AED) <span className="text-danger">*</span></label>
                      <input
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        className={`form-control ${touched.installment && !vMi ? "is-invalid" : ""}`}
                        value={installment}
                        onChange={(e) => setInstallment(e.target.value)}
                        onBlur={() => setTouched((t) => ({ ...t, installment: true }))}
                        placeholder="e.g. 500.00"
                        required
                      />
                      <div className="invalid-feedback">Monthly installment must be greater than 0.</div>
                    </div>
                  </div>

                  <div className="mt-3">
                    <label className="form-label">Note</label>
                    <input
                      className="form-control"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Reason for advance/ Addtional Notes"
                    />
                    <div className="form-text">Optional – visible in history.</div>
                  </div>
                </div>

                {/* Right: Summary / Guidance */}
                <div className="col-md-5">
                  <div className="border rounded-3 p-3 bg-light">
                    <div className="d-flex align-items-center mb-2">
                      <span className="badge text-bg-secondary me-2">Summary</span>
                      <span className="text-muted small">Quick check before posting</span>
                    </div>

                    <ul className="list-unstyled mb-3 small">
                      <li className="mb-1">
                        <span className="text-muted">Employee:</span>{" "}
                        <strong>{empNo ? `${empNo} — ${empName}` : "—"}</strong>
                      </li>
                      <li className="mb-1">
                        <span className="text-muted">Amount:</span>{" "}
                        <strong>{vAmt ? `AED ${amtNum.toFixed(2)}` : "—"}</strong>
                      </li>
                      <li className="mb-1">
                        <span className="text-muted">Monthly installment:</span>{" "}
                        <strong>{vMi ? `AED ${miNum.toFixed(2)}` : "—"}</strong>
                      </li>
                      <li className="mb-1">
                        <span className="text-muted">Month:</span>{" "}
                        <strong>{ym}</strong>
                      </li>
                      <li className="mb-1">
                        <span className="text-muted">Estimated payoff:</span>{" "}
                        <strong>{payoffText}</strong>
                      </li>
                    </ul>

                    <div className={`p-2 rounded bg-white border`}>
                      <div className="small text-muted mb-1">How it’s calculated</div>
                      <div className="fw-medium">
                        We divide the advance by the monthly installment and round up to whole months.
                      </div>
                    </div>

                    <div className="mt-3 small text-muted">
                      Tip: choose an installment that clears the advance within a reasonable period.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="modal-footer d-flex justify-content-between">
              <button type="button" className="btn btn-link" onClick={onClose} disabled={submitting}>
                Cancel
              </button>
              <button type="submit" className="btn btn-success" disabled={submitting || !(vEmp && vAmt && vMi)}>
                {submitting ? "Posting…" : "Post advance"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}



/** -------------------- History -------------------- */
function HistoryButton({ emp_no, balance, monthly_installment }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const r = await API(`/advances/${encodeURIComponent(emp_no)}/history`);
      if (!r.ok) throw new Error();
      setRows(await r.json());
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && rows == null) load();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Compute estimated payoff
  let payoffText = "N/A";
  if (monthly_installment > 0) {
    const monthsToClear = Math.ceil(balance / monthly_installment);
    const payoffDate = new Date();
    payoffDate.setMonth(payoffDate.getMonth() + monthsToClear);
    payoffText = `${monthsToClear} month${monthsToClear > 1 ? "s" : ""} — ${format(payoffDate, "MMM yyyy")}`;
  }

  return (
    <>
      <button
        className="btn btn-sm btn-outline-info"
        onClick={() => setOpen(true)}
        disabled={open}
      >
        History
      </button>
      {open && (
        <div className="mt-2">
          <div className="card card-body shadow-sm">
            {/* Header with Close button */}
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h6 className="m-0">History — {emp_no}</h6>
                <small className="text-muted">
                  Est. payoff: <strong>{payoffText}</strong>
                </small>
              </div>
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>

            {loading ? (
              "Loading…"
            ) : rows?.length ? (
              <div className="table-responsive">
                <table className="table table-sm table-hover align-middle">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>YM</th>
                      <th>Type</th>
                      <th className="text-end">Amount</th>
                      <th>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <td>{r.ts?.slice(0, 10)}</td>
                        <td>{r.ym}</td>
                        <td>{r.type}</td>
                        <td className="text-end">
                          {Number(r.amount || 0).toFixed(2)}
                        </td>
                        <td>{r.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <em className="text-muted">No transactions.</em>
            )}
          </div>
        </div>
      )}
    </>
  );
}
