const BOARD_SIZE = 8;
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const INITIAL_TIME_SECONDS = 10 * 60;
const STORAGE_KEY = "pro-chess-save-v1";

const PIECE_SYMBOLS = {
  white: {
    king: "♔",
    queen: "♕",
    rook: "♖",
    bishop: "♗",
    knight: "♘",
    pawn: "♙"
  },
  black: {
    king: "♚",
    queen: "♛",
    rook: "♜",
    bishop: "♝",
    knight: "♞",
    pawn: "♟"
  }
};

const PIECE_NOTATION = {
  king: "K",
  queen: "Q",
  rook: "R",
  bishop: "B",
  knight: "N",
  pawn: ""
};

const homeScreen = document.getElementById("homeScreen");
const setupScreen = document.getElementById("setupScreen");
const gameScreen = document.getElementById("gameScreen");
const startNewGameButton = document.getElementById("startNewGameBtn");
const continueGameButton = document.getElementById("continueGameBtn");
const backHomeButton = document.getElementById("backHomeBtn");
const startGameButton = document.getElementById("startGameBtn");

const boardElement = document.getElementById("board");
const statusElement = document.getElementById("status");
const checkNoticeElement = document.getElementById("checkNotice");
const moveHistoryElement = document.getElementById("moveHistory");
const capturedWhiteElement = document.getElementById("capturedWhite");
const capturedBlackElement = document.getElementById("capturedBlack");
const whiteTimerElement = document.getElementById("whiteTimer");
const blackTimerElement = document.getElementById("blackTimer");
const pauseButton = document.getElementById("pauseBtn");
const resumeButton = document.getElementById("resumeBtn");
const undoButton = document.getElementById("undoBtn");
const restartButton = document.getElementById("restartBtn");
const overlayRestartButton = document.getElementById("overlayRestartBtn");

const promotionModal = document.getElementById("promotionModal");
const gameOverOverlay = document.getElementById("gameOverOverlay");
const gameOverTitle = document.getElementById("gameOverTitle");
const gameOverMessage = document.getElementById("gameOverMessage");
const whiteCheckCountElement = document.getElementById("whiteCheckCount");
const blackCheckCountElement = document.getElementById("blackCheckCount");

let board = [];
let currentPlayer = "white";
let selectedSquare = null;
let validMoves = [];
let gameOver = false;
let gameOverReason = "";

let lastMove = null;
let moveHistory = [];
let capturedWhite = [];
let capturedBlack = [];

let whiteTime = INITIAL_TIME_SECONDS;
let blackTime = INITIAL_TIME_SECONDS;
let timerId = null;

let whiteCheckCount = 0;
let blackCheckCount = 0;
let isGamePaused = false;

let gameStates = [];
let pendingPromotion = null;

function showHomeScreen() {
  homeScreen.classList.remove("hidden");
  setupScreen.classList.add("hidden");
  gameScreen.classList.add("hidden");
  hideGameOver();
  stopTimer();
  updateContinueButtonState();
}

function showSetupScreen() {
  homeScreen.classList.add("hidden");
  setupScreen.classList.remove("hidden");
  gameScreen.classList.add("hidden");
  hideGameOver();
  stopTimer();
}

function showGameScreen() {
  homeScreen.classList.add("hidden");
  setupScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");
}

function updateContinueButtonState() {
  continueGameButton.disabled = !Boolean(localStorage.getItem(STORAGE_KEY));
}

/**
 * Creates and renders the 8x8 board UI squares.
 */
function createBoard() {
  boardElement.innerHTML = "";

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const square = document.createElement("button");
      const isLightSquare = (row + col) % 2 === 0;

      square.className = `square ${isLightSquare ? "light" : "dark"}`;
      square.type = "button";
      square.dataset.row = String(row);
      square.dataset.col = String(col);
      square.setAttribute("role", "gridcell");
      square.setAttribute("aria-label", `${FILES[col].toUpperCase()}${8 - row}`);
      square.addEventListener("click", () => handleSquareClick(row, col));

      boardElement.appendChild(square);
    }
  }
}

/**
 * Places all pieces into their standard starting positions.
 */
function initializePieces() {
  board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));

  const backRank = ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"];

  for (let col = 0; col < BOARD_SIZE; col += 1) {
    board[0][col] = createPiece(backRank[col], "black");
    board[1][col] = createPiece("pawn", "black");
    board[6][col] = createPiece("pawn", "white");
    board[7][col] = createPiece(backRank[col], "white");
  }
}

