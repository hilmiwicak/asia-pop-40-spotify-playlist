require('dotenv').config()
const cheerio  = require('cheerio');
const fetch = require("node-fetch");
const fs = require('fs')

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
    // const test = await fetch('https://reddit.com/')
    // const body = await test.text()
    // return cheerio.load(body)

    const AP40HTMl = await fetch("http://asiapop40.com")
                                .then(response => response.text())
                                .catch(err => console.log(err))

    const $ = cheerio.load(AP40HTMl)

    //buat percobaan pertama, pake first dulu, nanti baru pake each
    const chartSong = $('.accordion-item').first()
    const chartSongRank = chartSong.find('.chart-track-rank').text()
    const chartSongTitle = chartSong.find('.chart-track-title').text()
    const chartSongArtist = chartSong.find('.chart-artist-title').text()
    // return chartItem
    const chartData = chartSongRank + '\n' + chartSongTitle + '\n' + chartSongArtist
    fs.writeFileSync('./test.txt', chartData, 'utf8')


    // const allChartArray = []
    // $('.accordion-item').each((i, chartItem) => {
    //     const chartNode = $(chartItem)
    //     allChartArray.push(chartNode.html())
    // })
    // fs.writeFileSync('./test.txt', allChartArray.toString(), 'utf8')

    
}

async function mainFunction(){

    console.log('Scraping Asia Pop 40 \'s website ...')
    const top40List = await scrapeAP40()
    // console.log(top40List)

    // console.log('Getting Spotify Token ...')
    // const token = await getToken()
 
    // console.log('Updating Spotify Playlist')



    
}

mainFunction()