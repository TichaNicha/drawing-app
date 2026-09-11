# Drawing challenge

Choose **1 face** or **2 faces**, then draw the missing edges to complete the shape.
Edges already supplied by a visible face, including shared boundaries, do not need
to be retraced. Missing faces are not rendered until you submit.

Choose **All faces** for a scored tracing challenge: trace every visible edge of
the cube as accurately as possible. Shared edges only need to be traced once.
You receive an overall percentage and three subscores, just like the completion modes.

Choose **1 point**, **2 points**, or **3 points** to change the actual camera
perspective. One-point views keep the facing square horizontal and vertical;
two-point views keep vertical edges parallel; three-point views converge in all
three directions. Every new attempt varies the camera position, distance, and
framing within the selected mode, including views from above, below, left,
right, front, and back. Two- and three-point modes also vary the viewing angles.

The grids have been replaced with vanishing-point markers and a horizon derived
from the same camera used for the shape and scoring. The camera's field of view
and framing are fitted so **every vanishing point stays on the board**, with
space around the shape. Markers are at their actual projected positions, not
clamped to the edges.
The guides do not reveal any hidden edges or vertices.

The shape is a complete cube with equal square faces. Each viewpoint selects
the correct three facing surfaces, including left, back, or bottom faces when
appropriate. Scoring considers their missing edges in completion modes, or all
nine unique visible edges in tracing mode. The occluded faces on the far side
of the cube are never scoring targets.

The scoring breakdown shows:

- **Accuracy:** a smooth distance-based grade for the edge portions you draw.
  Closer lines earn more credit; there is no longer a flat 18-pixel pass band.
- **Completeness:** the actual proportion of required edge length traced.
  Strokes are projected onto their nearest edge and overlapping intervals are
  merged. Undrawn gaps stay gaps, and shared edges count only once.
- **Cleanliness:** unique traced edge length compared with that length plus
  stray ink. Extra marks and overshooting lower this component. Repeating an
  already traced line cannot dilute the penalty.

The overall score multiplies the three unrounded fractions, then rounds to a
percentage. **Completeness caps the overall score:** an otherwise perfect
half-finished drawing can earn at most 50%.

Distances are normalized to the diagonal of the projected cube's bounding box,
including supplied edges. Scaling the same drawing and shape together therefore
keeps the score unchanged. The defaults in `SCORING_SETTINGS` in `src/scoring.js`
use a 0.5% sampling step, a 6% maximum matching distance, and a Gaussian accuracy
falloff with a 2% distance scale. Blank attempts receive zero for all components.

In **1 face** and **2 faces**, ink nearest a supplied edge within the matching
distance is neutral: it neither earns missing-edge credit nor penalizes an
otherwise correct completion. In **All faces**, all visible outlines are targets.
The evaluation uses line segments, not the number of pointer events.

Drawing follows one primary mouse, touch, or pen pointer until release or
cancellation. Extra fingers and non-drawing mouse buttons are ignored. The final
release position is included in the stroke, and captured input is kept within
the drawing board. Cancellation preserves the existing ink without adding an
artificial endpoint.

Submitting locks the drawing and score for comparison, revealing any missing faces.
**Clear** or switching face/perspective modes starts a fresh view and removes old strokes.

## Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
