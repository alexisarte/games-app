const ROWS = 8;
const COLUMNS = ROWS;
const $ = (id) => document.getElementById(id);
const theme = {
    light: '#008a00',
    dark: '#008200'
}

function paintBoard() {
    for (let x = 0; x < ROWS; x++) {
        for (let y = 0; y < COLUMNS; y++) {
            if ((x + y) % 2) {
                $(`${x}${y}`).style.backgroundColor = theme.dark;
            } else {
                $(`${x}${y}`).style.backgroundColor = theme.light;
            }
        }
    }
}
/*  
-----------------------------CREAR PARTIDA-------------------------
newGame() crea una partida (player1).
Llama a startGame().
*/
function newGame() {
    const options = {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
    };
    fetch("/reversi/new", options)
        .then((response) => response.json())
        .then((gameData) => {
            startGame(gameData)
            pollGame(gameData);
        })
        .catch((err) => console.log(err));
}

/*  
----------------------------UNIRSE A PARTIDA--------------------------
joinGame() se une a una partida (player2).
Llama a startGame() y a pollGame() en caso de poder unirse.
*/
function joinGame() {
    //Envia la boardId ingresada por el cliente
    const data = {
        boardId: $("joinId").value,
    };
    const options = {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
    };
    fetch("/reversi/join", options)
        .then((response) => {
            if (response.ok) {
                return response.json();
            } else {
                throw new Error("ID de tablero inválida.");
            }
        })
        .then((gameData) => {
            // Si se unió comienza el juego y escucha el estado de la partida
            startGame(gameData);
            pollGame(gameData);
        })
        .catch((err) => console.log(err));
}

/*  
----------------------------EMPEZAR PARTIDA--------------------------
startGame() se ejecuta cuando un cliente crea o se suma a una partida,
elimina el menu y muestra el juego, inicializa variables de sessionStorage.
*/
function startGame(gameData) {
    console.log(gameData);
    //Oculta el menu
    $("game-menu").style.display = "none";
    $("menu").style.display = "none";
    //Muestra el juego
    const gameElement = $("game");
    gameElement.style.display = "flex";
    //Muestro qué player es, inicializo variables en sessionStorage
    const player = $("player-data");
    const turn = document.createElement("div");
    sessionStorage.clear();
    sessionStorage.setItem("boardId", gameData.keys.boardId);
    /* Si el turn es null es una partida recién creada y es el P1. 
       Sino es el P2 uniéndose a una partida */
    if (gameData.turn == null) {
        sessionStorage.setItem("playerId", gameData.keys.player1Id);
        player.innerHTML = `Jugador 1`;
        turn.innerHTML = "ESPERANDO AL OPONENTE"
    } else {
        sessionStorage.setItem("playerId", gameData.keys.player2Id);
        player.innerHTML = `Jugador 2`;
        turn.innerHTML = "TURNO DEL OPONENTE"
    }
    player.innerHTML += `<br> Id del tablero: ${gameData.keys.boardId}`;

    turn.id = "turn";
    $("player-data").appendChild(turn);
    updateBoard(gameData);
}

/*  
-----------------------------HACER UN MOVIMIENTO------------------------
fetchTurn() se ejecuta cuando un jugador mueve su turno.
Llama a updateBoard() y a pollGame() en caso de haber podido realizar el movimiento 
(es decir si existe la partida y es su turno).
*/
function fetchTurn(square) {

    //Envía la playerId que movió
    const data = {
        playerId: sessionStorage.getItem("playerId"),
        square: square,
    };

    const options = {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
    };
    fetch(`/reversi/move/${sessionStorage.getItem("boardId")}`, options)
        .then((response) => {
            if (response.ok) {
                return response.json();
            } else {
                throw new Error("No es posible hacer el movimiento.");
            }
        })
        .then((gameData) => {
            /* Si pudo mover, se actualiza el tablero 
        y se reinicia el loop de pollGame() */
            console.log(gameData)
            updateBoard(gameData);
            if (gameData.status == "game") {
                $("turn").innerHTML = "TURNO DEL OPONENTE";
                pollGame(gameData);
            }
            else if (gameData.status == "check")
                $("turn").innerHTML = "ES TU TURNO NUEVAMENTE";
            else
                showPoster(gameData);
        })
        .catch((err) => console.log(err));
}

/*  
-----------------------OBTENER ESTADO DEL TABLERO--------------------
pollGame() realiza un fetch para recibir el estado de partida cada dos segundos: 
Comienza cuando se realiza movimiento.
Se detiene cuando se reciben cambios. 
LLama a updateBoard() si se realizaron cambios en la partida
*/
function pollGame(currentGame) {
    let idInterval = setInterval(function () {
        fetch(`/reversi/get/${sessionStorage.getItem("boardId")}`)
            .then((response) => {
                if (response.ok) {
                    return response.json();
                } else {
                    throw new Error(
                        "No es posible obtener el estado de la partida."
                    );
                }
            })
            .then((latestGame) => {
                /* Si recibo cambios actualizo el juego 
            y es mi turno, por lo que dejo de obtener el estado de la partida */
                
            if (currentGame.turn == latestGame.turn 
                && currentGame.status == latestGame.status)
                    console.log(latestGame)
                else{
                    updateBoard(latestGame);
                    if (latestGame.status == "check"){
                        console.log(latestGame)
                        $("turn").innerHTML = "NO PODÉS MOVER, TURNO DEL OPONENTE";
                    }else{ 
                        clearInterval(idInterval);
                        if (latestGame.status == "game")
                            $("turn").innerHTML = "TU TURNO";
                        else
                        showPoster(latestGame);
                    }   
                }
            })
            .catch((err) => console.log(err));
    }, 2000);
}

/*  
-----------------------------ACTUALIZAR TABLERO------------------------
updateBoard() Actualiza el tablero con la información recibida
*/
function updateBoard(gameData) {
    for (let i = 0; i < ROWS; i++) {
        for (let j = 0; j < COLUMNS; j++) {
            let id = `${i}${j}`;
            if (gameData.board[i][j] != null) {
                let token = document.createElement("div");
                token.classList.add("token");
                if (gameData.board[i][j] == "P1") {
                    token.classList.add("tokenDark");
                } else {
                    token.classList.add("tokenLight");
                }
                $(id).innerHTML = "";
                $(id).appendChild(token);
            }
        }
    }
}

function showPoster(game) {
    const end = document.createElement("div");
    end.id = "end";
    end.innerHTML = (game.status == sessionStorage.getItem("playerId")) ? "GANASTE" : (game.status != "tie") ? "PERDISTE" : "EMPATE";
    $("game").appendChild(end);
    $("turn").remove();
}

window.onload = function () {
    $("newButton").addEventListener("click", paintBoard);
    $("joinButton").addEventListener("click", paintBoard);
}