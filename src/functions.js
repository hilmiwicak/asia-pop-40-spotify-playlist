import 'dotenv/config.js';
import cheerio from 'cheerio';
import fetch from 'node-fetch';
import fs from 'fs';
import puppeteer from 'puppeteer';
import { URL } from 'url';
import { spawn } from 'child_process';

const spotifyPassword = process.env.SPOTIFY_PASSWORD;
const spotifyEmail = process.env.SPOTIFY_EMAIL;
const clientID = process.env.SPOTIFY_CLIENT_ID;
const playlistID = process.env.SPOTIFY_PLAYLIST_ID;

/**
 * function that scrapes Asia Pop 40's website.
 * takes texts from classes "chart-track-<title or rank or artists>" ,
 * change them into array, and returns the array object (json)
 */
const scrapeAP40 = async () => {
    return new Promise( async (resolve, reject) => {

        console.log(`Scraping Asia Pop 40's webiste...`);

        let AP40HTML;
        let songs = [];

        try {
            const AP40Fetch = await fetch("https://asiapop40.com");
            if(!AP40Fetch.ok) throw new Error('not fetching asiapop40 correctly');
            AP40HTML = await AP40Fetch.text();
        } catch (err) {
            console.error("Error inside scrapeAP40 : " + err);
            reject();
        }

        const $ = cheerio.load(AP40HTML);

        $('.accordion-item').each((i, chartItem) => {
            let chartNode = $(chartItem);

            // find the title, removing the '-', and then get the text
            let chartSongTitle = chartNode.find('.chart-track-title').children().remove().end().text();
            chartSongTitle = chartSongTitle.replace('ft. ', '');
            chartSongTitle = chartSongTitle.replace(/[\[\]]+/g, '');

            let chartSongArtists = [];
            chartNode.find('.chart-artist-title').children().each((i, artist) => {
                let artistNode = $(artist);
                chartSongArtists.push(artistNode.text());
            });

            let chartData = {
                title       : chartSongTitle,
                artists     : chartSongArtists,
                spotifyURI  : ""
            };

            songs.push(chartData);
        });

        console.log(`Done scraping Asia Pop 40's webiste`);
        resolve(songs);
    });
}

/**
 * function to spawn a server child processs
 * dies after 5 minutes
 * 
 */
const startServer = () => {
    const server = spawn('node', ['./src/server.js']);

    server.stdout.on('data', (data) => {
        console.log(`output server : ${data}`);
    });

    server.stderr.on('data', (dataErr) => {
        console.error(`error server : ${dataErr}`);
    });

    setTimeout(() => {
        server.kill();
    }, 60000);

}

/**
 * function to perform login and take token from implicit grant flow
 * 
 * @returns promise with resolve token / reject undefined
 */
const getSpotifyToken = () => {
    return new Promise( async (resolve, reject) => {

        console.log(`Running puppeteer to get the token ...`);

        const redirectURL = new URL('http://localhost:3000/get-token-hash');
        const spotifyTokenURL =
            'https://accounts.spotify.com/authorize?' +
            'client_id=' + clientID +
            '&response_type=token' +
            '&redirect_uri=' + redirectURL +
            '&scope=playlist-modify-public';

        const browser = await puppeteer.launch({headless: false, devtools: true});

        const page = await browser.newPage();
        await page.setDefaultTimeout(0);

        await page.goto(spotifyTokenURL, {
            waitUntil: "networkidle2"
        });

        await page.waitForSelector('input#login-username[name=username]');

        await page.type('input#login-username[name=username]', spotifyEmail, { delay : 300 });
        await page.type('input#login-password', spotifyPassword, { delay : 300 });
        await page.click('input#login-remember');
        await page.click('button#login-button');

        try {
            await page.waitForNavigation({
                timeout: 10000,
                waitUntil: "networkidle2"
            });
        } catch (err) {
            console.error(`Error waitForNavigation : ${err}`);
            reject(err)
        }

        try {
            let token = await page.content();
            await browser.close();

            token = token.replace(/<([^>]+)>/gi, ''); // strip tags
            console.log(`Done taking token`);
            resolve(token);
        } catch (err) {
            console.error(`error inside content ${reject}`);
            browser.close();
            reject(undefined);
        }
    });
}

