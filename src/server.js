import http from 'http';
import 'dotenv/config';
import fs from 'fs';

const HOST = process.env.HOST || 'localhost';
const PORT = process.env.PORT || 3000;

const serverHandler = async (req, res) => {

    const requestURL = new URL(req.url, `http://${req.headers.host}`) ;

    const redirectURLAfterLogin = `${requestURL.origin}/get-token-hash`;
    let tokenSpotify = '';

    // GET http://HOST:PORT/get-token-hash
    if (req.method === 'GET' && requestURL.pathname === '/get-token-hash'){
        console.log('accessed GET /get-token-hash');

        res.writeHead(201, 'OK', {
            "Content-Type" : "text/html",
        });
        const fileHTML = fs.readFileSync(process.cwd() + '/src/services/token/tokenHash.html');
        res.write(fileHTML);
        res.end();
    }

    // POST http://HOST:PORT/get-token-hash
    // taking the token to the server after submitting post request from GET /get-token-hash
    else if (req.method === 'POST' && requestURL.pathname === '/get-token-hash'){
        console.log('accessed POST /get-token-hash');

        req.on('data', (chunk) => {
            tokenSpotify += chunk;
        });

        req.on('end', () => {
            console.log('end of request POST /get-token-hash');
            tokenSpotify = new URLSearchParams(tokenSpotify);
            tokenSpotify = tokenSpotify.get('access_token');

            res.writeHead(201, {
                'Content-Type': 'text/plain'
            });
            res.write(tokenSpotify);
            res.end('OK');
        })
    }

    else {
        console.log('masuk else');
        req.on('data', (chunk) => {
            console.log(chunk);
        });
        res.writeHead(201, 'OK');
        res.write('masuk else');
        res.end();
    }

}

const server = http.createServer(serverHandler);
server.listen(PORT, HOST, () => {
    console.log(`Server is running at ${HOST}:${PORT}`);
})