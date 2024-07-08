import React, { useEffect } from 'react';
import './Toolbar.css'; // Import CSS file for Toolbar styles

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
    <div className="toolbar">
      <div className="toolbar-buttons">
        <button className="toolbar-button" onClick={onScrambleColors}>
          Scramble Colors
        </button>
        {colors.map((color, index) => (
          <button
            key={index}
            onClick={() => setColor(color)}
            style={{ backgroundColor: color }}
            className="toolbar-color-button"
          />
        ))}
        <input
          type="range"
          min="1"
          max="20"
          onChange={(e) => setPenSize(e.target.value)}
          className="toolbar-slider"
        />
        <button onClick={() => setColor('#FFFFFF')} className="toolbar-button">
          Eraser
        </button>
      </div>
    </div>
  );
}

export default Toolbar;