function startNewGame() {
  showSetupScreen();
}

function startGame(selectedPlayer) {
  currentPlayer = selectedPlayer;
  selectedSquare = null;
  validMoves = [];
  gameOver = false;
  gameOverReason = "";
  lastMove = null;
  moveHistory = [];
  capturedWhite = [];
  capturedBlack = [];
  whiteTime = INITIAL_TIME_SECONDS;
  blackTime = INITIAL_TIME_SECONDS;
  whiteCheckCount = 0;
  blackCheckCount = 0;
  isGamePaused = false;
  gameStates = [];
  pendingPromotion = null;

  initializePieces();
  renderMoveHistory();
  hideGameOver();
  promotionModal.classList.add("hidden");
  promotionModal.setAttribute("aria-hidden", "true");

  updateStatusForCurrentPlayer();
  renderBoard();
  showGameScreen();
  startTimer();
  saveGameState();
}

function continueGame() {
  if (!loadGameState()) {
    showSetupScreen();
    return;
  }

  hideGameOver();
  showGameScreen();
  renderMoveHistory();
  renderBoard();

  if (!isGamePaused && !gameOver) {
    startTimer();
  }
}

/**
 * Handles click interactions on board squares.
 */
function handleSquareClick(row, col) {
  if (gameOver || pendingPromotion || isGamePaused) {
    return;
  }

  const clickedPiece = board[row][col];

  if (!selectedSquare) {
    if (clickedPiece && clickedPiece.color === currentPlayer) {
      selectPiece(row, col);
    }
    return;
  }

  const clickedMove = validMoves.find((move) => move.row === row && move.col === col);

  if (clickedMove) {
    movePiece(selectedSquare.row, selectedSquare.col, row, col, clickedMove);
    return;
  }

  if (clickedPiece && clickedPiece.color === currentPlayer) {
    selectPiece(row, col);
  } else {
    clearSelection();
    renderBoard();
  }
}

/**
 * Selects a piece and highlights legal destination squares.
 */
function selectPiece(row, col) {
  const piece = board[row][col];

  if (!piece || piece.color !== currentPlayer) {
    return;
  }

  selectedSquare = { row, col };
  validMoves = getValidMoves(row, col);
  renderBoard();
}

/**
 * Returns legal moves for a piece while preventing self-check.
 */
function getValidMoves(row, col) {
  return getValidMovesForState(row, col, board, true);
}

/**
 * Moves a piece to a destination square and handles state changes.
 */
function movePiece(fromRow, fromCol, toRow, toCol, moveMeta = null) {
  if (isGamePaused) {
    return;
  }

  const movingPiece = board[fromRow][fromCol];
  if (!movingPiece) {
    return;
  }

  saveUndoState();

  const capturedPiece = capturePiece(toRow, toCol);
  board[toRow][toCol] = movingPiece;
  board[fromRow][fromCol] = null;
  movingPiece.hasMoved = true;

  lastMove = {
    from: { row: fromRow, col: fromCol },
    to: { row: toRow, col: toCol }
  };

  const moveContext = {
    pieceType: movingPiece.type,
    pieceColor: movingPiece.color,
    fromRow,
    fromCol,
    toRow,
    toCol,
    capturedPiece,
    isCapture: Boolean(capturedPiece || (moveMeta && moveMeta.isCapture))
  };

  playMoveSound(Boolean(capturedPiece));

  if (movingPiece.type === "pawn" && (toRow === 0 || toRow === 7)) {
    openPromotionModal(toRow, toCol, movingPiece.color, moveContext);
    clearSelection();
    renderBoard();
    return;
  }

  finalizeMove(moveContext);
}

/**
 * Handles captured pieces bookkeeping and UI collections.
 */
function capturePiece(targetRow, targetCol) {
  const capturedPiece = board[targetRow][targetCol];
  if (!capturedPiece) {
    return null;
  }

  if (capturedPiece.color === "white") {
    capturedWhite.push(capturedPiece.type);
  } else {
    capturedBlack.push(capturedPiece.type);
  }

  return capturedPiece;
}

/**
 * Applies move post-processing: notation, turn switch, and game-state checks.
 */
