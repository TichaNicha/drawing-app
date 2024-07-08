export function generateColors() {
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
  