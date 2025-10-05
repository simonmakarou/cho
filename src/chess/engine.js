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
    board[1][col] = {
      type: "pawn",
      color: "black",
      hasMoved: false,
      enPassantEligible: false,
    };
    board[6][col] = {
      type: "pawn",
      color: "white",
      hasMoved: false,
      enPassantEligible: false,
    };
  }

  return board;
};

export const cloneBoard = (board) =>
  board.map((row) => row.map((square) => (square ? { ...square } : null)));

export const movePiece = (board, from, to) => {
  const nextBoard = cloneBoard(board);
  const piece = nextBoard[from.row][from.col];

  if (!piece) {
    return {
      board: nextBoard,
      promotionNeeded: false,
      promotionSquare: null,
      capturedPiece: null,
      specialMove: null,
    };
  }

  const targetFromOriginal = board[to.row][to.col] || null;
  let capturedPiece = targetFromOriginal;
  let specialMove = null;

  if (piece.type === "pawn") {
    const isEnPassantMove =
      to.col !== from.col &&
      !targetFromOriginal &&
      !!board[from.row][to.col] &&
      board[from.row][to.col].type === "pawn" &&
      board[from.row][to.col].color !== piece.color &&
      board[from.row][to.col].enPassantEligible;

    if (isEnPassantMove) {
      capturedPiece = board[from.row][to.col];
      nextBoard[from.row][to.col] = null;
      specialMove = "enPassant";
    }
  }

  nextBoard[from.row][from.col] = null;

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const candidate = nextBoard[row][col];
      if (candidate && candidate.type === "pawn") {
        candidate.enPassantEligible = false;
      }
    }
  }

  if (piece.type === "king" && Math.abs(to.col - from.col) === 2) {
    const isKingside = to.col > from.col;
    const rookFromCol = isKingside ? BOARD_SIZE - 1 : 0;
    const rookToCol = isKingside ? to.col - 1 : to.col + 1;
    const rook = nextBoard[from.row][rookFromCol];
    if (rook) {
      nextBoard[from.row][rookFromCol] = null;
      nextBoard[from.row][rookToCol] = { ...rook, hasMoved: true };
      specialMove = isKingside ? "castle-kingside" : "castle-queenside";
    }
  }

  const movedPiece = {
    ...piece,
    hasMoved: true,
  };

  if (piece.type === "pawn") {
    if (Math.abs(to.row - from.row) === 2) {
      movedPiece.enPassantEligible = true;
      if (!specialMove) specialMove = "double";
    } else {
      movedPiece.enPassantEligible = false;
    }
  }

  nextBoard[to.row][to.col] = movedPiece;

  let promotionNeeded = false;
  let promotionSquare = null;

  if (piece.type === "pawn") {
    const promotionRow = piece.color === "white" ? 0 : BOARD_SIZE - 1;
    if (to.row === promotionRow) {
      promotionNeeded = true;
      promotionSquare = { row: to.row, col: to.col, color: piece.color };
    }
  }

  return {
    board: nextBoard,
    promotionNeeded,
    promotionSquare,
    capturedPiece: capturedPiece || null,
    specialMove,
  };
};

const isInsideBoard = (row, col) =>
  row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;

const knightOffsets = [
  [2, 1],
  [1, 2],
  [-1, 2],
  [-2, 1],
  [-2, -1],
  [-1, -2],
  [1, -2],
  [2, -1],
];

const kingOffsets = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];

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

const isSquareAttackedInDirections = (
  board,
  from,
  target,
  directions
) => {
  for (const [dr, dc] of directions) {
    let row = from.row + dr;
    let col = from.col + dc;
    while (isInsideBoard(row, col)) {
      if (row === target.row && col === target.col) {
        return true;
      }
      if (board[row][col]) break;
      row += dr;
      col += dc;
    }
  }
  return false;
};