function finalizeMove(moveContext) {
  clearSelection();
  switchTurn(moveContext);
  renderBoard();
  saveGameState();
}

/**
 * Switches active player and updates check/checkmate game status.
 */
function switchTurn(moveContext = null) {
  const playerWhoMoved = currentPlayer;
  currentPlayer = currentPlayer === "white" ? "black" : "white";

  const inCheck = isCheck(currentPlayer);
  const inCheckmate = isCheckmate(currentPlayer);

  if (moveContext) {
    const notation = buildMoveNotation(moveContext, inCheck, inCheckmate);
    updateMoveHistory(notation);
  }

  detectAndHandleCheck(playerWhoMoved, inCheck, inCheckmate);

  if (gameOver) {
    stopTimer();
  }

  updatePanel();
}

/**
 * Detects check/checkmate and handles Three Check Rule and game-over conditions.
 */
function detectAndHandleCheck(playerWhoMoved, inCheck, inCheckmate) {
  if (inCheck && !inCheckmate) {
    incrementCheckCounter(playerWhoMoved);
  }

  if (endGameByThreeCheck()) {
    return;
  }

  if (inCheckmate) {
    endGameCheckmate(playerWhoMoved);
    return;
  }

  if (!inCheck && hasNoLegalMoves(currentPlayer)) {
    endGameStalemate();
    return;
  }

  updateStatusForCurrentPlayer(inCheck);
}

/**
 * Increments check counter for the player who gave check.
 */
function incrementCheckCounter(playerWhoMoved) {
  if (playerWhoMoved === "white") {
    whiteCheckCount += 1;
  } else {
    blackCheckCount += 1;
  }

  updateCheckCounterUI();
}

/**
 * Updates check counter UI display.
 */
function updateCheckCounterUI() {
  whiteCheckCountElement.textContent = whiteCheckCount;
  blackCheckCountElement.textContent = blackCheckCount;
}

/**
 * Ends game when either side reaches 3 checks.
 */
function endGameByThreeCheck() {
  if (whiteCheckCount >= 3) {
    endGame("three-check", "Game Over", "Game Over - White Wins by 3 Checks");
    return true;
  }

  if (blackCheckCount >= 3) {
    endGame("three-check", "Game Over", "Game Over - Black Wins by 3 Checks");
    return true;
  }

  return false;
}

function endGame(reason, title, message) {
  gameOver = true;
  gameOverReason = reason;
  statusElement.textContent = message;
  checkNoticeElement.textContent = "";
  showGameOver(title, message);
  stopTimer();
}

/**
 * Ends game due to checkmate.
 */
function endGameCheckmate(playerWhoMoved) {
  const winner = playerWhoMoved === "white" ? "White Player" : "Black Player";
  endGame("checkmate", "Checkmate", `${winner} wins the match.`);
}

/**
 * Ends game due to stalemate (draw).
 */
function endGameStalemate() {
  endGame("stalemate", "Stalemate", "Draw game. No legal moves remain.");
}

function updateStatusForCurrentPlayer(forceCheck = null) {
  if (isGamePaused) {
    statusElement.textContent = "Game Paused";
    checkNoticeElement.textContent = "";
    return;
  }

  const inCheck = forceCheck === null ? isCheck(currentPlayer) : forceCheck;
  const playerText = currentPlayer === "white" ? "White Turn" : "Black Turn";
  statusElement.textContent = playerText;
  checkNoticeElement.textContent = inCheck ? "Check! Protect your king." : "";
}

/**
 * Checks whether the specified side is currently in check.
 */
function isCheck(color) {
  return isKingInCheck(color, board);
}

/**
 * Checks whether the specified side is in checkmate.
 */
function isCheckmate(color) {
  if (!isCheck(color)) {
    return false;
  }

  return hasNoLegalMoves(color);
}

/**
 * Determines if a player has zero legal moves.
 */
