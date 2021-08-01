import {
    scrapeAP40,
    startServer,
    getSpotifyToken, 
    removeSpotifyPlaylistSongs,
    searchSpotifySongURIs,
    addSpotifyPlaylistSongs,
} from './functions.js'
import http from 'http'

/**
 * supposed order of execution
 * 
 * scrapeAP40
 * serve server - then go to login-spotify until POST get-token-hash (getting the token)
 * 
 * remove AWAIT token
 * search AWAIT token & scrape
 * add AWAIT search & token
 * edit AWAIT add
 * 
 * scrapeAP40, serve server 
 * login-spotify until POST get-token-hash
 * remove
 * search 
 * add
 * edit description
 */

(async () => {
    let token
    let chartSongs = scrapeAP40()

    startServer()
    .then( res => {
        // http.get('http://localhost:3000/login-spotify')
        http.get('http://localhost:3000/')
    })

})()