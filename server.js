import http from 'http'
import 'dotenv/config'
import fs from 'fs'
import { 
    fetchSpotifyToken, 
    getSpotifyToken, 
} from './functions.js'

const HOST = process.env.HOST || 'localhost'
const PORT = process.env.PORT || 3000

const serverHandler = async (req, res) => {

    const requestURL = new URL(req.url, `http://${req.headers.host}`) 

    const redirectURLAfterLogin = `${requestURL.origin}/get-token-hash`
    let tokenSpotify = ''

    // GET http://HOST:PORT/login-spotify/
    if (req.method === 'GET' && requestURL.pathname === '/login-spotify'){
        console.log('accessed /login-spotify')
        console.log('taking you to the redirected url....')

        const responseToken = await fetchSpotifyToken(redirectURLAfterLogin)
        const responseTokenURL = await responseToken

        res.writeHead(302, 'Moving you to the redirected URL', {
            'location' : responseTokenURL
        })
        res.end()

        getSpotifyToken(responseTokenURL, redirectURLAfterLogin)
    } 

    // GET http://HOST:PORT/get-token-hash
    else if (req.method === 'GET' && requestURL.pathname === '/get-token-hash'){
        console.log('accessed /get-token-hash')

        res.writeHead(201, 'OK', {
            "Content-Type" : "text/html",
        })
        const fileHTML = fs.readFileSync('./services/token/tokenHash.html')
        res.write(fileHTML)
        res.end()
    }

    // POST http://HOST:PORT/get-token-hash
    // taking the token to the server after submitting post request from GET /get-token-hash
    else if (req.method === 'POST' && requestURL.pathname === '/get-token-hash'){
        console.log('accessed /get-token-hash')

        req.on('data', (chunk) => {
            tokenSpotify += chunk
        })

        req.on('end', () => {
            console.log('end of request POST /get-token-hash')
            tokenSpotify = new URLSearchParams(tokenSpotify)
            tokenSpotify = tokenSpotify.get('access_token')
        })

        //  I DON'T KNOW HOW TO SEND FROM SERVER TO index.js
        // MAYBE I CAN DO THIS WITH PUPPETEER
        res.writeHead(201, 'OK' )
        res.write(tokenSpotify)
        res.end()
    }

    else {
        console.log('masuk else')
        res.writeHead(201, 'OK')
        res.write('masuk else')
        res.end()
    }

}

const server = http.createServer(serverHandler)
server.listen(PORT, HOST, () => {
    console.log(`Server is running at ${HOST}:${PORT}`)
})