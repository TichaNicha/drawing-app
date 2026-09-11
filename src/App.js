import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { CUBE_FACES, FACE_COLORS, getVisibleFaceNames } from './cube';
import PerspectiveGuides from './PerspectiveGuides';
import { BOARD_WIDTH, BOARD_HEIGHT, PERSPECTIVE_MODES, createPerspectiveCamera, projectToScreen } from './perspective';
import { getMissingEdges, scoreDrawing } from './scoring';
import './App.css';

const PEN_SIZE = 5;
const INK_COLOR = '#f8fafc';
const SCORE_COMPONENTS = [
  { key: 'accuracy', label: 'Accuracy', description: 'How closely your lines follow the target edges.' },
  { key: 'completeness', label: 'Completeness', description: 'How much of the required edge length you have drawn.' },
  { key: 'cleanliness', label: 'Cleanliness', description: 'How little stray ink lies away from the target edges.' },
];

const challenges = {
  one: { label: '1 face', count: 1, accent: '#fbbf24' },
  two: { label: '2 faces', count: 2, accent: '#38bdf8' },
  all: { label: 'all faces', count: 3, accent: '#34d399' },
};

function buildScoringEdges(solutionFaces, suppliedFaces, camera) {
  const faces = Object.fromEntries(solutionFaces.map((name) => [name, CUBE_FACES[name]]));
  const supplied = Object.fromEntries(suppliedFaces.map((name) => [name, CUBE_FACES[name]]));
  const projectEdges = (edges) => edges.map((edge) => edge.map((point) => projectToScreen(point, camera)));
  return {
    targetEdges: projectEdges(getMissingEdges(faces, suppliedFaces)),
    suppliedEdges: projectEdges(getMissingEdges(supplied, [])),
  };
}

function getPointerPosition(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  const x = Math.max(0, Math.min(canvas.width, ((event.clientX - rect.left) / rect.width) * canvas.width));
  const y = Math.max(0, Math.min(canvas.height, ((event.clientY - rect.top) / rect.height) * canvas.height));
  return { x, y };
}

function appendPoint(points, point) {
  const last = points[points.length - 1];
  return last && last.x === point.x && last.y === point.y ? points : [...points, point];
}

