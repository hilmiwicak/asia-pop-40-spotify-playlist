import 'dotenv/config.js'
import cheerio from 'cheerio'
import fetch from 'node-fetch'
import fs from 'fs'
import puppeteer from 'puppeteer'
import { URL } from 'url'

/**
 * function that scrapes Asia Pop 40 's website .
 * takes texts from classes "chart-track-<title or rank or artists>" ,
 * change them into array and then into json object, and finally
 * stores it into ./chart.json
 */
const scrapeAP40 = async () => {

    try {
        const AP40Fetch = await fetch("http://asiapop40.com")
        if(!AP40Fetch.ok) throw new Error('not fetching asiapop40 correctly') 
        const AP40HTMl = await AP40Fetch.text()

        const $ = cheerio.load(AP40HTMl)

        let charts = []

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

            charts.push(chartData)
        })

        fs.writeFileSync('./chart.json', JSON.stringify(charts), 'utf8')
    } catch (err) {
        console.error("Error inside scrapeAP40 : " + err)
    }
}

/** 
 * function that fetches spotify implicit grant token
 */
const fetchSpotifyToken = async (redirectURL) => {

    const clientID = process.env.SPOTIFY_CLIENT_ID 

    try {
        const spotifyTokenURL =
            'https://accounts.spotify.com/authorize?' +
            'client_id=' + clientID +
            '&response_type=token' +
            '&redirect_uri=' + redirectURL +
            '&scope=playlist-modify-public' 

        const spotifyTokenFetch =  await fetch(spotifyTokenURL)
        if (!spotifyTokenFetch.ok) throw new Error('not fetching spotify token correctly')
        return spotifyTokenFetch
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
    const spotifyEmail = process.env.SPOTIFY_EMAIL
    const spotifyPassword = process.env.SPOTIFY_PASSWORD

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
        }, {
            timeout : 10000
        }
    )
    .catch( (err) => { 
        new Error(`Error inside on waitForRequest : ${err}`)
    })

    await browser.close()
    await console.log(`End of puppeteer`)
}

/**
 * function for searching one song uri
 */
const searchSpotifySongURI = async (token, searchQuery) => {
    try {
        const spotifySearch = await 
            fetch("https://api.spotify.com/v1/search?q=" + searchQuery + "&type=track&limit=1", {
                method : "get",
                headers : { 
                    'Authorization' : "Bearer " + token,
                    'Content-Type'  : 'application/json',
                    'Accept'        : 'application/json'
                }
            })

        if (!spotifySearch.ok) throw new Error('not fetching spotify search correctly')
        const spotifySearchResult = await spotifySearch.json()
        return spotifySearchResult
    } catch (err) {
        console.error("Error inside searchSpotifySongURI : " + searchQuery + err )
    }
}

/**
 * read chart.json, change them into array, search
 * for each song's uri through spotify search API from the array 
 * and put them into the array, change them into json
 */
const spotifySongURIs = async (token) => {

    try {
        const chartsData = fs.readFileSync('./chart.json', 'utf8')
        let charts = JSON.parse(chartsData)

        for(let song of charts){
            const artist = song.artists.join(' ')
            const title = song.title
            const searchQuery = encodeURI(title + artist)

            try {
                const searchSongResult = await searchSpotifySongURI(token, searchQuery)
                song.spotifyURI = searchSongResult.tracks.items[0].uri
            } catch (err) { 
                // if it doesn't exist any song inside spotify, it puts mr. brightside song
                song.spotifyURI = 'spotify:track:7oK9VyNzrYvRFo7nQEYkWN'
            }
        }

        fs.writeFileSync('./chart.json', JSON.stringify(charts), 'utf8')
    } catch (err) {
        console.error("Error inside spotifySongURIs : " + err)
    }
}

/**
 * function that removes all songs inside playlist
 */
 const removeSpotifyPlaylistSongs = async (token) => {

    const spotifyPlaylistID = process.env.SPOTIFY_PLAYLIST_ID  

    try {
        const removeSongs = await 
            fetch("https://api.spotify.com/v1/playlists/" + spotifyPlaylistID + "/tracks", {
                method : "delete",
                headers : { 
                    'Authorization' : "Bearer " + token,
                    'Content-Type'  : 'application/json',
                },
                body : 'tracks'
            })

    } catch (err) {
        console.error("Error inside removeSpotifyPlaylistSongs : " + err)
    }
}

/**
 * function that add all songs to the playlist
 */
const addSpotifyPlaylistSongs = async (token) => {

    const spotifyPlaylistID = process.env.SPOTIFY_PLAYLIST_ID
    const chartsData = fs.readFileSync('./chart.json', 'utf8')
    let charts = JSON.parse(chartsData)

    let URIs = []
    charts.forEach( (chart) => {
        URIs.push(chart.spotifyURI)
    })

    try {
        const addSongs = await
        fetch("https://api.spotify.com/v1/playlists/" + spotifyPlaylistID + "/tracks", {
            method : "post",
            headers : { 
                'Authorization' : "Bearer " + token,
                'Content-Type'  : 'application/json',
            },
        })
    } catch (err) {
        console.error("Error inside addSpotifyPlaylistSongs : " + err)
    }
}

export {
    fetchSpotifyToken, 
    getSpotifyToken, 
}