/**
 * function that removes all songs inside playlist
 * it reads uris.json, and then sends them to the spotify api
 * to remove the songs from the list
 */
const removeSpotifyPlaylistSongs = async (token) => {
    return new Promise( async (resolve, reject) => {

        console.log(`Removing songs on spotify playlist...`);

        let songURIs = fs.readFileSync(process.cwd() + '/src/uris.json', 'utf8');
        songURIs = JSON.parse(songURIs);

        let tracks = [];

        songURIs.forEach((uri) => {
            let trackURI = {
                "uri" : uri
            };
            tracks.push(trackURI);
        });

        let dataTracks = {
            'tracks' : tracks
        };

        try {
            await fetch("https://api.spotify.com/v1/playlists/" + playlistID + "/tracks", {
                method : "delete",
                headers : { 
                    'Authorization' : "Bearer " + token,
                    'Content-Type'  : 'application/json',
                },
                body : JSON.stringify(dataTracks)
            });
            console.log(`Done removing songs`);
            resolve();

        } catch (err) {
            console.error("Error inside removeSpotifyPlaylistSongs : " + err);
            reject();
        }
    });
}

/**
 * function for searching one song uri
 * if the song doesn't exist in spotify, it returns nothing
 */
const searchSpotifySongURI = async (token, searchQuery) => {
    const spotifySearch = await fetch("https://api.spotify.com/v1/search?q=" + searchQuery + "&type=track&limit=1", {
        headers : { 
            'Authorization' : "Bearer " + token,
            'Content-Type'  : 'application/json',
            'Accept'        : 'application/json'
        }
    });

    if (!spotifySearch.ok) {
        console.error('not fetching spotify search correctly');
        return;
    }

    const spotifySearchResult = await spotifySearch.json();

    try {
        if (!spotifySearchResult.tracks.items[0].uri) throw new Error('no uri');
        return spotifySearchResult.tracks.items[0].uri;
    } catch (err) {
        console.error(`No uri while searching : ${searchQuery} : ${err}`);
    }
}

/**
 * takes songs json, change them into array, search
 * for each song's uri through spotify search API from the array 
 * and put them into the array, change them into json
 */
const searchSpotifySongURIs = async (token, songs) => {
    return new Promise( async (resolve, reject) => {

        console.log(`Searching for track's URI in spotify...`);

        let songURIs = [];

        for(let song of songs){
            const artist = song.artists.join(' ');
            const title = song.title;
            const searchQuery = encodeURI(title + artist);

            const searchSongResult = await searchSpotifySongURI(token, searchQuery);
            songURIs.push(searchSongResult);
        }

        fs.writeFileSync(process.cwd() + '/src/uris.json', JSON.stringify(songURIs), 'utf8');
        console.log(`Done Searching`);
        resolve(songURIs);
    });
}

/**
 * function that add all songs to the playlist
 */
const addSpotifyPlaylistSongs = async (token, songURIs) => {
    return new Promise( async (resolve, reject) => {

        console.log('Adding searched songs to spotify playlist ...');

        const dataURIs = {
            uris : songURIs,
        };

        try {
            await fetch("https://api.spotify.com/v1/playlists/" + playlistID + "/tracks", {
                method : "post",
                headers : { 
                    'Authorization' : "Bearer " + token,
                    'Content-Type'  : 'application/json',
                },
                body : JSON.stringify(dataURIs)
            });
            console.log(`Done adding searched songs`);
            resolve();
        } catch (err) {
            console.error("Error inside addSpotifyPlaylistSongs : " + err);
            reject();
        }
    });
}

export {
    scrapeAP40,
    startServer,
    getSpotifyToken, 
    removeSpotifyPlaylistSongs,
    searchSpotifySongURIs,
    addSpotifyPlaylistSongs,
}
