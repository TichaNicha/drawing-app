import React, { useEffect } from 'react';

function Toolbar({ setColor, setPenSize, onScrambleColors, colors }) {
  useEffect(() => {
    const handleKeydown = (e) => {
      if (e.code === 'Space') {
        e.preventDefault(); // prevent default spacebar action (scrolling)
        onScrambleColors();
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
    };
  }, []);

  return (
    <div>
      <button onClick={onScrambleColors}>Scramble Colors</button>
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
        max="30"
        onChange={(e) => setPenSize(e.target.value)}
      />
      <button onClick={() => setColor('#FFFFFF')}>Eraser</button>
    </div>
  );
}

export default Toolbar;
