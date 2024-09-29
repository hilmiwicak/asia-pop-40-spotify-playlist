# Asia Pop 40 Spotify Playlist Auto Update

This project's purpose is to automate the process of updating Asia Pop 40's playlist in spotify.

## Prerequisites

1. Node with NPM

## Using asia-pop-40-spotify-playlist

1. Make sure you have your application registered in spotify, put `localhost:3000/get-token-hash` for the redirect URL.
2. Run

```
touch ./src/temp/uris.json
cp .env.example .env # and then fill it out
npm install
npm run start
```

## Why in Javascript / Node.js

At first I didn't have any reasons particular in mind. I just wanted to learn about Node.js further (I've developed in MERN stack for about 1 month) and after while doing this project, I noticed that I don't know anything. One advantage of using Javascript is that it has a lot of libraries that later I used in this project. Other than that, I think the downside of Javascript is that promises are a headache.

## The Runtime Order of The Project

You can see this inside [src/index.js](/src/index.js)  

1. Runs puppeteer to download "Most Recent Chart.csv" from airtable and then rename it into "src/temp/ap40.csv". `getAP40csv()`
2. Extract the data from ap40.csv. `parseAP40csv()`
3. Starts server to get the redirected token from Spotify API `startServer()`

    *Why do you have to use a server*?

    Because I use authorization code flow. Every authorization flow needs redirect_uri in their query parameter (except client credentials, but the scope of client credentials flow is so small) , and they returns the token inside the url (either hash parameter or query parameter). Server is needed to send the token into node code.  

    accessing `localhost:3000/get-token-hash?code=xxx` endpoint using GET method will automatically close the server.

4. Starts puppeteer and getting the authorization code. `automateSpotifyToken()`
5. Exchanging the authorization code into access token. `getSpotifyAccessToken()`
6. Removes all songs from the playlist while searching the songs from the chart in spotify. `removeSpotifyPlaylistSongs`

    *How does it removes the previous songs, meanwhile Spotify API can't removes songs immediately?*

    By saving the previous added song uris into a file called uris.json.

7. Adds the searched songs to the playlist. `addSpotifyPlaylistSongs()`
8. Update the title. `updateSpotifyPlaylistTitle()`
