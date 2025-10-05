export const BOARD_SIZE = 8;

export const createInitialBoard = () => {
  const emptyRow = () => Array.from({ length: BOARD_SIZE }, () => null);
  const board = Array.from({ length: BOARD_SIZE }, emptyRow);

  const backRank = [
    "rook",
    "knight",
    "bishop",
    "queen",
    "king",
    "bishop",
    "knight",
    "rook",
  ];

  backRank.forEach((type, col) => {
    board[0][col] = { type, color: "black", hasMoved: false };
    board[7][col] = { type, color: "white", hasMoved: false };
  });

  for (let col = 0; col < BOARD_SIZE; col += 1) {
    board[1][col] = { type: "pawn", color: "black", hasMoved: false };
    board[6][col] = { type: "pawn", color: "white", hasMoved: false };
  }

  return board;
};

export const cloneBoard = (board) =>
  board.map((row) => row.map((square) => (square ? { ...square } : null)));

export const movePiece = (board, from, to) => {
  const nextBoard = cloneBoard(board);
  const piece = nextBoard[from.row][from.col];
  nextBoard[from.row][from.col] = null;
  nextBoard[to.row][to.col] = piece ? { ...piece, hasMoved: true } : null;
  return nextBoard;
};

const isInsideBoard = (row, col) =>
  row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;

const pushIfValid = (board, moves, row, col, color, options = {}) => {
  if (!isInsideBoard(row, col)) return false;
  const target = board[row][col];
  if (!target) {
    moves.push({ row, col, capture: false, ...options });
    return true;
  }
  if (target.color !== color) {
    moves.push({ row, col, capture: true, ...options });
  }
  return false;
};

const getSlidingMoves = (board, from, color, directions) => {
  const moves = [];
  directions.forEach(([dr, dc]) => {
    let row = from.row + dr;
    let col = from.col + dc;
    while (isInsideBoard(row, col)) {
      const canContinue = pushIfValid(board, moves, row, col, color);
      if (!canContinue) break;
      row += dr;
      col += dc;
    }
  });
  return moves;
};

const getPseudoLegalMoves = (board, from) => {
  const piece = board[from.row][from.col];
  if (!piece) return [];
  const moves = [];

  switch (piece.type) {
    case "pawn": {
      const direction = piece.color === "white" ? -1 : 1;
      const startRow = piece.color === "white" ? 6 : 1;
      const nextRow = from.row + direction;
      if (isInsideBoard(nextRow, from.col) && !board[nextRow][from.col]) {
        moves.push({ row: nextRow, col: from.col, capture: false });
        const doubleRow = from.row + direction * 2;
        if (from.row === startRow && !board[doubleRow][from.col]) {
          moves.push({ row: doubleRow, col: from.col, capture: false, special: "double" });
        }
      }
      [from.col - 1, from.col + 1].forEach((col) => {
        const row = from.row + direction;
        if (!isInsideBoard(row, col)) return;
        const target = board[row][col];
        if (target && target.color !== piece.color) {
          moves.push({ row, col, capture: true });
        }
      });
      break;
    }
    case "rook":
      moves.push(
        ...getSlidingMoves(board, from, piece.color, [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ])
      );
      break;
    case "bishop":
      moves.push(
        ...getSlidingMoves(board, from, piece.color, [
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1],
        ])
      );
      break;
    case "queen":
      moves.push(
        ...getSlidingMoves(board, from, piece.color, [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1],
        ])
      );
      break;
    case "king": {
      const offsets = [
        [1, 0],
        [1, 1],
        [0, 1],
        [-1, 1],
        [-1, 0],
        [-1, -1],
        [0, -1],
        [1, -1],
      ];
      offsets.forEach(([dr, dc]) => {
        const row = from.row + dr;
        const col = from.col + dc;
        if (!isInsideBoard(row, col)) return;
        const target = board[row][col];
        if (!target || target.color !== piece.color) {
          moves.push({ row, col, capture: !!target });
        }
      });
      break;
    }
    case "knight": {
      const offsets = [
        [2, 1],
        [1, 2],
        [-1, 2],
        [-2, 1],
        [-2, -1],
        [-1, -2],
        [1, -2],
        [2, -1],
      ];
      offsets.forEach(([dr, dc]) => {
        const row = from.row + dr;
        const col = from.col + dc;
        if (!isInsideBoard(row, col)) return;
        const target = board[row][col];
        if (!target || target.color !== piece.color) {
          moves.push({ row, col, capture: !!target });
        }
      });
      break;
    }
    default:
      break;
  }

  return moves;
};

export const isKingInCheck = (board, color) => {
  let kingPosition = null;
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const piece = board[row][col];
      if (piece && piece.type === "king" && piece.color === color) {
        kingPosition = { row, col };
        break;
      }
    }
    if (kingPosition) break;
  }

  if (!kingPosition) return false;

  const opponentColor = color === "white" ? "black" : "white";
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const piece = board[row][col];
      if (!piece || piece.color !== opponentColor) continue;
      const moves = getPseudoLegalMoves(board, { row, col });
      if (
        moves.some(
          (move) => move.row === kingPosition.row && move.col === kingPosition.col
        )
      ) {
        return true;
      }
    }
  }

  return false;
};

export const getLegalMoves = (board, from) => {
  const piece = board[from.row][from.col];
  if (!piece) return [];
  const pseudoMoves = getPseudoLegalMoves(board, from);
  return pseudoMoves.filter((move) => {
    const nextBoard = movePiece(board, from, { row: move.row, col: move.col });
    return !isKingInCheck(nextBoard, piece.color);
  });
};