function hasNoLegalMoves(color) {
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const piece = board[row][col];
      if (!piece || piece.color !== color) {
        continue;
      }

      const moves = getValidMovesForState(row, col, board, true);
      if (moves.length > 0) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Undoes the last move by restoring from state history.
 */
function undoMove() {
  if (pendingPromotion || gameStates.length === 0) {
    return;
  }

  const previousState = gameStates.pop();
  restoreGameState(previousState);
  hideGameOver();
  renderBoard();
  saveGameState();
}

/**
 * Adds a notation item into move history and refreshes list UI.
 */
function updateMoveHistory(notation) {
  moveHistory.push(notation);
  renderMoveHistory();
}

/**
 * Re-renders move history using move pairs (white/black).
 */
function renderMoveHistory() {
  moveHistoryElement.innerHTML = "";

  for (let i = 0; i < moveHistory.length; i += 2) {
    const whiteMove = moveHistory[i] || "";
    const blackMove = moveHistory[i + 1] || "";
    const li = document.createElement("li");
    li.textContent = `${whiteMove} ${blackMove}`.trim();
    moveHistoryElement.appendChild(li);
  }

  moveHistoryElement.scrollTop = moveHistoryElement.scrollHeight;
}

/**
 * Redraws all pieces and board highlights based on current state.
 */
function renderBoard() {
  const squares = boardElement.querySelectorAll(".square");
  const checkKingPos = isCheck(currentPlayer) ? findKing(currentPlayer, board) : null;

  squares.forEach((square) => {
    const row = Number(square.dataset.row);
    const col = Number(square.dataset.col);
    const piece = board[row][col];

    square.innerHTML = "";
    square.classList.remove("selected", "valid", "capture", "last-move", "in-check");

    if (piece) {
      const span = document.createElement("span");
      span.className = "piece";
      span.setAttribute("data-piece-color", piece.color);
      span.textContent = PIECE_SYMBOLS[piece.color][piece.type];

      if (lastMove && lastMove.to.row === row && lastMove.to.col === col) {
        span.classList.add("moved");
      }

      square.appendChild(span);
    }

    if (selectedSquare && selectedSquare.row === row && selectedSquare.col === col) {
      square.classList.add("selected");
    }

    if (
      lastMove &&
      ((lastMove.from.row === row && lastMove.from.col === col) ||
        (lastMove.to.row === row && lastMove.to.col === col))
    ) {
      square.classList.add("last-move");
    }

    const move = validMoves.find((candidate) => candidate.row === row && candidate.col === col);
    if (move) {
      square.classList.add(move.isCapture ? "capture" : "valid");
    }

    if (checkKingPos && checkKingPos.row === row && checkKingPos.col === col) {
      square.classList.add("in-check");
    }
  });

  updatePanel();
}

/**
 * Updates timers, captured pieces, controls, and status panel parts.
 */
function updatePanel() {
  whiteTimerElement.textContent = formatTime(whiteTime);
  blackTimerElement.textContent = formatTime(blackTime);

  updateCheckCounterUI();

  renderCapturedPieces(capturedWhiteElement, capturedWhite, "white");
  renderCapturedPieces(capturedBlackElement, capturedBlack, "black");

  undoButton.disabled = gameStates.length === 0 || gameOver || pendingPromotion !== null;
  pauseButton.disabled = gameOver || isGamePaused;
  resumeButton.disabled = gameOver || !isGamePaused;
}

/**
 * Renders captured pieces in dedicated panel containers.
 */
function renderCapturedPieces(targetElement, collection, color) {
  targetElement.innerHTML = "";

  collection.forEach((pieceType) => {
    const span = document.createElement("span");
    span.className = "capture-piece";
    span.textContent = PIECE_SYMBOLS[color][pieceType];
    targetElement.appendChild(span);
  });
}

/**
 * Removes current selection and highlighted moves.
 */
function clearSelection() {
  selectedSquare = null;
  validMoves = [];
}

/**
 * Builds a piece object.
 */
function createPiece(type, color, hasMoved = false) {
  return { type, color, hasMoved };
}

/**
 * Gets legal moves for a piece on a specific board state.
 */
function getValidMovesForState(row, col, state, preventSelfCheck) {
  const piece = state[row][col];
  if (!piece) {
    return [];
  }

  const rawMoves = getRawMoves(row, col, state, false);

  if (!preventSelfCheck) {
    return rawMoves;
  }

  return rawMoves.filter((move) => {
    const simulatedBoard = cloneBoard(state);
    simulatedBoard[move.row][move.col] = simulatedBoard[row][col];
    simulatedBoard[row][col] = null;

    return !isKingInCheck(piece.color, simulatedBoard);
  });
}

/**
 * Generates pseudo-legal moves by piece movement patterns.
 */
function getRawMoves(row, col, state, forAttackMap) {
  const piece = state[row][col];
  if (!piece) {
    return [];
  }

  const { type, color } = piece;
  const moves = [];
  const enemyColor = color === "white" ? "black" : "white";

  if (type === "pawn") {
    const direction = color === "white" ? -1 : 1;
    const startRow = color === "white" ? 6 : 1;

    if (!forAttackMap) {
      const oneStepRow = row + direction;
      if (isInsideBoard(oneStepRow, col) && !state[oneStepRow][col]) {
        moves.push({ row: oneStepRow, col, isCapture: false });

        const twoStepRow = row + 2 * direction;
        if (row === startRow && isInsideBoard(twoStepRow, col) && !state[twoStepRow][col]) {
          moves.push({ row: twoStepRow, col, isCapture: false });
        }
      }
    }

    const captureCols = [col - 1, col + 1];
    captureCols.forEach((targetCol) => {
      const targetRow = row + direction;
      if (!isInsideBoard(targetRow, targetCol)) {
        return;
      }

      const targetPiece = state[targetRow][targetCol];

      if (forAttackMap) {
        moves.push({ row: targetRow, col: targetCol, isCapture: true });
      } else if (targetPiece && targetPiece.color === enemyColor) {
        moves.push({ row: targetRow, col: targetCol, isCapture: true });
      }
    });

    return moves;
  }

  if (type === "knight") {
    const offsets = [
      [-2, -1],
      [-2, 1],
      [-1, -2],
      [-1, 2],
      [1, -2],
      [1, 2],
      [2, -1],
      [2, 1]
    ];

    offsets.forEach(([dr, dc]) => {
      const targetRow = row + dr;
      const targetCol = col + dc;
      if (!isInsideBoard(targetRow, targetCol)) {
        return;
      }

      const targetPiece = state[targetRow][targetCol];
      if (!targetPiece) {
        moves.push({ row: targetRow, col: targetCol, isCapture: false });
      } else if (targetPiece.color === enemyColor) {
        moves.push({ row: targetRow, col: targetCol, isCapture: true });
      }
    });

    return moves;
  }

  if (type === "king") {
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (dr === 0 && dc === 0) {
          continue;
        }

        const targetRow = row + dr;
        const targetCol = col + dc;
        if (!isInsideBoard(targetRow, targetCol)) {
          continue;
        }

        const targetPiece = state[targetRow][targetCol];
        if (!targetPiece) {
          moves.push({ row: targetRow, col: targetCol, isCapture: false });
        } else if (targetPiece.color === enemyColor) {
          moves.push({ row: targetRow, col: targetCol, isCapture: true });
        }
      }
    }

    return moves;
  }

  const directions = getSlidingDirections(type);

  directions.forEach(([dr, dc]) => {
    let targetRow = row + dr;
    let targetCol = col + dc;

    while (isInsideBoard(targetRow, targetCol)) {
      const targetPiece = state[targetRow][targetCol];

      if (!targetPiece) {
        moves.push({ row: targetRow, col: targetCol, isCapture: false });
      } else {
        if (targetPiece.color === enemyColor) {
          moves.push({ row: targetRow, col: targetCol, isCapture: true });
        }
        break;
      }

      targetRow += dr;
      targetCol += dc;
    }
  });

  return moves;
}

