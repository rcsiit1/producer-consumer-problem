// Environment variables
require('dotenv').config();

const http = require('http');
const app = require('./app');

// starting HTTP server
http.createServer(app).listen(app.get('port'), () => {
  console.log(`Express server listening on port ${app.get('port')}`);
});
