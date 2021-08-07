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

/**
 * NOTES :
 * how do you kill server child process not through timeout?
 * dynamic redirectURL inside getSpotifyToken
 */

(async () => {
    let token, chartSongs
    let chartSongs = scrapeAP40()

    await Promise.all([
        getSpotifyToken(),
        startServer(),
    ])
    .then( messages => {
        token = messages[0]
    })

    console.log(token)

})()