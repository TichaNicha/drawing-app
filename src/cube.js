export const CUBE_HALF_SIZE = 1.8;
const s = CUBE_HALF_SIZE;

export const CUBE_VERTICES = [
  [-s, -s, s], [s, -s, s], [s, s, s], [-s, s, s],
  [-s, -s, -s], [s, -s, -s], [s, s, -s], [-s, s, -s],
];

export const CUBE_FACES = {
  front: [0, 1, 2, 3].map((index) => CUBE_VERTICES[index]),
  back: [5, 4, 7, 6].map((index) => CUBE_VERTICES[index]),
  right: [1, 5, 6, 2].map((index) => CUBE_VERTICES[index]),
  left: [4, 0, 3, 7].map((index) => CUBE_VERTICES[index]),
  top: [3, 2, 6, 7].map((index) => CUBE_VERTICES[index]),
  bottom: [4, 5, 1, 0].map((index) => CUBE_VERTICES[index]),
};

export const FACE_COLORS = {
  front: '#7dd3fc', back: '#7dd3fc',
  right: '#a78bfa', left: '#a78bfa',
  top: '#6ee7b7', bottom: '#6ee7b7',
};

const FACE_NORMALS = {
  front: [0, 0, 1], back: [0, 0, -1],
  right: [1, 0, 0], left: [-1, 0, 0],
  top: [0, 1, 0], bottom: [0, -1, 0],
};

export function getVisibleFaceNames(position) {
  return Object.keys(CUBE_FACES).filter((name) => {
    const [x, y, z] = FACE_NORMALS[name];
    return position.x * x + position.y * y + position.z * z > s;
  });
}
