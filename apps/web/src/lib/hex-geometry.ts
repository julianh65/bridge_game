export const HEX_SIZE = 26;
const SQRT_3 = Math.sqrt(3);

export const axialToPixel = (q: number, r: number) => {
  return {
    x: HEX_SIZE * SQRT_3 * (q + r / 2),
    y: HEX_SIZE * 1.5 * r
  };
};

export const hexPoints = (x: number, y: number, size: number = HEX_SIZE) => {
  const points: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    points.push(`${x + size * Math.cos(angle)},${y + size * Math.sin(angle)}`);
  }
  return points.join(" ");
};
