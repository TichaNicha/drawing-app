import React, { useState, useEffect } from 'react';

function Toolbar({ setColor, setPenSize, clearCanvas }) {
  const [colors, setColors] = useState(generateColors());

  function generateColors() {
    const letters = '0123456789ABCDEF';
    const getColor = () => {
      let color = '#';
      for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
      }
      return color;
    };
    return [getColor(), getColor(), getColor()];
  }

  const scrambleColors = () => {
    setColors(generateColors());
    clearCanvas();
  };

  useEffect(() => {
    const handleKeydown = (e) => {
      if (e.code === 'Space') {
        e.preventDefault(); // prevent default spacebar action (scrolling)
        scrambleColors();
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
    };
  }, []);

  return (
    <div>
      <button onClick={scrambleColors}>Scramble Colors</button>
      <div>
        {colors.map((color, index) => (
          <button
            key={index}
            onClick={() => setColor(color)}
            style={{ backgroundColor: color }}
          >
            Color {index + 1}
          </button>
        ))}
      </div>
      <input
        type="range"
        min="1"
        max="20"
        onChange={(e) => setPenSize(e.target.value)}
      />
      <button onClick={() => setColor('#FFFFFF')}>Eraser</button>
    </div>
  );
}

export default Toolbar;
