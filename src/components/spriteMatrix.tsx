import { type CSSProperties } from 'react';

export const SpriteMatrix = ({
  backgroundImage,
  rows = 1,
  columns = 1,
  width = '100%',
  height = '100vh',
  rowStyles = [],
  columnStyles = [],
  cellGap = 0,
  style = {},
  cellStyle = {},
  ...rest
}: SpriteMatrixProps) => {
  const cells = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      cells.push(
        <div
          key={`${row}-${col}`}
          style={{
            backgroundImage,
            backgroundSize: `${columns * 100}% ${rows * 100}%`,
            backgroundPosition: `${getBackgroundPosition(col, columns)}% ${getBackgroundPosition(row, rows)}%`,
            backgroundRepeat: 'no-repeat',
            ...cellStyle,
            ...columnStyles[col],
            ...rowStyles[row],
          }}
        />
      );
    }
  }

  return (
    <div
      {...rest}
      style={{
        display: 'grid',
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: cellGap,
        width,
        height,
        ...style,
      }}
    >
      {cells}
    </div>
  );
};

function getBackgroundPosition(cell: number, total: number) {
  if (total <= 1) return 0;
  return (cell / (total - 1)) * 100;
}

type SpriteMatrixProps = {
  backgroundImage: string;
  rows?: number;
  columns?: number;
  width?: string;
  height?: string;
  rowStyles?: CSSProperties[];
  columnStyles?: CSSProperties[];
  cellGap?: number;
  style?: CSSProperties;
  cellStyle?: CSSProperties;
} & React.HTMLAttributes<HTMLDivElement>;
