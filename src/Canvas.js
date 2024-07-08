import React, { useRef, useState, useEffect } from 'react';

function Canvas({ color, penSize, canvasRef }) {
  const [drawing, setDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const startDrawing = (e) => {
      setDrawing(true);
      draw(e);
    };

    const stopDrawing = () => {
      setDrawing(false);
      ctx.beginPath();
    };

    const draw = (e) => {
      if (!drawing) return;

      ctx.lineWidth = penSize;
      ctx.lineCap = 'round';
      ctx.strokeStyle = color;

      // Adjust coordinates for touch devices
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      ctx.lineTo(clientX - canvas.offsetLeft, clientY - canvas.offsetTop);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(clientX - canvas.offsetLeft, clientY - canvas.offsetTop);
    };

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('touchstart', startDrawing);
    canvas.addEventListener('touchend', stopDrawing);
    canvas.addEventListener('touchmove', draw);

    return () => {
      canvas.removeEventListener('mousedown', startDrawing);
      canvas.removeEventListener('mouseup', stopDrawing);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('touchstart', startDrawing);
      canvas.removeEventListener('touchend', stopDrawing);
      canvas.removeEventListener('touchmove', draw);
    };
  }, [color, penSize, drawing]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <canvas
        ref={canvasRef}
        width="800"
        height="600"
        style={{ border: '1px solid #000' }}
      />
    </div>
  );
}

export default Canvas;
