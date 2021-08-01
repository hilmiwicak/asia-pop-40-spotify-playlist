import 'dotenv/config.js'
import cheerio from 'cheerio'
import fetch from 'node-fetch'
import fs from 'fs'
import puppeteer from 'puppeteer'
import { URL } from 'url'
import { spawn } from 'child_process'

const spotifyPassword = process.env.SPOTIFY_PASSWORD
const spotifyEmail = process.env.SPOTIFY_EMAIL
const clientID = process.env.SPOTIFY_CLIENT_ID
const playlistID = process.env.SPOTIFY_PLAYLIST_ID

/**
 * function that scrapes Asia Pop 40's website.
 * takes texts from classes "chart-track-<title or rank or artists>" ,
 * change them into array, and returns the array object (json)
 */
const scrapeAP40 = async () => {

    console.log(`Scraping Asia Pop 40's webiste...`)

    let AP40HTML
    let songs = []

    try {
        const AP40Fetch = await fetch("http://asiapop40.com")
        if(!AP40Fetch.ok) throw new Error('not fetching asiapop40 correctly') 
        AP40HTML = await AP40Fetch.text()
    } catch (err) {
        console.error("Error inside scrapeAP40 : " + err)
        return
    }

    const $ = cheerio.load(AP40HTML)

    $('.accordion-item').each((i, chartItem) => {
        let chartNode = $(chartItem)

        let chartSongRank = chartNode.find('.chart-track-rank').text()

        // find the title, removing the '-', and then get the text
        let chartSongTitle = chartNode.find('.chart-track-title').children().remove().end().text()
        chartSongTitle = chartSongTitle.replace('ft. ', '')
        chartSongTitle = chartSongTitle.replace(/[\[\]]+/g, '')

        let chartSongArtists = []
        chartNode.find('.chart-artist-title').children().each((i, artist) => {
            let artistNode = $(artist)
            chartSongArtists.push(artistNode.text())
        })

        let chartData = {
            rank        : chartSongRank,
            title       : chartSongTitle,
            artists     : chartSongArtists,
            spotifyURI  : ""
        }

        songs.push(chartData)
    })

    return songs
}

/**
 * function to spawn a server child processs
 * 
 * @returns 
 */
const startServer = () => {
    return new Promise((resolve, reject) => {
        const server = spawn('node', ['server.js'])

        server.stdout.on('data', (data) => {
            console.log(`output server : ${data}`)
            resolve()
        })

        server.stderr.on('data', (dataErr) => {
            console.error(`error server : ${dataErr}`)
        })

    })
}

/** 
 * function that fetches spotify implicit grant token
 */
const fetchSpotifyToken = async (redirectURL) => {

    try {
        const spotifyTokenURL =
            'https://accounts.spotify.com/authorize?' +
            'client_id=' + clientID +
            '&response_type=token' +
            '&redirect_uri=' + redirectURL +
            '&scope=playlist-modify-public' 

        const spotifyTokenFetch =  await fetch(spotifyTokenURL)
        if (!spotifyTokenFetch.ok) throw new Error('not fetching spotify token correctly')
        return spotifyTokenFetch.url
    } catch (err) {
        console.error("Error inside fetchSpotifyToken : " + err)
    }
}

/**
 * function to perform login and take token from implicit grant flow
 */
const getSpotifyToken = async (urlTokenFetch, redirectURL) => {

    urlTokenFetch = new URL(urlTokenFetch)
    redirectURL = new URL(redirectURL)

    const browser = await puppeteer.launch({
        headless : false,
        devtools : true,
    })

    const page = await browser.newPage()
    await page.setDefaultTimeout(0)

    await page.goto(urlTokenFetch.toString())
    await page.waitForSelector('input#login-username[name=username]')

    await page.click('[name=remember]')
    await page.type('input[name=username]', spotifyEmail, { delay : 300 })
    await page.type('input[name=password]', spotifyPassword, { delay : 300 })

    await page.click('button#login-button')

    await page.waitForRequest(
        (request) => {
            const requestURL = new URL(request.url())
            return requestURL.pathname === redirectURL.pathname && request.method() === 'POST'
        }, { timeout : 10000 }
    )
    .catch( (err) => { 
        new Error(`Error inside on waitForRequest : ${err}`)
        await browser.close()
        return
    })

    await browser.close()
    await console.log(`End of puppeteer`)
}

/**
 * function that removes all songs inside playlist
 * it reads uris.json, and then sends them to the spotify api
 * to remove the songs from the list
 */
const removeSpotifyPlaylistSongs = async (token) => {

    let songURIs = fs.readFileSync('./uris.json', 'utf8')
    songURIs = JSON.parse(songURIs)

    let tracks = []

    songURIs.forEach((uri) => {
        let trackURI = {
            "uri" : uri
        }
        tracks.push(trackURI)
    })

    let dataTracks = {
        'tracks' : tracks
    }

    try {
        const removeSongs = await fetch("https://api.spotify.com/v1/playlists/" + playlistID + "/tracks", {
            method : "delete",
            headers : { 
                'Authorization' : "Bearer " + token,
                'Content-Type'  : 'application/json',
            },
            body : JSON.stringify(dataTracks)
        })

    } catch (err) {
        console.error("Error inside removeSpotifyPlaylistSongs : " + err)
    }
}

/**
 * function for searching one song uri
 * if the song doesn't exist in spotify, it puts mr. brightside song
 */
const searchSpotifySongURI = async (token, searchQuery) => {
    const spotifySearch = await fetch("https://api.spotify.com/v1/search?q=" + searchQuery + "&type=track&limit=1", {
        headers : { 
            'Authorization' : "Bearer " + token,
            'Content-Type'  : 'application/json',
            'Accept'        : 'application/json'
        }
    })

    if (!spotifySearch.ok) {
        console.error('not fetching spotify search correctly')
        return
    }

    const spotifySearchResult = await spotifySearch.json()

    try {
        if (!spotifySearchResult.tracks.items[0].uri) throw new Error('no uri')
        return spotifySearchResult.tracks.items[0].uri
    } catch (err) {
        console.error(`No uri while searching : ${searchQuery} : ${err}`)
        return 'spotify:track:7oK9VyNzrYvRFo7nQEYkWN'
    }
}

/**
 * takes songs json, change them into array, search
 * for each song's uri through spotify search API from the array 
 * and put them into the array, change them into json
 */
const searchSpotifySongURIs = async (token, songs) => {

    let songURIs = []

    for(let song of songs){
        const artist = song.artists.join(' ')
        const title = song.title
        const searchQuery = encodeURI(title + artist)

        const searchSongResult = await searchSpotifySongURI(token, searchQuery)
        songURIs.push(searchSongResult)
    }

    fs.writeFileSync('./uris.json', JSON.stringify(songURIs), 'utf8')
    return songURIs
}

/**
 * function that add all songs to the playlist
 */
const addSpotifyPlaylistSongs = async (token, songURIs) => {

    const dataURIs = {
        uris : songURIs,
    }

    try {
        const addSongs = await fetch("https://api.spotify.com/v1/playlists/" + playlistID + "/tracks", {
            method : "post",
            headers : { 
                'Authorization' : "Bearer " + token,
                'Content-Type'  : 'application/json',
            },
            body : JSON.stringify(dataURIs)
        })
    } catch (err) {
        console.error("Error inside addSpotifyPlaylistSongs : " + err)
    }
}

export {
    scrapeAP40,
    startServer,
    fetchSpotifyToken, 
    getSpotifyToken, 
    removeSpotifyPlaylistSongs,
    searchSpotifySongURIs,
    addSpotifyPlaylistSongs,
}