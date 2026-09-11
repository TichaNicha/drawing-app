// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  configurable: true,
  value: () => ({
    clearRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    closePath: () => {},
    save: () => {},
    restore: () => {},
    fill: () => {},
    arc: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    rect: () => {},
    fillText: () => {},
    setTransform: () => {},
    scale: () => {},
    translate: () => {},
    rotate: () => {},
  }),
});
