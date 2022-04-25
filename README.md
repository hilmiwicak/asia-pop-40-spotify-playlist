# asia-pop-40-spotify-playlist

Auto update spotify playlist from Asia Pop 40 's website.
Built with Nodejs with the following libraries / modules:
1. [cheerio](https://github.com/cheeriojs/cheerio)
2. [puppeteer](https://github.com/puppeteer/puppeteer/)
3. [node-fetch](https://github.com/node-fetch/node-fetch)
4. node HTTP module
5. node Child Process module

# Prerequisites

1. Node with NPM

# Using asia-pop-40-spotify-playlist

1. Make sure you have your application registered in spotify, put `localhost:3000/get-token-hash` for the redirect URL.
2. Copy `.env.example` to `.env` and fill it out.
3. Run
```
touch ./src/uris.json
npm install
node ./src/index.js
```

# Why I Make This Project

The reason I started this project is because there are no updated Asia Pop 40's playlist in spotify.  

# Why in Javascript / Node.js

At first I didn't have any reasons particular in mind.
I just wanted to learn about Node.js further (I've developed in MERN stack for about 1 month) and after while doing this project, I noticed that I don't know anything.
One advantage of using Javascript is that it has a lot of libraries that later I used in this project.
Other than that, I think the downside of Javascript is that promises are a headache.

# The Runtime Order of The Project

You can see this inside [this file.](.\src\index.js)  
1. Scrapes the asiapop40.com website, gets the top 40 chart.
2. Starts server to get the redirected token from Spotify API  
    _Why do you have to use a server_?  
    Because I use authorization code flow. Every authorization flow needs redirect_uri in their query parameter (except client credentials, but the scope of client credentials flow is so small) , and they returns the token inside the url (either hash parameter or query parameter). Server is needed to send the token into node code.  
3. Starts puppeteer and getting the authorization code.
4. Exchanging the authorization code into access token.   
    This is runned by function getSpotifyAccessToken that is called inside getSpotifyToken.
5. Removes all songs from the playlist while searching the songs from the chart in spotify  
    _How does it removes the previous songs, meanwhile Spotify API can't removes songs immediately?_  
    By saving the previous added song uris into a file called uris.json.  
6. Adds the searched songs to the playlist
7. Update the title
