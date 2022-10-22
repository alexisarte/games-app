const ROWS = 10;
const COLUMNS = ROWS;
const EMPTY = null;
const $ = id => document.getElementById(id);
/*  
-----------------------------CREAR PARTIDA-------------------------
newGame() crea una partida (player1).
*/
function newGame() {
    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
    };
    fetch('/battleship/new', options)
        .then(response => response.json())
        .then(gameData => startSetting(gameData))
        .catch(err => console.log(err));
}

/*  
----------------------------UNIRSE A PARTIDA--------------------------
joinGame() se une a una partida (player2).
*/
function joinGame() {
    //Envia la boardId ingresada por el cliente
    const data = {
        boardId: $('joinId').value,
    };
    const options = {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    };
    fetch('/battleship/join', options)
        .then(response => {
            if (response.ok) {
                return response.json();
            } else {
                throw new Error('ID de tablero inválida.');
            }
        })
        .then(gameData => startSetting(gameData))
        .catch(err => console.log(err));
}

/*  
----------------------------EMPEZAR PARTIDA--------------------------
Se ejecuta cuando un cliente crea o se suma a una partida,
elimina el menu y muestra el juego, inicializa variables de localStorage.
*/
function startSetting(gameData) {
    //Oculta el menu
    $('game-menu').style.display = 'none';
    //Muestra el juego
    const gameElement = document.querySelector('.grid-user');
    gameElement.style.display = 'inline-block';
    // gameElement.style.margin = 'auto';
    document.querySelector('.hidden-info').style.display = 'inline-block';
    document.querySelector('.grid-display').style.display = 'inline-block';
    //Muestro qué player es, inicializo variables en localStorage
    const player = $('player-data');
    const turn = document.createElement('p');
    const tableId = document.createElement('div');
    let copyIcon = document.createElement('i');
    copyIcon.className = 'fa-solid';
    copyIcon.classList.add('fa-copy');
    copyIcon.addEventListener('click', copy);
    tableId.appendChild(copyIcon);
    tableId.id = 'tableId';
    localStorage.clear();
    localStorage.setItem('boardId', gameData.keys.boardId);
    turn.innerHTML = 'Coloca tus barcos';
    //Si el estado es created, es el player1, sino es el player2
    if (gameData.status == 'created') {
        localStorage.setItem('playerId', gameData.keys.player1Id);
        player.innerHTML = 'Jugador 1';
    } else {
        localStorage.setItem('playerId', gameData.keys.player2Id);
        player.innerHTML = 'Jugador 2';
    }
    tableId.innerHTML += ` Id del tablero: ${gameData.keys.boardId}`;
    turn.id = 'turn';
    $('player-data').append(tableId, turn);
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
        playerId: localStorage.getItem('playerId'),
        square: square,
    };
    const options = {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    };
    fetch(`/battleship/move/${localStorage.getItem('boardId')}`, options)
        .then(response => {
            if (response.ok) {
                return response.json();
            } else {
                throw new Error('No es posible hacer el movimiento.');
            }
        })
        .then(gameData => {
            //Si pudo mover, se actualiza el tablero del contrincante y se reinicia el loop de pollGame()
            if (gameData.winner === null) {
                $('turn').innerHTML = 'TURNO DEL OPONENTE';
                updateShotsBoard(gameData.shots);
                pollGame(gameData);
            } else {
                updateShotsBoard(gameData.shots);
                showPoster(gameData);
            }
        })
        .catch(err => console.log(err));
}

function updateShotsBoard(shots) {
    //Actualiza los casilleros devueltos por el server
    shots.forEach(shot => {
        const square = $(String(shot.x) + String(shot.y) + 2);
        const punto = document.createElement('div');
        switch (shot.value){
            case "O": punto.id = 'miss';
            break;
            case "X": punto.id = 'boom';
            break;
            case "F":punto.id = 'dead';
            break
        }
        square.innerHTML = '';
        square.appendChild(punto);
    })
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
        fetch(`/battleship/get/${localStorage.getItem('boardId')}/${localStorage.getItem('playerId')}`)
            .then(response => {
                if (response.ok) {
                    return response.json();
                } else {
                    throw new Error('No es posible obtener el estado de la partida.');
                }
            })
            .then(latestGame => {
                // si el estado de la partida pasó de "joined" a "started", se detiene el poll y se inicializa el juego
                if (currentGame.status != latestGame.status) {
                    clearInterval(idInterval);
                    startGame(latestGame);
                    $('turn').innerHTML = 'TU TURNO';
                } else if (currentGame.turn == latestGame.turn && latestGame.winner === null) {
                    console.log(latestGame);
                } else if (latestGame.winner === null) {
                    // si no terminó el juego y es mi turno, se actualiza el tablero y se detiene el poll
                    $('turn').innerHTML = 'TU TURNO';
                    updateMyBoard(latestGame);
                    clearInterval(idInterval);
                } else {
                    // si terminó el juego, se muestra el mensaje de fin y se detiene el poll
                    updateMyBoard(latestGame);
                    clearInterval(idInterval);
                    showPoster(latestGame);
                }
            })
            .catch(err => console.log(err));
    }, 2000);
}

