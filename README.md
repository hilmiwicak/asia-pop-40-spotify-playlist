# Asia Pop 40 Spotify Playlist Auto Update

This project's purpose is to automate the process of updating Asia Pop 40's playlist in spotify. Check the playlist on [Spotify](https://open.spotify.com/playlist/5ftLAxfKdp8sc15DPvFbrH)!

## Prerequisites

1. Node with NPM

## Using asia-pop-40-spotify-playlist

1. Make sure you have your application registered in spotify, and put `localhost:3000/get-token-hash` for the redirect URL.
2. Run

```
touch ./src/temp/uris.json
cp .env.example .env # and then fill it out
npm install
npm start
```

## The Runtime Order of The Project

You can see this inside [src/index.js](/src/index.js)  

1. Runs puppeteer to scrape the spotify URI from Asia Pop 40 's website, and then saves it into "src/temp/ap40.csv". `scrapeAP40()`
2. Starts server to get the redirected token from Spotify API `startServer()`

    *Why do you have to use a server*?

    Because I use authorization code flow. Every authorization flow needs redirect_uri in their query parameter (except client credentials, but the scope of client credentials flow is so small) , and they returns the token inside the url (either hash parameter or query parameter). Server is needed to send the token into node code.  

    accessing `localhost:1000/get-token-hash?code=xxx` endpoint using GET method will automatically close the server.

3. Starts puppeteer and getting the authorization code. `automateSpotifyToken()`
4. Exchanging the authorization code into access token. `getSpotifyAccessToken()`
5. Removes all songs from the playlist using the "src/temp/uris.json" file `removeSpotifyPlaylistSongs`
6. Adds the searched songs to the playlist. `addSpotifyPlaylistSongs()`
7. Update the title. `updateSpotifyPlaylistTitle()`
