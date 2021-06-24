require('dotenv').config()
const { default: fetch } = require("node-fetch");

const PLAYLIST_ID = process.env.SPOTIFY_PLAYLIST_ID 

function getToken() {
    
    const encodeClientKey = process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET
    const encodedClientKey = Buffer.from(encodeClientKey, 'utf-8').toString('base64')    

    return fetch("https://accounts.spotify.com/api/token", {
        method : "post",
        headers : {
            'Authorization' : "Basic " + encodedClientKey,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body : 'grant_type=client_credentials'
    })
    .then(response => (response.json()))
    .then(json => ((json.access_token)))
}

//next api call
async function test(){
    const testing = await getToken()
}
