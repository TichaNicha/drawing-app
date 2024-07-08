import React from 'react';
import './Modal.css';

function Modal({ show, onConfirm, onCancel }) {
  if (!show) {
    return null;
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>Are you sure you want to scramble the colours?<br></br>
            WARNING: This will reset the canvas!!</h3>
        <button onClick={onConfirm}>Yes</button>
        <button onClick={onCancel}>No</button>
      </div>
    </div>
  );
}

export default Modal;
