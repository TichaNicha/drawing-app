import React, { useRef, useEffect } from 'react';

function Canvas({ color, penSize }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;

    const startDrawing = (e) => {
      isDrawing = true;
      const rect = canvas.getBoundingClientRect();
      [lastX, lastY] = [e.clientX - rect.left, e.clientY - rect.top];
    };

    const draw = (e) => {
      if (!isDrawing) return;

      const rect = canvas.getBoundingClientRect();
      let currentX, currentY;

      if (e.touches && e.touches.length > 0) {
        currentX = e.touches[0].clientX - rect.left;
        currentY = e.touches[0].clientY - rect.top;
      } else {
        currentX = e.clientX - rect.left;
        currentY = e.clientY - rect.top;
      }

      ctx.strokeStyle = color;
      ctx.lineWidth = penSize;
      ctx.lineCap = 'round';

      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(currentX, currentY);
      ctx.stroke();

      [lastX, lastY] = [currentX, currentY];
    };

    const stopDrawing = () => {
      isDrawing = false;
    };

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);

    canvas.addEventListener('touchstart', startDrawing);
    canvas.addEventListener('touchmove', draw);
    canvas.addEventListener('touchend', stopDrawing);
    canvas.addEventListener('touchcancel', stopDrawing);

    return () => {
      canvas.removeEventListener('mousedown', startDrawing);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseup', stopDrawing);
      canvas.removeEventListener('mouseout', stopDrawing);

      canvas.removeEventListener('touchstart', startDrawing);
      canvas.removeEventListener('touchmove', draw);
      canvas.removeEventListener('touchend', stopDrawing);
      canvas.removeEventListener('touchcancel', stopDrawing);
    };
  }, [color, penSize]);

  return (
    <div style={{ overflow: 'hidden', touchAction: 'none' }}>
      <canvas
        ref={canvasRef}
        width="800"
        height="600"
        style={{ border: '1px solid #000', display: 'block', margin: 'auto' }}
      />
    </div>
  );
}

export default Canvas;
