require('dotenv').config()
const cheerio  = require('cheerio');
const fetch = require("node-fetch");
const fs = require('fs')

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
        console.error("Error inside scrapeAP40 :" + err)
    }
}

/** 
 * function that takes spotify client credential flow's token
 */
 const getSpotifyToken = async () => {
    
    const clientKey = process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET
    const encodedClientKey = Buffer.from(clientKey, 'utf-8').toString('base64')    

    try {
        const spotifyTokenFetch =  await
            fetch("https://accounts.spotify.com/api/token", {
                method : "post",
                headers : {
                    'Authorization' : "Basic " + encodedClientKey,
                    'Content-Type'  : 'application/x-www-form-urlencoded',
                },
                body : 'grant_type=client_credentials'
            })

        if (!spotifyTokenFetch.ok) throw new Error('not fetching spotify token correctly')

        const spotifyTokenJson = await spotifyTokenFetch.json()
        return spotifyTokenJson.access_token
    } catch (err) {
        console.error("Error inside getSpotifyToken : " + err)
    }
}

/**
 * read chart.json, change them into array, search
 * for each song's uri through spotify search API from the array 
 * and put them into the array, change them into json
 * 
 */
const spotifySongURIs = async (token) => {

    try {
        let chartsData = fs.readFileSync('./chart.json', 'utf8')
        chartsData = JSON.parse(chartsData)
        
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

        
        // const song = chartsData[30]
        // const artist = song.artists.join(' ')
        // const title = song.title
        // const searchQuery = encodeURI((title + artist))
        // console.log(searchQuery)
        // const searchSongResult = await searchSpotifySongURI(token, searchQuery)
        // song.spotifyURI = searchSongResult.tracks.items[0].uri
        // console.log(searchSongResult.tracks)

        for(let song of chartsData){
            const artist = song.artists.join(' ')
            const title = song.title
            // const searchQuery = (title + artist).replace(/\s/g, '+')
            const searchQuery = encodeURI(title + artist)
            // console.log(searchQuery)
            const searchSongResult = await searchSpotifySongURI(token, searchQuery)
            song.spotifyURI = searchSongResult.tracks.items[0].uri

        }

        return chartsData
    } catch (err) {
        console.error("Error inside spotifySongURIs : " + err)
    }
    
}

/**
 * main function that runs all of the functions above
 */
const mainFunction = async () => {

    console.log('Scraping Asia Pop 40 \'s website ...')
    const top40List = await scrapeAP40()
    // console.log(top40List)

    // console.log('Getting Spotify Token ...')
    // const token = await getSpotifyToken()
    // console.log(token)
 
    // console.log('Searches Spotify Songs from Asia Pop 40\'s List ...')
    // const URIs = await spotifySongURIs(token)
    // console.log(URIs)

    // console.log('Updating Spotify Playlist')



    
}

mainFunction()