/*  
-----------------------------ACTUALIZAR TABLERO------------------------
updateBoard() Actualiza el tablero con la información recibida
*/
function updateMyBoard(gameData) {
    for (let i = 0; i < ROWS; i++) {
        for (let j = 0; j < COLUMNS; j++) {
            let id = `${i}${j}`;
            if (gameData.board[i][j] != EMPTY) {
                const punto = document.createElement('div');
                if (gameData.board[i][j] == 'O') {
                    punto.id = 'miss';
                } else if (gameData.board[i][j][0] == 'X') {
                    punto.id = 'boom';
                } else if (gameData.board[i][j][0] == 'F') {
                    punto.id = 'dead';
                }
                $(id).innerHTML = '';
                $(id).appendChild(punto);
            }
        }
    }
}

/*  
-----------------------------FETCH TABLERO SETEADO------------------------
updateBoard() Actualiza el tablero con la información recibida
*/

function setBoard() {
    //Creo el tablero
    let board = [...Array(ROWS)].map(e => Array(COLUMNS).fill(EMPTY));
    for (let i = 0; i < ROWS; i++) {
        for (let j = 0; j < COLUMNS; j++) {
            let id = `${i}${j}`;
            // escribo en la matrix los nombres de los tipos de barcos
            $(id).classList.contains('taken') ? (board[i][j] = $(id).classList.item($(id).classList.length - 1)) : null;
        }
    }
    const data = {
        playerId: localStorage.getItem('playerId'),
        board: board,
    };

    const options = {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    };
    fetch(`/battleship/setBoard/${localStorage.getItem('boardId')}`, options)
        .then(response => {
            if (response.ok) {
                return response.json();
            } else {
                throw new Error('No es posible modificar tu tablero.');
            }
        })
        .then(gameData => {   
            document.querySelector('.hidden-info').style.display = 'none';
            document.querySelector('.grid-display').style.display = 'none';
            if (gameData.status == 'waiting') {
                $('turn').innerHTML = 'ESPERANDO QUE EL OPONENTE COLOQUE SUS BARCOS';
                startGame(gameData);
                pollGame(gameData);
            } else {
                startGame(gameData);
                pollGame(gameData);
                $('turn').innerHTML = 'TURNO DEL OPONENTE';
            }
        })
        .catch(err => console.log(err));
}

/*  
-----------------------------COMENZAR JUEGO------------------------
*/
function startGame(gameData) {
    $('move').style.display = 'flex';
    // $('move').style.width = '400px';
}

function showPoster(game) {
    const end = document.createElement('div');
    end.id = 'end';
    end.innerHTML = game.winner == localStorage.getItem('playerId') ? 'GANASTE' : game.winner != 'TIE' ? 'PERDISTE' : 'EMPATE';
    $('game').appendChild(end);
    $('turn').remove();
}

function copy() {
    let copyText = this.innerHTML;
    navigator.clipboard.writeText(copyText);
}

window.addEventListener("beforeunload", function (event) {
    event.preventDefault();
});

