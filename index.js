require('dotenv').config()
const { cheerio } = require('cheerio');
const { default: fetch } = require("node-fetch");

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
    .then(response => response.json())
    .then(responseJson => responseJson)
    .catch(err => err)
}

async function scrapeAP40(){
    const AP40Response = fetch("http://asiapop40.com").then()
}

async function mainFunction(){

    console.log('Scraping Asia Pop 40 \'s website ...')

    console.log('Getting Spotify Token ...')
    const token = await getToken()
 
    console.log('Updating Spotify Playlist')



    
}

mainFunction()