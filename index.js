require('dotenv').config()
const cheerio  = require('cheerio');
const fetch = require("node-fetch");
const fs = require('fs')

/** 
 * function that takes spotify client credential flow's token
 *  
 */
const getToken = () => {
    
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

/**
 * function that scrapes Asia Pop 40 's website .
 * takes texts from classes "chart-track-<title or rank or artists>" ,
 * change them into array and then into json object, and finally
 * stores it into ./chart.json
 */
const scrapeAP40 = async () => {

    const AP40HTMl = await fetch("http://asiapop40.com")
                                .then(response => response.text())
                                .catch(err => console.log(err))

    const $ = cheerio.load(AP40HTMl)

    let charts = []

    $('.accordion-item').each((i, chartItem) => {
        let chartNode = $(chartItem)
        let chartSongRank = chartNode.find('.chart-track-rank').text()

        let chartSongTitle = chartNode.find('.chart-track-title').text()
        chartSongTitle = chartSongTitle.split(' ')
        chartSongTitle.pop() // removing the '-' when taking the title
        chartSongTitle = chartSongTitle.join(' ')

        let chartSongArtists = []
        chartNode.find('.chart-artist-title').children().each((i, artist) => {
            let artistNode = $(artist)
            chartSongArtists.push(artistNode.text())
        })
                
        let chartData = {
            rank : chartSongRank,
            title : chartSongTitle,
            artists : chartSongArtists
        }
    
        charts.push(chartData)
    })

    fs.writeFileSync('./chart.json', JSON.stringify(charts), 'utf8')
    
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
 
    // console.log('Updating Spotify Playlist')



    
}

mainFunction()