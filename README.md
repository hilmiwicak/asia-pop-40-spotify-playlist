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
2. OS that can install chromium (I've tried using WSL and it failed, I think it's because my VM doesn't have chrome OR it can't install chrome)

# Using asia-pop-40-spotify-playlist

1. Make sure you have your application registered in spotify, put `localhost:3000/get-token-hash` for the redirect URL.
2. Copy `.env.example` to `.env` and fill it out.
3. Run
```
npm install
node ./src/index.js
```

# Why I Make This Project

The reason I started this project was when I was looking for asiapop40's spotify playlist and figured out that all existing playlists are not up-to-date.
I figured "while I'm on a semester holiday and I also wanted to learn Node.js, why not?".

# Why in Javascript / Node.js

At first I didn't have any reasons particular in mind.
I just wanted to learn about Node.js further (I've developed in MERN stack for about 1 month) and after while doing this project, I noticed that I don't know anything.
One advantage of using Javascript is that it has a lot of libraries that later I used in this project.
Other than that, I think the downside of Javascript is that promises are a headache.

# How Does This Project Work

1. Scrapes the asiapop40.com website, gets the top 40 chart
2. Starts server to get the redirected token from Spotify API  
    _Why do you have to use a server_?  
    Because I use implicit grant authorization flow.  
    _Why do you use implicit grant authorization flow_?  
    Because at first I used client credentials flow, because my application is running only the backend, doesn't need authorization using the app, or you can say it machine-to-machine communication, but later figured out that you can't update playlist using client credentials(ツ).
    Then it left me with 2 options: Authorization code and Implicit grant.  
3. Starts puppeteer and asks for the token
4. Removes previous songs from the playlist while searching the songs from the chart in spotify  
    How does it removes the previous songs while Spotify API can't removes songs emmidiately?
5. Adds the searched songs to the playlist
