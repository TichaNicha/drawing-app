import logo from './logo.svg';
import './App.css';
import chroma from 'chroma-js';

// generate 3 random colours
function generateRandomPalette(){

  // gen rand colour
  const baseColour = chroma.random();

  // gen triadic colour palette based on random colour
  const triadicPalette = chroma.scale([baseColour, baseColour.saturate(), baseColour.saturate().darker()]);

  return triadicPalette.colors(3);
}

console.log(generateRandomPalette());

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.js</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header>
    </div>
  );
}

export default App;
