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
    
            let chartSongRankThisWeek = chartNode.find('.chart-track-rank').text()
            let chartSongRankLastWeek = chartNode.find('.chart-track-rank-last-week').text()
            chartSongRankLastWeek = chartSongRankLastWeek.replace(/\n/g, "") // removing the '\n' globally
    
            // find the title, removing the '-', and then get the text
            let chartSongTitle = chartNode.find('.chart-track-title').children().remove().end().text()
    
            let chartSongArtists = []
            chartNode.find('.chart-artist-title').children().each((i, artist) => {
                let artistNode = $(artist)
                chartSongArtists.push(artistNode.text())
            })

            let chartData = {
                rankThisWeek    : chartSongRankThisWeek,
                rankLastWeek    : chartSongRankLastWeek,
                title           : chartSongTitle,
                artists         : chartSongArtists
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
const getToken = async () => {
    
    const clientKey = process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET
    const encodedClientKey = Buffer.from(clientKey, 'utf-8').toString('base64')    

    try {
        const spotifyTokenFetch =  
            await fetch("https://accounts.spotify.com/api/token", {
                method : "post",
                headers : {
                    'Authorization' : "Basic " + encodedClientKey,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body : 'grant_type=client_credentials'
            })

        if (!spotifyTokenFetch.ok) throw new Error('not fetching spotify token correctly')

        const spotifyTokenJson = await spotifyTokenFetch.json()
        return spotifyTokenJson
        
    } catch (err) {
        console.error("Error inside getToken : " + err)
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
    // const token = await getToken()
    // console.log(token)
 
    // console.log('Updating Spotify Playlist')



    
}

mainFunction()