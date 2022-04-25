import "dotenv/config.js";
import cheerio from "cheerio";
import fetch from "node-fetch";
import fs from "fs";
import puppeteer from "puppeteer";
import { URL } from "url";
import { spawn } from "child_process";
import { nth, monthToHuman } from "./util/dateHelper.js";
import { Buffer } from "buffer";

const SPOTIFY_PASSWORD = process.env.SPOTIFY_PASSWORD;
const SPOTIFY_EMAIL = process.env.SPOTIFY_EMAIL;
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SECRET_CLIENT_ID = process.env.SPOTIFY_CLIENT_SECRET;
const PLAYLIST_ID = process.env.SPOTIFY_PLAYLIST_ID;

/**
 * function that scrapes Asia Pop 40's website.
 * takes texts from classes "chart-track-<title or rank or artists>" ,
 * change them into array, and returns the array object (json)
 */
const scrapeAP40 = async () => {
  return new Promise(async (resolve, reject) => {
    console.log(`Scraping Asia Pop 40's website...`);

    let AP40HTML;
    let songs = [];

    try {
      const AP40Fetch = await fetch("https://asiapop40.com");
      if (!AP40Fetch.ok) throw new Error("not fetching asiapop40 correctly");
      AP40HTML = await AP40Fetch.text();
    } catch (err) {
      console.error(`Error in scrapeAP40 : ${err}`);
      reject();
    }

    const $ = cheerio.load(AP40HTML);

    $(".accordion-item").each((i, chartItem) => {
      let chartNode = $(chartItem);

      // find the title, removing the '-', and then get the text
      let chartSongTitle = chartNode
        .find(".chart-track-title")
        .children()
        .remove()
        .end()
        .text();
      chartSongTitle = chartSongTitle
        .replace("ft. ", "")
        .replace(/[\[\]]+/g, "");

      let chartSongArtists = [];
      chartNode
        .find(".chart-artist-title")
        .children()
        .each((i, artist) => {
          let artistNode = $(artist);
          chartSongArtists.push(artistNode.text());
        });

      let chartData = {
        title: chartSongTitle,
        artists: chartSongArtists,
        spotifyURI: "",
      };

      songs.push(chartData);
    });

    console.log(`Done scraping Asia Pop 40's webiste`);
    resolve(songs);
  });
};

/**
 * function to spawn a server child processs
 * dies after 5 minutes
 *
 */
const startServer = () => {
  const server = spawn("node", ["./src/server.js"]);

  server.stdout.on("data", (data) => {
    console.log(`output server : ${data}`);
  });

  server.stderr.on("data", (dataErr) => {
    console.error(`error server : ${dataErr}`);
  });

  setTimeout(() => {
    server.kill();
  }, 60000);
};

/*
 * function to request access token to spotify because
 * this function is called after getting user authorized token (the end of getUserAuthCode)
 *
 */
