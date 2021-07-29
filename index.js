import {
    scrapeAP40,
    fetchSpotifyToken,
} from './functions.js'
import http from 'http'

/**
 * urutan eksekusi
 * 
 * scrapeAP40, serve server - request login-spotify
 * search, remove
 * add
 * edit description
 */

(async () => {
    // const chartSongs = await scrapeAP40()

    // serve server

    // go to login-spotify
    http.get('http://localhost:3000/login-spotify')

    // 
})()