function App() {
  const overlayRef = useRef(null);
  const sceneRef = useRef(null);
  // Pointer events can arrive before React commits a queued drawing update.
  const drawingRef = useRef({ strokes: [], currentStroke: [], pointerId: null });
  const [selectedChallenge, setSelectedChallenge] = useState('two');
  const [perspective, setPerspective] = useState('two');
  const [strokes, setStrokes] = useState([]);
  const [currentStroke, setCurrentStroke] = useState([]);
  const [result, setResult] = useState(null);
  const [showSolution, setShowSolution] = useState(false);
  const [rendererError, setRendererError] = useState(false);
  const [seed, setSeed] = useState(() => Math.random());
  const [message, setMessage] = useState('Draw only the missing edges. You do not need to retrace the supplied faces.');
  const isTracing = selectedChallenge === 'all';

  const camera = useMemo(() => createPerspectiveCamera(perspective, seed), [perspective, seed]);
  const solutionFaces = useMemo(() => getVisibleFaceNames(camera.position), [camera]);
  const suppliedFaces = useMemo(
    () => solutionFaces.slice(0, challenges[selectedChallenge].count),
    [solutionFaces, selectedChallenge]
  );
  const { targetEdges, suppliedEdges } = useMemo(
    () => buildScoringEdges(solutionFaces, isTracing ? [] : suppliedFaces, camera),
    [solutionFaces, suppliedFaces, camera, isTracing]
  );
  const visibleFaces = useMemo(
    () => showSolution ? solutionFaces : suppliedFaces,
    [solutionFaces, suppliedFaces, showSolution]
  );
  const canDraw = targetEdges.length > 0 && !showSolution;

  const releasePointer = useCallback(() => {
    const pointerId = drawingRef.current.pointerId;
    drawingRef.current.pointerId = null;
    const canvas = overlayRef.current;
    if (pointerId !== null && canvas?.hasPointerCapture(pointerId)) {
      canvas.releasePointerCapture(pointerId);
    }
  }, []);

  useEffect(() => () => releasePointer(), [releasePointer]);

  useEffect(() => {
    if (!sceneRef.current) return;
    const mount = sceneRef.current;
    const scene = new THREE.Scene();
    let renderer;

    const dispose = () => {
      scene.traverse((object) => {
        object.geometry?.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material?.dispose());
      });
      if (renderer) {
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
      }
    };

    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setClearColor(0x000000, 0);
      renderer.setSize(BOARD_WIDTH, BOARD_HEIGHT);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.domElement.style.position = 'absolute';
      renderer.domElement.style.inset = '0';
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      mount.appendChild(renderer.domElement);

      const ambient = new THREE.AmbientLight('#dbeafe', 1.2);
      scene.add(ambient);

      const dir = new THREE.DirectionalLight('#ffffff', 1.6);
      dir.position.set(4, 6, 5);
      scene.add(dir);

      const pointGroup = new THREE.Group();
      visibleFaces.forEach((faceName) => {
        const points = CUBE_FACES[faceName];
        const material = new THREE.LineBasicMaterial({
          color: FACE_COLORS[faceName],
        });

        const geometry = new THREE.BufferGeometry().setFromPoints(points.map((point) => new THREE.Vector3(...point)));
        const line = new THREE.LineLoop(geometry, material);
        line.name = faceName;
        pointGroup.add(line);
      });

      scene.add(pointGroup);
      renderer.render(scene, camera);
      setRendererError(false);
    } catch (error) {
      console.warn('Unable to start the 3D renderer; showing the projected guide instead.', error);
      setRendererError(true);
      dispose();
      return;
    }

    return dispose;
  }, [camera, visibleFaces]);

  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = PEN_SIZE;
    ctx.strokeStyle = INK_COLOR;

    strokes.forEach((points) => {
      if (points.length < 1) return;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i += 1) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.stroke();
    });

    if (currentStroke.length > 0) {
      ctx.beginPath();
      ctx.moveTo(currentStroke[0].x, currentStroke[0].y);
      for (let i = 1; i < currentStroke.length; i += 1) {
        ctx.lineTo(currentStroke[i].x, currentStroke[i].y);
      }
      ctx.stroke();
    }
  }, [strokes, currentStroke]);

  const startDrawing = (event) => {
    if (!canDraw || drawingRef.current.pointerId !== null || !event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    const canvas = overlayRef.current;
    const point = getPointerPosition(event, canvas);
    canvas.setPointerCapture(event.pointerId);
    drawingRef.current.pointerId = event.pointerId;
    drawingRef.current.currentStroke = [point];
    setCurrentStroke(drawingRef.current.currentStroke);
  };

  const draw = (event) => {
    if (drawingRef.current.pointerId !== event.pointerId || !canDraw) return;
    const canvas = overlayRef.current;
    const point = getPointerPosition(event, canvas);
    drawingRef.current.currentStroke = appendPoint(drawingRef.current.currentStroke, point);
    setCurrentStroke(drawingRef.current.currentStroke);
  };

  const stopDrawing = useCallback((event) => {
    const drawing = drawingRef.current;
    if (drawing.pointerId === null || drawing.pointerId !== event.pointerId) return;
    if (event.type === 'pointerup') {
      drawing.currentStroke = appendPoint(drawing.currentStroke, getPointerPosition(event, overlayRef.current));
    }
    if (drawing.currentStroke.length > 0) {
      drawing.strokes = [...drawing.strokes, drawing.currentStroke];
      setStrokes(drawing.strokes);
    }
    drawing.currentStroke = [];
    releasePointer();
    setCurrentStroke([]);
  }, [releasePointer]);

  const resetAttempt = (challenge = selectedChallenge, nextPerspective = perspective) => {
    releasePointer();
    drawingRef.current = { strokes: [], currentStroke: [], pointerId: null };
    setSelectedChallenge(challenge);
    setPerspective(nextPerspective);
    setStrokes([]);
    setCurrentStroke([]);
    setShowSolution(false);
    setResult(null);
    setMessage(challenge === 'all'
      ? 'Trace every visible edge as accurately as possible. Shared edges only need to be traced once.'
      : 'Draw only the missing edges. You do not need to retrace the supplied faces.');
    setSeed(Math.random());
  };

  const calculateScore = () => {
    if (!canDraw) return;
    const drawing = drawingRef.current;
    const attempt = drawing.currentStroke.length > 0
      ? [...drawing.strokes, drawing.currentStroke]
      : drawing.strokes;
    const nextResult = scoreDrawing(attempt, targetEdges, suppliedEdges);
    if (nextResult === null) return;
    const nextScore = nextResult.score;

    releasePointer();
    drawingRef.current = { strokes: attempt, currentStroke: [], pointerId: null };
    setStrokes(attempt);
    setCurrentStroke([]);
    setResult(nextResult);
    setShowSolution(true);

    if (isTracing) {
      setMessage(attempt.length === 0
        ? 'No trace drawn. Clear to try tracing the cube.'
        : nextScore >= 85
          ? 'Strong tracing! Compare your lines with the cube outline.'
          : 'Compare your trace with the cube. Cover every edge and avoid stray marks, then clear to try again.');
    } else if (attempt.length === 0) {
      setMessage('No lines drawn. The solution is now shown; clear to try completing the missing edges.');
    } else if (nextScore >= 85) {
      setMessage('Strong match on the missing edges. Compare your drawing with the revealed solution.');
    } else if (nextScore >= 60) {
      setMessage('Solid attempt. A few more lines would complete the form.');
    } else if (nextScore >= 30) {
      setMessage('You are close, but the perspective is drifting.');
    } else {
      setMessage('Compare your drawing with the revealed solution, then clear to try the missing edges again.');
    }
  };

  const challengeFaces = useMemo(() => {
    const faces = {};
    solutionFaces.forEach((faceName) => {
      faces[faceName] = CUBE_FACES[faceName].map((point) => projectToScreen(point, camera));
    });
    return faces;
  }, [solutionFaces, camera]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="panel-header">
          <p className="eyebrow">Pencil challenge</p>
          <h1>3D Square</h1>
        </div>

        <fieldset className="picker-group">
          <legend>Perspective</legend>
          <div className="challenge-picker">
            {Object.entries(PERSPECTIVE_MODES).map(([key, config], index) => (
              <button
                key={key}
                type="button"
                className={`difficulty-button ${perspective === key ? 'active' : ''}`}
                style={{ '--accent': '#7dd3fc' }}
                aria-label={`${index + 1} vanishing point${index === 0 ? '' : 's'}`}
                aria-pressed={perspective === key}
                onClick={() => resetAttempt(selectedChallenge, key)}
              >
                {config.label}
              </button>
            ))}
          </div>
          <p className="perspective-help">{PERSPECTIVE_MODES[perspective].description}</p>
        </fieldset>

        <fieldset className="picker-group">
          <legend>Faces provided</legend>
          <div className="challenge-picker">
            {Object.entries(challenges).map(([key, config]) => (
              <button
                key={key}
                type="button"
                className={`difficulty-button ${selectedChallenge === key ? 'active' : ''}`}
                style={{ '--accent': config.accent }}
                aria-pressed={selectedChallenge === key}
                onClick={() => resetAttempt(key)}
              >
                {config.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="score-card">
          <span className="score-label">Overall score</span>
          <strong><output aria-label="Overall score">{result === null ? '—' : `${result.score}%`}</output></strong>
        </div>

        <dl className="score-breakdown" aria-label="Score breakdown">
          {SCORE_COMPONENTS.map(({ key, label, description }) => (
            <div key={key} title={description}>
              <dt>{label}</dt>
              <dd><output aria-label={`${label} subscore`}>{result === null ? '—' : `${result[key]}%`}</output></dd>
            </div>
          ))}
        </dl>
        <p className="scoring-help">Completeness caps your score. Inaccuracy and stray marks reduce it further.</p>

        <p className="status-text">{message}</p>

        <div className="action-row">
          <button type="button" className="primary-action" onClick={calculateScore} disabled={!canDraw}>
            Score attempt
          </button>
          <button type="button" className="secondary-action" onClick={() => resetAttempt()}>
            Clear
          </button>
        </div>
      </aside>

      <main className="arena">
        <div className="board-shell">
          <div className="board-header">
            <span>{isTracing
              ? showSolution ? 'Trace scored' : 'Tracing challenge'
              : showSolution ? 'Solution revealed' : 'Challenge board'}</span>
            <span>{isTracing ? 'Goal: trace all visible edges' : 'Goal: complete the square'}</span>
          </div>

          {rendererError && (
            <p className="renderer-notice" role="alert">
              The 3D renderer could not start. You can still draw using the projected guide.
              {' '}Try enabling WebGL or hardware acceleration in your browser, then reload.
            </p>
          )}

          <div className="board-frame">
            <div ref={sceneRef} className="scene-layer" />

            <svg className="guide-layer" viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`} preserveAspectRatio="xMidYMid meet">
              {visibleFaces.map((faceName) => {
                const points = challengeFaces[faceName];
                const polygonPoints = points.map((point) => `${point.x},${point.y}`).join(' ');
                const strokeColor = FACE_COLORS[faceName];
                return (
                  <g key={faceName}>
                    <polygon
                      points={polygonPoints}
                      fill={`${strokeColor}1a`}
                      stroke={strokeColor}
                      strokeWidth={2.4}
                      strokeLinejoin="round"
                      opacity={showSolution ? 0.95 : 0.45}
                    />
                    {points.map((point, index) => {
                      const next = points[(index + 1) % points.length];
                      return (
                        <line
                          key={`${faceName}-edge-${index}`}
                          x1={point.x}
                          y1={point.y}
                          x2={next.x}
                          y2={next.y}
                          stroke={strokeColor}
                          strokeWidth={4}
                          strokeLinecap="round"
                        />
                      );
                    })}
                  </g>
                );
              })}
              <PerspectiveGuides camera={camera} />
            </svg>

            <canvas
              ref={overlayRef}
              width={BOARD_WIDTH}
              height={BOARD_HEIGHT}
              className="drawing-layer"
              aria-label="Drawing canvas"
              aria-disabled={!canDraw}
              onPointerDown={startDrawing}
              onPointerMove={draw}
              onPointerUp={stopDrawing}
              onPointerCancel={stopDrawing}
              onLostPointerCapture={stopDrawing}
            />
          </div>
          <p className="guide-note">All vanishing points are on the board. Clear generates a new randomized camera view.</p>
        </div>
      </main>
    </div>
  );
}

export default App;
