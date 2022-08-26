const crypto = require("crypto");

/*--------------------CREAR IDS-----------------------------------

/*Generar un ID unico de tamaño recibido por parámetro */
function generateId(tamanio) {
    return crypto.randomBytes(tamanio).toString("hex");
}

/* Genera el objeto inicial de keys para una partida y lo retorna */
function newGameKeys() {
    return {
        boardId: generateId(20),
        player1Id: generateId(5),
        player2Id: null,
    };
}
module.exports = {
    generateId,
    newGameKeys
}