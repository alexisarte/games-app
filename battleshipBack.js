// IMPORTS
const e = require('express');
const fs = require('fs');
const crypto = require('./crypto');

const rawdata = fs.readFileSync('./battleshipGames.json');
const games = JSON.parse(rawdata);

// CONSTANTES
const EMPTY = null;
const PLAY1 = 'P1';
const PLAY2 = 'P2';
const LENGTH = 10;
const AGUA = 'O';

function getOther(player) {
    return player === PLAY1 ? PLAY2 : player === PLAY2 ? PLAY1 : false;
}

function isBoardOk(board) {
    // Validacion del tamaño del board y de los botes
    if (board.length === 10 && board[0].length === 10){
        let boats = new Array(5).fill(0);
        for(let i= 0; i<LENGTH; i++)
            for(let j= 0; j<LENGTH; j++)
                switch (board[i][j]) {
                    case "destroyer0": boats[0]++;
                        break;
                    case "submarine1": boats[1]++;
                        break;   
                    case "cruiser2": boats[2]++;
                        break;  
                    case "battleship3": boats[3]++;
                        break; 
                    case "carrier4": boats[4]++;
                        break;
                }
        return ((JSON.stringify(boats)===JSON.stringify([2, 3, 3, 4, 5])));
    }
    return false;
}

function saveFile(game) {
    games.push(game);
    fs.writeFileSync('./battleshipGames.json', JSON.stringify(games), err => {
        if (err) reject(err);
    });
}

// Devuelve al cliente únicamente los datos seguros
function clientData(game, player) {
    let clientData = {};
    keys = {};
    clientData.winner = game.winner;
    clientData.turn = game.turn;
    clientData.status = game.status;
    if (player === PLAY1) {
        clientData.board = game.board1;
        keys.playerId = game.keys.player1Id;
    } else {
        clientData.board = game.board2;
        keys.playerId = game.keys.player2Id;
    }
    keys.boardId = game.keys.boardId;
    clientData.keys = keys;
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
        winner: null,
        board1: null,
        status: 'created',
    };
    //Agrega la partida al JSON
    saveFile(game);
    return game;
}

/* ------------------------UNIRSE A PARTIDA-------------------------- 
Si encuentra la partida devuelve un objeto game, 
con la informacion de la partida y actualiza el JSON.
Llama a las función generateId()
*/
function joinGame(boardId) {
    //Busca una partida no llena para unirse con la boardId
    const index = games.findIndex(e => e.keys.boardId === boardId && e.keys.player2Id === null);
    //Si existe tal partida
    if (index !== -1) {
        const game = games[index];
        //Genera y guarda el nuevo id del jugador que esta entrando
        game.keys.player2Id = crypto.generateId(5);
        game.board2 = null;
        // Si aun el player 1 no posicionó los barcos, el estado es "joined", sino se mantiene en "waiting"
        if (game.status === 'created') game.status = 'joined';
        //Actualiza partida en JSON
        games.splice(index, 1);
        saveFile(game);
        //Devuelvo todo menos el ID del player 1
        const clientData = Object.assign({}, game);
        delete clientData.keys.player1Id;
        return clientData;
    }
    return false;
}

/* ------------------ACTUALIZAR ESTADO DE PARTIDA----------------- 
Cada movimiento genera un nuevo registro de la partida en el JSON, 
con el tablero nuevo y cambiando el turno 
*/
function updateGame(game) {
    //Si existe la partida, guarda el index
    const index = games.findIndex(e => e.keys.boardId === game.keys.boardId);
    if (index !== -1) {
        //Actualiza esta partida en el array
        const game = games[index];
        games.splice(index, 1);
        //Escribir la nueva info al JSON
        saveFile(game);
        return game;
    }
    return false;
}

