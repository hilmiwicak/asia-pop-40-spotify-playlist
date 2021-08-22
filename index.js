import {
    scrapeAP40,
    startServer,
    getSpotifyToken, 
    removeSpotifyPlaylistSongs,
    searchSpotifySongURIs,
    addSpotifyPlaylistSongs,
} from './functions.js'

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
 * parallel search spotify track's URI
 */

(async () => {
    let token, chartSongs, songsURI

    chartSongs = await scrapeAP40()

    startServer()

    try {
        token = await getSpotifyToken()
        console.log(token)
    } catch (err) {
        console.error(err)
        return
    }

    removeSpotifyPlaylistSongs(token)

    songsURI = await searchSpotifySongURIs(token, chartSongs)
    addSpotifyPlaylistSongs(token, songsURI)

})()