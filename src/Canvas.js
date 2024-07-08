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

      ctx.lineTo(e.clientX - canvas.offsetLeft, e.clientY - canvas.offsetTop);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(e.clientX - canvas.offsetLeft, e.clientY - canvas.offsetTop);
    };

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mousemove', draw);

    return () => {
      canvas.removeEventListener('mousedown', startDrawing);
      canvas.removeEventListener('mouseup', stopDrawing);
      canvas.removeEventListener('mousemove', draw);
    };
  }, [color, penSize, drawing]);

  return (
    <canvas ref={canvasRef} width="800" height="600" style={{ border: '1px solid #000' }} />
  );
}

export default Canvas;
