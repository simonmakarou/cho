import { useEffect, useMemo, useState } from "react";
import {
  BOARD_SIZE,
  cloneBoard,
  createInitialBoard,
  getLegalMoves,
  isKingInCheck,
  movePiece,
} from "./chess/engine.js";

const PIECE_SYMBOLS = {
  pawn: { white: "♙", black: "♟︎" },
  rook: { white: "♖", black: "♜" },
  knight: { white: "♘", black: "♞" },
  bishop: { white: "♗", black: "♝" },
  queen: { white: "♕", black: "♛" },
  king: { white: "♔", black: "♚" },
};

const INITIAL_TIME = 5 * 60;

const PROMOTION_CHOICES = ["queen", "rook", "bishop", "knight"];

const formatSquare = ({ row, col }) => `${String.fromCharCode(97 + col)}${
  BOARD_SIZE - row
}`;

const formatTime = (seconds) => {
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
};

const pieceNameRu = {
  pawn: "пешка",
  rook: "ладья",
  knight: "конь",
  bishop: "слон",
  queen: "ферзь",
  king: "король",
};

const colorNameRu = {
  white: "Белые",
  black: "Черные",
};

function App() {
  const [board, setBoard] = useState(() => createInitialBoard());
  const [selected, setSelected] = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);
  const [moveHistory, setMoveHistory] = useState([]);
  const [activeColor, setActiveColor] = useState("white");
  const [timers, setTimers] = useState({ white: INITIAL_TIME, black: INITIAL_TIME });
  const [isGameOver, setIsGameOver] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Белые делают первый ход.");
  const [promotionDialog, setPromotionDialog] = useState(null);

  useEffect(() => {
    if (isGameOver) return undefined;
    const timer = setInterval(() => {
      setTimers((prev) => {
        const remaining = prev[activeColor];
        if (remaining <= 0) {
          clearInterval(timer);
          return prev;
        }
        const nextValue = Math.max(0, remaining - 1);
        if (nextValue === 0) {
          setSelected(null);
          setLegalMoves([]);
          setIsGameOver(true);
          setStatusMessage(
            `${colorNameRu[activeColor]} проиграли по времени. Победа ${
              colorNameRu[activeColor === "white" ? "black" : "white"]
            }.`
          );
        }
        return { ...prev, [activeColor]: nextValue };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [activeColor, isGameOver]);

  const legalMoveMap = useMemo(() => {
    const map = new Map();
    legalMoves.forEach((move) => {
      map.set(`${move.row}:${move.col}`, move);
    });
    return map;
  }, [legalMoves]);

  const finalizeMove = (
    finalBoard,
    { movingPiece, from, to, capturedPiece, promotedTo = null }
  ) => {
    const moveNumber = Math.floor(moveHistory.length / 2) + 1;
    const fromNotation = formatSquare(from);
    const toNotation = formatSquare(to);
    const captureSuffix = capturedPiece ? " ×" : "";
    const promotionSuffix = promotedTo
      ? `=${PIECE_SYMBOLS[promotedTo][movingPiece.color]}`
      : "";

    const notation = `${moveNumber}. ${colorNameRu[movingPiece.color]} ${
      PIECE_SYMBOLS[movingPiece.type][movingPiece.color]
    } ${fromNotation}→${toNotation}${captureSuffix}${promotionSuffix}`;

    setMoveHistory((prev) => [...prev, notation]);

    const nextColor = activeColor === "white" ? "black" : "white";
    const opponentInCheck = isKingInCheck(finalBoard, nextColor);

    let opponentHasMoves = false;
    outer: for (let r = 0; r < BOARD_SIZE; r += 1) {
      for (let c = 0; c < BOARD_SIZE; c += 1) {
        const candidate = finalBoard[r][c];
        if (!candidate || candidate.color !== nextColor) continue;
        if (getLegalMoves(finalBoard, { row: r, col: c }).length > 0) {
          opponentHasMoves = true;
          break outer;
        }
      }
    }

    if (!opponentHasMoves) {
      if (opponentInCheck) {
        setIsGameOver(true);
        setStatusMessage(`Мат! ${colorNameRu[movingPiece.color]} победили.`);
      } else {
        setIsGameOver(true);
        setStatusMessage("Пат! Ничья.");
      }
      return;
    }

    setActiveColor(nextColor);
    if (opponentInCheck) {
      setStatusMessage(
        `Шах! ${colorNameRu[nextColor]} под ударом. Ход ${colorNameRu[nextColor]}.`
      );
    } else {
      setStatusMessage(`Ход ${colorNameRu[nextColor]}.`);
    }
  };

  const handleSquareClick = (row, col) => {
    if (isGameOver) return;
    if (promotionDialog) return;

    const piece = board[row][col];
    if (selected && selected.row === row && selected.col === col) {
      setSelected(null);
      setLegalMoves([]);
      return;
    }

    if (piece && piece.color === activeColor) {
      setSelected({ row, col });
      setLegalMoves(getLegalMoves(board, { row, col }));
      return;
    }

    if (!selected) return;

    const key = `${row}:${col}`;
    if (!legalMoveMap.has(key)) return;

    const movingPiece = board[selected.row][selected.col];
    const capturedPiece = board[row][col];
    const { board: nextBoard, promotionNeeded, promotionSquare } = movePiece(
      board,
      selected,
      { row, col }
    );

    setBoard(nextBoard);
    setSelected(null);
    setLegalMoves([]);

    if (promotionNeeded) {
      setPromotionDialog({
        board: nextBoard,
        square: promotionSquare,
        movingPiece,
        from: selected,
        to: { row, col },
        capturedPiece,
      });
      setStatusMessage(
        `${colorNameRu[movingPiece.color]} достигли последней горизонтали. Выберите фигуру для превращения.`
      );
      return;
    }

    finalizeMove(nextBoard, {
      movingPiece,
      from: selected,
      to: { row, col },
      capturedPiece,
    });
  };

  const handlePromotionChoice = (pieceType) => {
    if (!promotionDialog) return;
    const { board: baseBoard, square, movingPiece, from, to, capturedPiece } =
      promotionDialog;

    const promotedBoard = cloneBoard(baseBoard);
    promotedBoard[square.row][square.col] = {
      type: pieceType,
      color: square.color,
      hasMoved: true,
    };

    setBoard(promotedBoard);
    setPromotionDialog(null);

    finalizeMove(promotedBoard, {
      movingPiece,
      from,
      to,
      capturedPiece,
      promotedTo: pieceType,
    });
  };

  const handleNewGame = () => {
    setBoard(createInitialBoard());
    setSelected(null);
    setLegalMoves([]);
    setMoveHistory([]);
    setActiveColor("white");
    setTimers({ white: INITIAL_TIME, black: INITIAL_TIME });
    setIsGameOver(false);
    setStatusMessage("Белые делают первый ход.");
  };

  const handleResign = () => {
    if (isGameOver) return;
    const winnerColor = activeColor === "white" ? "black" : "white";
    const winner = colorNameRu[winnerColor];
    setSelected(null);
    setLegalMoves([]);
    setIsGameOver(true);
    setStatusMessage(`${colorNameRu[activeColor]} сдались. Победа ${winner}.`);
  };

  const handleDraw = () => {
    if (isGameOver) return;
    setSelected(null);
    setLegalMoves([]);
    setIsGameOver(true);
    setStatusMessage("Партия завершилась ничьей по соглашению.");
  };

  const renderSquare = (row, col) => {
    const piece = board[row][col];
    const isDark = (row + col) % 2 === 1;
    const isSelected = selected && selected.row === row && selected.col === col;
    const move = legalMoveMap.get(`${row}:${col}`);

    const baseClasses = isDark ? "bg-emerald-900/60" : "bg-emerald-200/50";
    const selectedClasses = isSelected ? "ring-4 ring-yellow-400" : "";
    return (
      <button
        key={`${row}-${col}`}
        type="button"
        onClick={() => handleSquareClick(row, col)}
        className={`relative flex h-16 w-16 items-center justify-center text-3xl transition ${baseClasses} ${selectedClasses}`}
      >
        {move && !move.capture && (
          <span className={`absolute h-3 w-3 rounded-full bg-yellow-400/70`} />
        )}
        {move && move.capture && (
          <span className={`absolute h-5 w-5 rounded-full border-4 border-yellow-400`} />
        )}
        {piece ? PIECE_SYMBOLS[piece.type][piece.color] : null}
      </button>
    );
  };

  const sidePanel = (
    <aside className="flex w-full max-w-sm flex-col gap-6 rounded-xl border border-slate-800 bg-slate-900/60 p-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">Информация о партии</h2>
        <p className="mt-2 text-sm text-slate-300">{statusMessage}</p>
      </div>
      <div className="grid grid-cols-2 gap-4 text-center">
        {(["white", "black"]).map((color) => (
          <div
            key={color}
            className={`rounded-lg border p-4 ${
              activeColor === color && !isGameOver
                ? "border-emerald-400 bg-emerald-500/10"
                : "border-slate-700 bg-slate-800/60"
            }`}
          >
            <p className="text-sm uppercase tracking-wide text-slate-400">
              {colorNameRu[color]}
            </p>
            <p className="mt-2 font-mono text-3xl">
              {formatTime(timers[color])}
            </p>
          </div>
        ))}
      </div>
      <div>
        <h3 className="text-lg font-semibold text-slate-100">Ходы</h3>
        <div className="mt-2 max-h-60 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-300">
          {moveHistory.length === 0 ? (
            <p className="text-slate-500">Сделайте первый ход, чтобы начать запись партии.</p>
          ) : (
            <ol className="list-decimal space-y-2 pl-4">
              {moveHistory.map((move) => (
                <li key={move}>{move}</li>
              ))}
            </ol>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleNewGame}
          className="flex-1 rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-emerald-950 transition hover:bg-emerald-400"
        >
          Новая игра
        </button>
        <button
          type="button"
          onClick={handleResign}
          className="flex-1 rounded-lg border border-red-400 px-4 py-2 font-semibold text-red-400 transition hover:bg-red-500/10"
        >
          Сдаться
        </button>
        <button
          type="button"
          onClick={handleDraw}
          className="flex-1 rounded-lg border border-slate-600 px-4 py-2 font-semibold text-slate-300 transition hover:bg-slate-700/60"
        >
          Ничья
        </button>
      </div>
      <div>
        <h3 className="text-lg font-semibold text-slate-100">Памятка по фигурам</h3>
        <ul className="mt-2 space-y-2 text-sm text-slate-300">
          {Object.entries(pieceNameRu).map(([type, name]) => (
            <li key={type} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
              <span className="font-medium capitalize">{name}</span>
              <span className="text-2xl">
                {PIECE_SYMBOLS[type].white}
                <span className="mx-2 text-slate-500">/</span>
                {PIECE_SYMBOLS[type].black}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen flex-col">
      {promotionDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-emerald-500/40 bg-slate-900/90 p-6 text-center text-slate-100 shadow-xl">
            <h3 className="text-lg font-semibold">
              {colorNameRu[promotionDialog.square.color]} выбирают фигуру для превращения
            </h3>
            <p className="mt-2 text-sm text-slate-300">
              Выберите фигуру, в которую превратится пешка на {formatSquare(promotionDialog.to)}.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {PROMOTION_CHOICES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handlePromotionChoice(type)}
                  className="flex items-center justify-center gap-3 rounded-xl border border-emerald-500/50 bg-slate-950/60 px-4 py-3 text-lg font-semibold text-emerald-200 transition hover:border-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-100"
                >
                  <span className="text-3xl">
                    {PIECE_SYMBOLS[type][promotionDialog.square.color]}
                  </span>
                  <span className="text-left text-sm uppercase tracking-wide text-slate-300">
                    {pieceNameRu[type]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-emerald-400">Проект</p>
            <h1 className="text-2xl font-semibold text-slate-100">Chess Online</h1>
          </div>
          <nav className="flex items-center gap-4 text-sm text-slate-300">
            <a className="transition hover:text-emerald-400" href="#board">
              Игра
            </a>
            <a className="transition hover:text-emerald-400" href="#about">
              Планы
            </a>
            <a className="transition hover:text-emerald-400" href="#community">
              Сообщество
            </a>
          </nav>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-10 lg:flex-row">
        <section id="board" className="flex flex-1 flex-col items-center gap-6">
          <div className="flex w-full flex-col items-center gap-4 rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl shadow-emerald-500/10">
            <div className="flex w-full items-center justify-between">
              <div className="text-left">
                <p className="text-sm uppercase tracking-widest text-slate-400">Текущий ход</p>
                <p className="text-xl font-semibold text-emerald-300">
                  {colorNameRu[activeColor]}
                </p>
              </div>
              <div className="rounded-full border border-emerald-500 px-4 py-1 text-sm text-emerald-200">
                Бета-версия интерфейса
              </div>
            </div>
            <div className="grid grid-cols-8 gap-1 rounded-2xl border border-emerald-500/30 bg-emerald-950/40 p-3">
              {Array.from({ length: BOARD_SIZE }, (_, row) => (
                <div key={row} className="contents">
                  {Array.from({ length: BOARD_SIZE }, (_, col) => renderSquare(row, col))}
                </div>
              ))}
            </div>
          </div>
          <section
            id="about"
            className="w-full rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-slate-300"
          >
            <h2 className="text-xl font-semibold text-slate-100">Дорожная карта развития</h2>
            <ul className="mt-4 list-disc space-y-2 pl-6">
              <li>Подключение серверной части и WebSocket для онлайн-матчей.</li>
              <li>Авторизация игроков, рейтинги и профиль с историей партий.</li>
              <li>Анализ позиций движком, тренировки тактики и турниры.</li>
              <li>Мобильные клиенты, уведомления и расширенная модерация.</li>
            </ul>
          </section>
        </section>
        {sidePanel}
      </main>
      <footer
        id="community"
        className="border-t border-slate-800 bg-slate-900/80 py-6 text-center text-sm text-slate-400"
      >
        Присоединяйтесь к сообществу разработчиков Chess Online и помогайте строить
        альтернативу chess.com!
      </footer>
    </div>
  );
}

export default App;