window.onload = function () {
    const displayGrid = document.querySelector('.grid-display');
    const ships = document.querySelectorAll('.ship');
    const destroyer = document.querySelector('.destroyer-container');
    const submarine = document.querySelector('.submarine-container');
    const cruiser = document.querySelector('.cruiser-container');
    const battleship = document.querySelector('.battleship-container');
    const carrier = document.querySelector('.carrier-container');

    const rotateButton = document.querySelector('#rotate');

    let style;

    let isHorizontal = true;

    // Girar los barcos
    function rotate() {
        isHorizontal = isHorizontal ? false : true;
        displayGrid.style.display = isHorizontal ? 'inline-block' : 'flex';
        destroyer.classList.toggle('destroyer-container-vertical'); // toggle elimina una clase si existe, sino la agrega
        submarine.classList.toggle('submarine-container-vertical');
        cruiser.classList.toggle('cruiser-container-vertical');
        battleship.classList.toggle('battleship-container-vertical');
        carrier.classList.toggle('carrier-container-vertical');
    }
    rotateButton.addEventListener('click', rotate);

    // Mover naves
    let userSquares = [];
    for (let i = 0; i < ROWS; i++) {
        for (let j = 0; j < COLUMNS; j++) {
            let id = `${i}${j}`;
            userSquares.push($(id));
        }
    }

    ships.forEach(ship => ship.addEventListener('dragstart', dragStart));
    userSquares.forEach(square => square.addEventListener('dragstart', dragStart));
    userSquares.forEach(square => square.addEventListener('dragover', dragOver));
    userSquares.forEach(square => square.addEventListener('dragenter', dragEnter));
    userSquares.forEach(square => square.addEventListener('dragleave', dragLeave));
    userSquares.forEach(square => square.addEventListener('drop', dragDrop));

    let selectedShipNameWithIndex;
    let draggedShip;
    let draggedShipLength;

    ships.forEach(ship =>
        ship.addEventListener('mousedown', e => {
            selectedShipNameWithIndex = e.target.id;
        })
    );

    function dragStart() {
        draggedShip = this;
        draggedShipLength = this.childNodes.length;
    }

    function dragOver(e) {
        e.preventDefault();
    }

    function dragEnter(e) {
        e.preventDefault();
        style = this.style;
        if (!this.classList.contains('taken')) {
            this.style.background = 'white';
        } else {
            this.style.background = 'red';
        }
    }

    function isValid(id, isHorizontal,selectedShipIndex){

        if(isHorizontal){
            for (let i = 0; i < draggedShipLength; i++) {
                // resto a la columna del id actual el indice de donde tomo el barco para posteriormente marcar el square como visitado
                // marco como visitado avanzando hacia la derecha por eso el + i
                let index = `${id[0]}${parseInt(id[1]) - selectedShipIndex + i}`;
                if (userSquares[parseInt(index)].classList.contains('taken'))
                    return false;
            }
        }
        else{
            for (let i = 0; i < draggedShipLength; i++) {
                let index = `${parseInt(id[0]) - selectedShipIndex + i}${id[1]}`;
                if(userSquares[parseInt(index)].classList.contains('taken'))
                    return false;
            }
        }

        return true;
    }
    
    function dragLeave() {
        this.style = style;
    }

    function dragDrop() {
        this.style = style;
        let shipNameWithLastId = draggedShip.lastChild.id;
        // quito el indice y me quedo con la className del barco
        let shipClass = shipNameWithLastId.slice(0, -2);
        // guardo el ultimo indice del barco (que seria el tamaño del barco)
        let lastShipIndex = parseInt(shipNameWithLastId.substr(-1));
        // sumo el tamaño del barco al indice del casillero donde quiero insertar (corrimiento)
        let shipLastId = lastShipIndex + parseInt(this.id);

        // Me fijo en el square x - 1 de todas las filas, siendo x el tamaño del barco
        // la ultima parte de mi barco siempre tiene que estar fuera de las squares restringidas
        const notAllowedHorizontal = [
            0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 1, 11, 21, 31, 41, 51, 61, 71, 81, 91, 2, 22, 32, 42, 52, 62, 72, 82, 92, 3, 13, 23, 33, 43, 53, 63, 73, 83, 93,
        ];

        // Me quedo con parte del array, porque solo me tengo que fijar los primeros N squares de mas a la derecha siendo N el tamaño del barco - 1
        // ejm: si el barco es de tamaño 3, la ultima parte del barco no puede estar en las celdas "0" y "1" de todas las filas, porque se estaria desbordando
        // si el barco es de tamaño 4 no me dejara insertar en las primeras celdas porque tambien toma el square 03 como restringido
        let newNotAllowedHorizontal = notAllowedHorizontal.splice(0, 10 * lastShipIndex);
        const notAllowedVertical = [
            99, 98, 97, 96, 95, 94, 93, 92, 91, 90, 89, 88, 87, 86, 85, 84, 83, 82, 81, 80, 79, 78, 77, 76, 75, 74, 73, 72, 71, 70, 69, 68, 67, 66, 65, 64, 63, 62, 61, 60,
        ];
        // notAllowedVertical.reverse();
        let newNotAllowedVertical = notAllowedVertical.splice(0, 10 * lastShipIndex);

        // desde que indice tomo el barco
        let selectedShipIndex = parseInt(selectedShipNameWithIndex.substr(-1));
        // resto desde que indice tomo el barco
        // porque dependiendo de donde tomo el barco voy a insertar en un square distinto
        // la ultima parte del barco tiene que quedarme siempre fuera de las celdas restringidas
        shipLastId = shipLastId - selectedShipIndex;

        if (isHorizontal && !newNotAllowedHorizontal.includes(shipLastId) && isValid(this.id,isHorizontal,selectedShipIndex)) {
            for (let i = 0; i < draggedShipLength; i++) {
                // resto a la columna del id actual el indice de donde tomo el barco para posteriormente marcar el square como visitado
                // marco como visitado avanzando hacia la derecha por eso el + i
                let index = `${this.id[0]}${parseInt(this.id[1]) - selectedShipIndex + i}`;
                userSquares[parseInt(index)].classList.add('taken', shipClass);
            }
        } else if (!isHorizontal && !newNotAllowedVertical.includes(shipLastId) && isValid(this.id,isHorizontal,selectedShipIndex)) {
            for (let i = 0; i < draggedShipLength; i++) {
                let index = `${parseInt(this.id[0]) - selectedShipIndex + i}${this.id[1]}`;
                userSquares[parseInt(index)].classList.add('taken', shipClass);
            }
        } else return;
        displayGrid.removeChild(draggedShip);
    }   
};