const isSquareAttacked = (board, square, attackerColor) => {
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const piece = board[row][col];
      if (!piece || piece.color !== attackerColor) continue;

      switch (piece.type) {
        case "pawn": {
          const direction = attackerColor === "white" ? -1 : 1;
          const attackRow = row + direction;
          if (attackRow === square.row && Math.abs(col - square.col) === 1) {
            return true;
          }
          break;
        }
        case "knight": {
          for (const [dr, dc] of knightOffsets) {
            if (row + dr === square.row && col + dc === square.col) {
              return true;
            }
          }
          break;
        }
        case "bishop": {
          if (
            isSquareAttackedInDirections(
              board,
              { row, col },
              square,
              [
                [1, 1],
                [1, -1],
                [-1, 1],
                [-1, -1],
              ]
            )
          ) {
            return true;
          }
          break;
        }
        case "rook": {
          if (
            isSquareAttackedInDirections(
              board,
              { row, col },
              square,
              [
                [1, 0],
                [-1, 0],
                [0, 1],
                [0, -1],
              ]
            )
          ) {
            return true;
          }
          break;
        }
        case "queen": {
          if (
            isSquareAttackedInDirections(
              board,
              { row, col },
              square,
              [
                [1, 0],
                [-1, 0],
                [0, 1],
                [0, -1],
                [1, 1],
                [1, -1],
                [-1, 1],
                [-1, -1],
              ]
            )
          ) {
            return true;
          }
          break;
        }
        case "king": {
          for (const [dr, dc] of kingOffsets) {
            if (row + dr === square.row && col + dc === square.col) {
              return true;
            }
          }
          break;
        }
        default:
          break;
      }
    }
  }

  return false;
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
      [from.col - 1, from.col + 1].forEach((col) => {
        const adjacent = board[from.row]?.[col];
        const row = from.row + direction;
        if (!isInsideBoard(row, col)) return;
        if (
          adjacent &&
          adjacent.type === "pawn" &&
          adjacent.color !== piece.color &&
          adjacent.enPassantEligible &&
          !board[row][col]
        ) {
          moves.push({ row, col, capture: true, special: "enPassant" });
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
      kingOffsets.forEach(([dr, dc]) => {
        const row = from.row + dr;
        const col = from.col + dc;
        if (!isInsideBoard(row, col)) return;
        const target = board[row][col];
        if (!target || target.color !== piece.color) {
          moves.push({ row, col, capture: !!target });
        }
      });
      if (!piece.hasMoved) {
        const opponentColor = piece.color === "white" ? "black" : "white";
        if (!isSquareAttacked(board, from, opponentColor)) {
          const attemptCastling = (direction) => {
            const targetCol = from.col + direction * 2;
            if (!isInsideBoard(from.row, targetCol)) return;
            let col = from.col + direction;
            while (isInsideBoard(from.row, col)) {
              const target = board[from.row][col];
              if (target) {
                if (
                  target.type === "rook" &&
                  target.color === piece.color &&
                  !target.hasMoved
                ) {
                  const firstStepCol = from.col + direction;
                  const secondStepCol = targetCol;
                  if (
                    board[from.row][firstStepCol] ||
                    board[from.row][secondStepCol]
                  ) {
                    break;
                  }
                  const pathSafe = [
                    { row: from.row, col: from.col + direction },
                    { row: from.row, col: targetCol },
                  ].every(
                    (square) => !isSquareAttacked(board, square, opponentColor)
                  );
                  if (pathSafe) {
                    moves.push({
                      row: from.row,
                      col: targetCol,
                      capture: false,
                      special:
                        direction === 1 ? "castle-kingside" : "castle-queenside",
                    });
                  }
                }
                break;
              }
              col += direction;
            }
          };

          attemptCastling(1);
          attemptCastling(-1);
        }
      }
      break;
    }
    case "knight": {
      knightOffsets.forEach(([dr, dc]) => {
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
  return isSquareAttacked(board, kingPosition, opponentColor);
};

export const getLegalMoves = (board, from) => {
  const piece = board[from.row][from.col];
  if (!piece) return [];
  const pseudoMoves = getPseudoLegalMoves(board, from);
  return pseudoMoves.filter((move) => {
    const { board: nextBoard } = movePiece(board, from, {
      row: move.row,
      col: move.col,
    });
    return !isKingInCheck(nextBoard, piece.color);
  });
};
