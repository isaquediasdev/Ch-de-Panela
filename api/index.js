'use strict';
// Ponto de entrada serverless da Vercel.
// Reaproveita o mesmo app Express do server.js (que só chama listen() quando
// rodado direto via `node server.js`). Aqui ele é apenas importado, e a Vercel
// cuida do ciclo de request/response de cada função.
module.exports = require('../server.js');
