import React from "react";

function ConfirmModal({ open, title, message, confirmText = "Confirm", confirmVariant = "primary", onCancel, onConfirm }) {
  if (!open) return null;
  return (
    <div className="modal" style={{ display: "block", background: "rgba(0,0,0,.5)" }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content" style={{ borderRadius: 12 }}>
          <div className="modal-header">
            <h5 className="modal-title">{title}</h5>
            <button className="btn-close" onClick={onCancel} />
          </div>
          <div className="modal-body">
            <p className="mb-0">{message}</p>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
            <button className={`btn btn-${confirmVariant}`} onClick={onConfirm}>{confirmText}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;