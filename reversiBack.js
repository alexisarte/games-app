// IMPORTS
const fs = require("fs");
const crypto = require("./crypto");

const rawdata = fs.readFileSync("./reversiGames.json");
const games = JSON.parse(rawdata);

// CONSTANTES
const EMPTY = null;
const PLAY1 = "P1";
const PLAY2 = "P2";
const LENGTH = 8;

function getOther(player) {
    return (player === PLAY1) ? PLAY2 : (player === PLAY2) ? PLAY1 : false;
}

/*--------------------CREAR TABLERO REVERSI-----------------------------------
Genera el tablero incial de reversi. Detalle a implementar:
Reversi puede iniciar con las fichas repartidas de disintas formas aleatoriamente 
*/
function generateBoard() {
    let board = [...Array(LENGTH)].map((e) => Array(LENGTH).fill(EMPTY));
    board[3][3] = PLAY2;
    board[3][4] = PLAY1;
    board[4][3] = PLAY1;
    board[4][4] = PLAY2;
    return board;
}

function saveFile(game) {
    games.push(game);
    fs.writeFileSync("./reversiGames.json", JSON.stringify(games), (err) => {
        if (err) reject(err);
    });
}

function clientData(game){
    let clientData = {}
    clientData.status = game.status;
    clientData.turn = game.turn;
    clientData.board = game.board;
    return clientData;
}

/* ------------------------CREAR PARTIDA-------------------------- 
Devuelve un nuevo objeto game, con la informacion de la partida y actualiza el JSON.
Llama a las funciones newGameKeys() y generateBoard()
*/
function newGame() {
    const game = {
        keys: crypto.newGameKeys(),
        turn: null,
        status: "game",
        board: generateBoard(),
    };
    //Agrega la partida al JSON
    saveFile(game)
    return game;
}

/* ------------------------UNIRSE A PARTIDA-------------------------- 
Si encuentra la partida devuelve un objeto game, 
con la informacion de la partida y actualiza el JSON.
Llama a las función generateId()
*/
function joinGame(boardId) {
    //Busca una partida no llena para unirse con la boardId
    const index = games.findIndex(e => ((e.keys.boardId === boardId) && (e.keys.player2Id === EMPTY)));
    //Si existe tal partida
    if (index !== -1) {
        const game = games[index];
        //Genera y guarda el nuevo id del jugador que esta entrando
        game.keys.player2Id = crypto.generateId(5);
        // Inicializa los turnos
        game.turn = "P1";
        //Actualiza partida en JSON
        games.splice(index, 1);
        saveFile(game);
        // Elimino ID del player 1 al enviar al cliente
        const clientData = Object.assign({}, game)
        delete clientData.keys.player1Id;
        return clientData
    }
    return false;
}

/* ------------------ACTUALIZAR ESTADO DE PARTIDA----------------- 
Cada movimiento genera un nuevo registro de la partida en el JSON, 
con el tablero nuevo y cambiando el turno 
*/
function updateGame(updatedGame) {
    const index = games.findIndex((e) => e.keys.boardId === updatedGame.keys.boardId);
    if (index !== -1) {
        const game = games[index];
        games.splice(index, 1);
        saveFile(updatedGame);
        return updatedGame;
    }
    return false;
}


/* ------------------REALIZAR MOVIMIENTO----------------- 
Validación, gestión de turnos.
Llama a updateGame() si es válido el turno 
*/


function move(boardId, playerId, square) {
    const game = games.find((e) => e.keys.boardId === boardId);
    const x = parseInt(square[0]);
    const y = parseInt(square[1]);
    let status;
    let toFlip = [];
    //Validar el turno, si es valido player indica qué jugador movió
    if (game) {
        if ((playerId === game.keys.player1Id && game.turn === PLAY1) ||
        (playerId === game.keys.player2Id && game.turn === PLAY2)) {
            toFlip = makeMove(game.board, toFlip, x, y, game.turn);
            if (toFlip.length !== 0) {
                //Voltea las fichas encerradas
                toFlip.forEach(pos => (game.board[pos.x][pos.y] = game.turn));
                status = setStatus(game.board, game.keys.player1Id, game.keys.player2Id, game.turn);
                //Si el oponente tiene movimientos posibles cambio turno
                if (status === "game") game.turn = getOther(game.turn);
                game.status = status;
                updateGame(game);
                return clientData(game);
            }
        }
    }
    return false;
}

function isOnBoard(x, y) {
    return ((x >= 0) && (x < LENGTH) && (y >= 0) && (y < LENGTH));
}

//Devuelve un array con las posiciones a flipar
function makeMove(board, toFlip, xOr, yOr, play) {
    let x = 0, y = 0;
    if (isOnBoard(xOr, yOr) && board[xOr][yOr] === EMPTY) {
        const dirs = [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 0 }, { x: 1, y: -1 }, { x: 0, y: -1 }, { x: -1, y: -1 }, { x: -1, y: 0 }, { x: -1, y: 1 }];
        // Recorre todas las direcciones
        dirs.forEach(dir => {
            x = xOr; y = yOr;
            x += dir.x; y += dir.y;
            // Si esta en el tablero y es del jugador contrario
            if (isOnBoard(x, y) && board[x][y] === getOther(play)) {
                // Recorre hasta que encuentra una ficha del jugador que movio o llega al final del tablero
                while (isOnBoard(x, y) && (board[x][y] === getOther(play))) {
                    x += dir.x;
                    y += dir.y;
                }
                // Si el casillero final contiene una ficha del jugador que movió
                if (isOnBoard(x, y) && board[x][y] === play) {
                    // Recorre todos los casilleros entre el inicial y el final y los agrega a la lista de casilleros a voltear
                    while (x !== xOr || y !== yOr) {
                        x -= dir.x;
                        y -= dir.y;
                        toFlip.push({ x, y });
                    }
                }
            }
        });
    }
    return toFlip;
}

/* ------------------OBTENER ESTADO DE LA PARTIDA----------------- 
Retorna el estado de la partida si es existente, sino retorna false
*/
function getGame(boardId) {
    //Busca el juego por boardId
    const game = games.find((e) => e.keys.boardId === boardId);
    return clientData(game);
}

function setStatus(board, player1Id, player2Id, play) {
    let toFlip = [];
    for (let i = 0; i < LENGTH; i++) 
        for (let j = 0; j < LENGTH; j++){
            toFlip = makeMove(board, toFlip, i, j, getOther(play));
            //Si el oponente tiene movimientos posibles, retorna false
            if (toFlip.length !== 0) return "game";
        }
    //Sino se checkean los movimientos posibles del jugador actual
    let play1Cant = 0, play2Cant = 0;
    for (let i = 0; i < LENGTH; i++)
        for (let j = 0; j < LENGTH; j++) {
            //Cuenta las fichas del jugador 1 y 2
            (board[i][j] === PLAY1) ? play1Cant++ : (board[i][j] === PLAY2) ? play2Cant++ : EMPTY;
            toFlip = makeMove(board, toFlip, i, j, play);
            //Si hay movimientos posibles, retorna check(vuelve a jugar el jugador actual)
            if (toFlip.length !== 0) return "check"
        }
    // Si ninguno tiene movimientos, el juego termino y se determina el ganador
    return (play1Cant > play2Cant) ? player1Id : (play2Cant > play1Cant) ? player2Id : "tie";
}

module.exports = {
    newGame,
    joinGame,
    getGame,
    move,
};