/**
 * Returns line movement directions for rook, bishop, and queen.
 */
function getSlidingDirections(type) {
  if (type === "rook") {
    return [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1]
    ];
  }

  if (type === "bishop") {
    return [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1]
    ];
  }

  return [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1]
  ];
}

/**
 * Checks if a color's king is currently attacked.
 */
function isKingInCheck(color, state) {
  const kingPosition = findKing(color, state);
  if (!kingPosition) {
    return false;
  }

  const opponentColor = color === "white" ? "black" : "white";

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const piece = state[row][col];
      if (!piece || piece.color !== opponentColor) {
        continue;
      }

      const attacks = getRawMoves(row, col, state, true);
      const attacksKing = attacks.some(
        (move) => move.row === kingPosition.row && move.col === kingPosition.col
      );

      if (attacksKing) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Finds king coordinates for a specific color.
 */
function findKing(color, state) {
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const piece = state[row][col];
      if (piece && piece.type === "king" && piece.color === color) {
        return { row, col };
      }
    }
  }

  return null;
}

/**
 * Creates a deep copy of board state for move simulation.
 */
function cloneBoard(state) {
  return state.map((row) => row.map((piece) => (piece ? { ...piece } : null)));
}

/**
 * Checks whether coordinates are inside the board limits.
 */