const getSpotifyAccessToken = (code) => {
  const encodedAuthClient = Buffer.from(
    `${CLIENT_ID}:${SECRET_CLIENT_ID}`,
    "utf-8"
  ).toString("base64");
  const redirectURL = new URL("http://localhost:3000/get-token-hash");

  return new Promise(async (resolve, reject) => {
    try {
      let token = await fetch("https://accounts.spotify.com/api/token", {
        method: "post",
        headers: {
          Authorization: "Basic " + encodedAuthClient,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `grant_type=authorization_code&code=${code}&redirect_uri=${redirectURL.href}`,
      });
      if (!token.ok) throw new Error("not fetching getSpotifyAccessToken correctly");
      token = await token.json();
      token = token.access_token;

      console.log("Done getting spotify access token");
      resolve(token);
    } catch (err) {
      console.error(`Error in getSpotifyAccessToken : ${err}`);
      reject();
    }
  });
};

/**
 * function to perform login and get authorization token from authorization code flow
 * and then authorization token is exchanged into Access Token
 *
 * @returns promise with resolve token / reject undefined
 */
const getSpotifyToken = () => {
  return new Promise(async (resolve, reject) => {
    console.log(`Running puppeteer to get the token ...`);

    const redirectURL = new URL("http://localhost:3000/get-token-hash");
    const spotifyTokenURL =
      "https://accounts.spotify.com/authorize?" +
      "client_id=" + CLIENT_ID +
      "&response_type=code" +
      "&redirect_uri=" +
      redirectURL.href +
      "&scope=playlist-modify-public";

    const browser = await puppeteer.launch({ headless: false });

    const page = await browser.newPage();
    await page.setDefaultTimeout(0);

    await page.goto(spotifyTokenURL, {
      waitUntil: "networkidle2",
    });

    await page.waitForSelector("input#login-username");

    await page.type("input#login-username", SPOTIFY_EMAIL, { delay: 300 });
    await page.type("input#login-password", SPOTIFY_PASSWORD, { delay: 300 });

    try {
      await page.waitForNavigation({
        timeout: 10000,
        waitUntil: "networkidle2",
      });

      let authToken = await page.content();
      await browser.close();

      authToken = authToken.replace(/<([^>]+)>/gi, ""); // strip tags
      console.log(`Done taking authToken`);

      let token;
      try {
        token = await getSpotifyAccessToken(authToken);
      } catch (err) {
        console.error(`Error access token inside getSpotifyToken : ${err}`);
        return;
      }
      resolve(token);

    } catch (err) {
      console.error(`Error in navigation/content/closing browser : ${err}`);
      reject(err);
    }
  });
};

/**
 * function that removes all songs inside playlist
 * it reads uris.json, and then sends them to the spotify api
 * to remove the songs from the list
 */
const removeSpotifyPlaylistSongs = async (token) => {
  return new Promise(async (resolve, reject) => {
    console.log(`Removing songs on spotify playlist...`);

    let songURIs = fs.readFileSync(process.cwd() + "/src/uris.json", "utf8");
    songURIs = JSON.parse(songURIs);

    let tracks = [];

    songURIs.forEach((uri) => {
      let trackURI = {
        uri: uri,
      };
      tracks.push(trackURI);
    });

    let dataTracks = {
      tracks: tracks,
    };

    try {
      let response = await fetch(
        "https://api.spotify.com/v1/playlists/" + PLAYLIST_ID + "/tracks",
        {
          method: "delete",
          headers: {
            Authorization: "Bearer " + token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(dataTracks),
        }
      );
      if (!response.ok) throw new Error("not deleting removeSpotifyPlaylistSongs correctly");

      console.log(`Done removing songs`);
      resolve();
    } catch (err) {
      console.error(`Error inside removeSpotifyPlaylistSongs : ${err}`);
      reject();
    }
  });
};

/**
 * function for searching one song uri
 * if the song doesn't exist in spotify, it returns nothing
 */
const searchSpotifySongURI = async (token, searchQuery) => {
  const spotifySearch = await fetch(
    "https://api.spotify.com/v1/search?q=" +
      searchQuery +
      "&type=track&limit=1",
    {
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    }
  );

  if (!spotifySearch.ok) {
    console.error("not fetching spotify search correctly");
    return;
  }

  const spotifySearchResult = await spotifySearch.json();

  try {
    if (!spotifySearchResult.tracks.items[0].uri) throw new Error("no uri");
    return spotifySearchResult.tracks.items[0].uri;
  } catch (err) {
    console.error(`No uri while searching : ${searchQuery} : ${err}`);
  }
};

/**
 * takes songs json, change them into array, search
 * for each song's uri through spotify search API from the array
 * and put them into the array, change them into json
 */
const searchSpotifySongURIs = async (token, songs) => {
  return new Promise(async (resolve, reject) => {
    console.log(`Searching for track's URI in spotify...`);

    let songURIs = [];

    for (let song of songs) {
      const artist = song.artists.join(" ");
      const title = song.title.replace(/'/gi, "").replace(/"/gi, "");
      // why not chaining replace before encodingURI?
      // the stupid function unable to encode parentheses "()"
      // because of that, if i chain replace before the function (e.g. ".replace(/\(/, '%28')"),
      // it will encode the %
      const searchQuery = encodeURI(title + artist)
        .replace(/\(/, "")
        .replace(/\)/, "");

      const searchSongResult = await searchSpotifySongURI(token, searchQuery);
      // console.log(searchQuery);
      songURIs.push(searchSongResult);
    }

    fs.writeFileSync(
      process.cwd() + "/src/uris.json",
      JSON.stringify(songURIs),
      "utf8"
    );
    console.log(`Done Searching`);
    resolve(songURIs);
  });
};

/**
 * function that add all songs to the playlist
 */
const addSpotifyPlaylistSongs = async (token, songURIs) => {
  return new Promise(async (resolve, reject) => {
    console.log("Adding searched songs to spotify playlist ...");

    const dataURIs = {
      uris: songURIs,
    };

    try {
      let response = await fetch(
        "https://api.spotify.com/v1/playlists/" + PLAYLIST_ID + "/tracks",
        {
          method: "post",
          headers: {
            Authorization: "Bearer " + token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(dataURIs),
        }
      );
      if (!response.ok) throw new Error("not fetching addSpotifyPlaylistSongs correctly");

      console.log(`Done adding searched songs`);
      resolve();
    } catch (err) {
      console.error(`Error inside addSpotifyPlaylistSongs : ${err}`);
      reject();
    }
  });
};

/**
 * function that updates the details
 */
const updateSpotifyPlaylistTitle = async (token) => {
  return new Promise(async (resolve, reject) => {
    console.log("Changing playlist title ...");

    const dateNow = new Date(Date.now());
    const date = dateNow.getDate();
    const dateth = nth(date);
    const month = monthToHuman(dateNow.getMonth());
    const year = dateNow.getFullYear();
    const titleDate = date + dateth + " " + month + " " + year;
    const title = `Asia Pop 40 - Weekly Updated Playlist - ${titleDate}`;

    const titleName = {
      name: title,
    };

    try {
      let response = await fetch(
        "https://api.spotify.com/v1/playlists/" + PLAYLIST_ID,
        {
          method: "put",
          headers: {
            Authorization: "Bearer " + token,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(titleName),
        }
      );
      if (!response.ok) throw new Error("not updating title correctly");

      console.log(`Done changed playlist title`);
      resolve();
    } catch (err) {
      console.error(`Error inside updateSpotifyPlaylistTitle : ${err}`);
      reject();
    }
  });
};

export {
  scrapeAP40,
  startServer,
  getSpotifyToken,
  removeSpotifyPlaylistSongs,
  searchSpotifySongURIs,
  addSpotifyPlaylistSongs,
  updateSpotifyPlaylistTitle,
};