/* ------------------SETEAR TABLERO----------------- 
Llama a updateGame() si es válido el turno 
*/
function setBoard(boardId, playerId, board) {
    // Obtiene el estado de la partida
    const game = games.find(e => e.keys.boardId === boardId);
    // Si la partida existe y el board enviado es correcto
    if (game && isBoardOk(board)) {
        let player = null;
        //Si es el playerId es valido y su tablero no se inicializó aún
        if ((playerId === game.keys.player1Id && game.board1 === null) || (playerId === game.keys.player2Id && game.board2 === null)) {
            //Si es el P1
            if (playerId === game.keys.player1Id) {
                player = PLAY1;
                game.board1 = board;
                game.boats1 = [2, 3, 3, 4, 5];
                // Si es el P2
            } else {
                player = PLAY2;
                game.board2 = board;
                game.boats2 = [2, 3, 3, 4, 5];
            }
            //Manejo de estado del juego y de turnos
            if (game.status !== 'waiting') game.status = 'waiting';
            else if (game.status === 'waiting') {
                game.status = 'started';
                game.turn = getOther(player);
            }
            updateGame(game);
            return clientData(game, player);
        }
    }
    return false;
}

/* ------------------REALIZAR MOVIMIENTO----------------- 
Validación, gestión de turnos.
Llama a updateGame() si es válido el turno 
*/
function move(boardId, playerId, square) {
    const x = parseInt(square[0]);
    const y = parseInt(square[1]);

    const game = games.find(e => e.keys.boardId === boardId);
    //Validar el turno, si es valido player indica qué jugador movió
    if (game && ((playerId === game.keys.player1Id && game.turn === PLAY1) || (playerId === game.keys.player2Id && game.turn === PLAY2)) && game.winner === null) {
        const player = game.turn;
        let shots = [];
        let valid = false;

        // Se actualiza el tablero de disparos del jugador (tablero de oceano del jugador contrario)
        if (player === PLAY1) {
            if (isValidMove(game.board2, x, y)) {
                shots = updateBoard(game.board2, game.boats2, x, y);
                if (isWon(game.boats2)) game.winner = game.keys.player1Id;
                valid = true;
            }
        } else {
            if (isValidMove(game.board1, x, y)) {
                shots = updateBoard(game.board1, game.boats1, x, y);
                if (isWon(game.boats1)) game.winner = game.keys.player2Id;
                valid = true;
            }
        }
        if (valid) {
            if (game.winner === null) game.turn = getOther(player);
            updateGame(game);

            let clientD = clientData(game, player);
            //Agrego el disparo en clientData
            clientD.shots = shots;
            return clientD;
        }
    }
    return false;
}

function isValidMove(board, x, y) {
    return isOnBoard(x, y) && isValid(board[x][y]);
}

function isValid(name) {
    if (name !== null)
        if (name[0] === 'X' || name[0] === 'F' || name === AGUA)
            return false;
    return true;
}

function isOnBoard(x, y) {
    return x >= 0 && x < LENGTH && y >= 0 && y < LENGTH;
}

function isWon(boats) {
    return boats.every(e => e === 0);
}

/* ---------------ACTUALIZACION DE FICHAS DEL TABLERO---------- */
function updateBoard(board, boats, x, y) {
    // Modifica el casillero clickeado
    // Si es NULL, agua
    let shots = [];
    if (board[x][y] === EMPTY) {
        board[x][y] = AGUA;
        // Sino, es un barco, entonces decrementamos contador respectivo
    } else {
        // Identificacion de barco y posición en el vector contador
        const boatNumber = parseInt(board[x][y][board[x][y].length - 1]);
        console.log('BOATNUMBERRRRRRRRRRRRRRRR: ', board[x][y][board[x][y].length - 1]);
        board[x][y] = 'X' + boatNumber;
        boats[boatNumber]--;
        // Si un contador llegó a cero, se hundió el barco respectivo
        if (boats[boatNumber] === 0) {
            for (let i = 0; i < LENGTH; i++)
                for (let j = 0; j < LENGTH; j++)
                    if (board[i][j] !== null && board[i][j][1] === boatNumber) {
                        board[i][j] = 'F' + boatNumber;
                        shots.push({ value: 'F', x: i, y: j });
                    }
            return shots;
        }
    }
    shots.push({ value: board[x][y][0], x: x, y: y });
    return shots;
}

/* ------------------OBTENER ESTADO DE LA PARTIDA----------------- 
Retorna el estado de la partida si es existente, sino retorna false
*/
function getGame(boardId, playerId) {
    //Busca el juego por boardId
    const game = games.find(e => e.keys.boardId === boardId);
    return game.keys.player1Id === playerId ? clientData(game, PLAY1) 
            : (game.keys.player2Id === playerId) ? clientData(game, PLAY2) : null;
}

module.exports = {
    newGame,
    joinGame,
    getGame,
    move,
    setBoard
};