function isInsideBoard(row, col) {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

/**
 * Builds a standard chess-like move notation string.
 */
function buildMoveNotation(moveContext, inCheck, inCheckmate) {
  const { pieceType, fromCol, toRow, toCol, isCapture } = moveContext;

  const target = `${FILES[toCol]}${8 - toRow}`;
  const pieceToken = PIECE_NOTATION[pieceType];
  let notation = "";

  if (pieceType === "pawn") {
    notation = isCapture ? `${FILES[fromCol]}x${target}` : target;
  } else {
    notation = `${pieceToken}${isCapture ? "x" : ""}${target}`;
  }

  if (inCheckmate) {
    notation += "#";
  } else if (inCheck) {
    notation += "+";
  }

  return notation;
}

/**
 * Formats seconds to mm:ss clock style.
 */
function formatTime(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

/**
 * Starts countdown timer for both players.
 */
function startTimer() {
  stopTimer();

  timerId = window.setInterval(() => {
    if (gameOver || pendingPromotion || isGamePaused) {
      return;
    }

    if (currentPlayer === "white") {
      whiteTime = Math.max(0, whiteTime - 1);
      if (whiteTime === 0) {
        endOnTimeout("black");
      }
    } else {
      blackTime = Math.max(0, blackTime - 1);
      if (blackTime === 0) {
        endOnTimeout("white");
      }
    }

    updatePanel();
  }, 1000);
}

/**
 * Stops active countdown interval.
 */
function stopTimer() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
}

/**
 * Handles timer-based game over.
 */
function endOnTimeout(winnerColor) {
  const winner = winnerColor === "white" ? "White Player" : "Black Player";
  endGame("timeout", "Time Over", `${winner} wins on time.`);
  saveGameState();
}

/**
 * Stores a full snapshot of game state for undo support.
 */
function saveUndoState() {
  gameStates.push({
    board: cloneBoard(board),
    currentPlayer,
    selectedSquare: selectedSquare ? { ...selectedSquare } : null,
    validMoves: validMoves.map((move) => ({ ...move })),
    gameOver,
    gameOverReason,
    lastMove: lastMove
      ? {
          from: { ...lastMove.from },
          to: { ...lastMove.to }
        }
      : null,
    moveHistory: [...moveHistory],
    capturedWhite: [...capturedWhite],
    capturedBlack: [...capturedBlack],
    whiteTime,
    blackTime,
    whiteCheckCount,
    blackCheckCount,
    isGamePaused
  });
}

/**
 * Saves game state to localStorage for Continue Game.
 */
function saveGameState() {
  const payload = {
    board,
    currentPlayer,
    gameOver,
    gameOverReason,
    lastMove,
    moveHistory,
    capturedWhite,
    capturedBlack,
    whiteTime,
    blackTime,
    whiteCheckCount,
    blackCheckCount,
    isGamePaused,
    savedAt: Date.now()
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  updateContinueButtonState();
}

/**
 * Loads game state from localStorage and hydrates runtime state.
 */
function loadGameState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return false;
  }

  try {
    const data = JSON.parse(raw);
    if (!data.board || !data.currentPlayer) {
      return false;
    }

    board = cloneBoard(data.board);
    currentPlayer = data.currentPlayer;
    gameOver = Boolean(data.gameOver);
    gameOverReason = data.gameOverReason || "";
    lastMove = data.lastMove || null;
    moveHistory = Array.isArray(data.moveHistory) ? [...data.moveHistory] : [];
    capturedWhite = Array.isArray(data.capturedWhite) ? [...data.capturedWhite] : [];
    capturedBlack = Array.isArray(data.capturedBlack) ? [...data.capturedBlack] : [];
    whiteTime = Number.isFinite(data.whiteTime) ? data.whiteTime : INITIAL_TIME_SECONDS;
    blackTime = Number.isFinite(data.blackTime) ? data.blackTime : INITIAL_TIME_SECONDS;
    whiteCheckCount = Number.isFinite(data.whiteCheckCount) ? data.whiteCheckCount : 0;
    blackCheckCount = Number.isFinite(data.blackCheckCount) ? data.blackCheckCount : 0;
    isGamePaused = Boolean(data.isGamePaused);

    selectedSquare = null;
    validMoves = [];
    pendingPromotion = null;
    gameStates = [];

    updateStatusForCurrentPlayer();
    return true;
  } catch {
    return false;
  }
}

/**
 * Restores a previously saved game state.
 */
function restoreGameState(state) {
  board = cloneBoard(state.board);
  currentPlayer = state.currentPlayer;
  selectedSquare = state.selectedSquare ? { ...state.selectedSquare } : null;
  validMoves = state.validMoves.map((move) => ({ ...move }));
  gameOver = state.gameOver;
  gameOverReason = state.gameOverReason;
  lastMove = state.lastMove
    ? {
        from: { ...state.lastMove.from },
        to: { ...state.lastMove.to }
      }
    : null;
  moveHistory = [...state.moveHistory];
  capturedWhite = [...state.capturedWhite];
  capturedBlack = [...state.capturedBlack];
  whiteTime = state.whiteTime;
  blackTime = state.blackTime;
  whiteCheckCount = state.whiteCheckCount;
  blackCheckCount = state.blackCheckCount;
  isGamePaused = Boolean(state.isGamePaused);
  pendingPromotion = null;

  updateStatusForCurrentPlayer();
  renderMoveHistory();
  updatePanel();
}

function pauseGame() {
  if (gameOver || isGamePaused) {
    return;
  }

  isGamePaused = true;
  clearSelection();
  stopTimer();
  updateStatusForCurrentPlayer();
  renderBoard();
  saveGameState();
}

function resumeGame() {
  if (gameOver || !isGamePaused) {
    return;
  }

  isGamePaused = false;
  updateStatusForCurrentPlayer();
  renderBoard();
  startTimer();
  saveGameState();
}

/**
 * Opens the promotion modal and waits for piece selection.
 */
function openPromotionModal(row, col, color, moveContext) {
  pendingPromotion = { row, col, color, moveContext };
  promotionModal.classList.remove("hidden");
  promotionModal.setAttribute("aria-hidden", "false");
}

/**
 * Applies selected promotion piece and resumes game flow.
 */
function applyPromotion(newType) {
  if (!pendingPromotion) {
    return;
  }

  const { row, col, color, moveContext } = pendingPromotion;
  board[row][col] = createPiece(newType, color, true);
  pendingPromotion = null;
  promotionModal.classList.add("hidden");
  promotionModal.setAttribute("aria-hidden", "true");

  moveContext.pieceType = newType;
  finalizeMove(moveContext);
}

/**
 * Shows a game over overlay with winner information.
 */
function showGameOver(title, message) {
  gameOverTitle.textContent = title;
  gameOverMessage.textContent = message;
  gameOverOverlay.classList.remove("hidden");
  gameOverOverlay.setAttribute("aria-hidden", "false");
}

/**
 * Hides game over overlay.
 */
function hideGameOver() {
  gameOverOverlay.classList.add("hidden");
  gameOverOverlay.setAttribute("aria-hidden", "true");
}

/**
 * Plays move feedback sound using Web Audio API.
 */
function playMoveSound(isCapture) {
  const AudioContextRef = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextRef) {
    return;
  }

  const context = new AudioContextRef();
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.type = "triangle";
  oscillator.frequency.value = isCapture ? 330 : 520;
  gainNode.gain.value = 0.06;

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.start();

  gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.12);
  oscillator.stop(context.currentTime + 0.12);
}

/**
 * Resets game state to start a fresh match.
 */
function restartGame() {
  startGame("white");
}

startNewGameButton.addEventListener("click", startNewGame);
continueGameButton.addEventListener("click", continueGame);
backHomeButton.addEventListener("click", showHomeScreen);
startGameButton.addEventListener("click", () => {
  const selected = document.querySelector('input[name="startingPlayer"]:checked');
  const selectedPlayer = selected ? selected.value : "white";
  startGame(selectedPlayer);
});

restartButton.addEventListener("click", restartGame);
undoButton.addEventListener("click", undoMove);
pauseButton.addEventListener("click", pauseGame);
resumeButton.addEventListener("click", resumeGame);
overlayRestartButton.addEventListener("click", restartGame);

promotionModal.querySelectorAll("button[data-piece]").forEach((button) => {
  button.addEventListener("click", () => {
    applyPromotion(button.dataset.piece);
  });
});

createBoard();
showHomeScreen();

