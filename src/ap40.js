import "dotenv/config.js";
import { parseFile } from "fast-csv";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import { URL, fileURLToPath } from "url";
import { spawn } from "child_process";
import { monthToHuman } from "./util/dateHelper.js";
import { Buffer } from "buffer";

const SPOTIFY_PASSWORD = process.env.SPOTIFY_PASSWORD;
const SPOTIFY_EMAIL = process.env.SPOTIFY_EMAIL;
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SECRET_CLIENT_ID = process.env.SPOTIFY_CLIENT_SECRET;
const PLAYLIST_ID = process.env.SPOTIFY_PLAYLIST_ID;

/*
 * function that gets Asia Pop 40's csv from airtable
 */
const getAP40csv = async () => {
  // link airtable 10/4/2023 https://airtable.com/embed/shrt4bV5k6wm3OVI0
  console.log("Running puppeteer to get Asia Pop 40's table ...");

  try {
    const browser = await puppeteer.launch({headless: false});
    const page = await browser.newPage();
    page.setDefaultTimeout(0);

    await page.goto("https://airtable.com/appekkpK3Tk1BR31o/shr8qCEUdXeXLKBZy", {
      waitUntil: "networkidle2",
    });

    await page.click('[aria-label="More view options"]');
    await page.click('[data-tutorial-selector-id="viewMenuItem-viewExportCsv"]');

    await page.waitForTimeout(3000);

    // set download path
    const downloadPath = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url))) , "/temp/");
    await page._client.send("Page.setDownloadBehavior", {
      behavior: "allow",
      downloadPath: downloadPath,
    });

    await page.click('div.dialog div[role="button"][tabindex="20002"]');

    // rename the downloaded file using page response header content-type
    page.on('response', response => {
      const contentType = response.headers()['content-type'];
      if ( contentType === 'text/csv') {

        let fileName = path.basename(response.request().url());
        fileName = fileName.slice(0, 25);

        fileName = decodeURIComponent(fileName);

        setTimeout(() => {
          fs.rename(`${downloadPath}/${fileName}`, `${downloadPath}/ap40.csv`, (err) => {
            if (err) throw err;
            console.log(`Successfully renamed into ${downloadPath}/ap40.csv!`);
          });
        }, 3000);
      }
    });

    await page.waitForTimeout(7000);
    await browser.close();

    console.log("Successfully downloaded Asia Pop 40's table!");
  } catch (err) {
    console.error(`Error in getAP40 : ${err}`);
  }
}

/**
 * function that parses the csv file
 * returns an array of objects
 */
const parseAP40csv = async () => {
  return new Promise(async (resolve, reject) => {
    console.log("Parsing Asia Pop 40's csv ...");
    let chartList = [];
    // let chartListSorted = [];
    const csvPath = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url))) , "/temp/ap40.csv");

    parseFile(csvPath, { headers: true })
      .on("data", (row) => {
        if (row["Song Title"] == "" || row["Artists"] == "") {
          return;
        }

        let chartData = {};
        chartData.title = row["Song Title"];
        chartData.artists = row["Artists"];
        chartData.spotifyURI = "";

        chartList.push(chartData);
      })
      .on("end", () => {
        // for (let i = chartList.length-1; i>= 0; i--){
        //   chartListSorted.push(chartList[i])
        // }

        console.log("Successfully parsed Asia Pop 40's csv!");
        resolve(chartList)
      })
      .on("error", err => reject(`Error in parseAP40csv : ${err}`));
  });
}

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

/**
 * function to perform login and get authorization token from authorization code flow
 *
 * @returns promise with resolve authorization token / reject undefined
 */
const automateSpotifyToken = () => {
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

    const browser = await puppeteer.launch({headless: false});

    const page = await browser.newPage();
    await page.setDefaultTimeout(0);

    await page.goto(spotifyTokenURL, {
      waitUntil: "networkidle2",
    });

    await page.waitForSelector("input#login-username");

    await page.type("input#login-username", SPOTIFY_EMAIL, { delay: 300 });
    await page.type("input#login-password", SPOTIFY_PASSWORD, { delay: 300 });

    await page.click("button#login-button", { "button": "left" });

    // await page.waitForNavigation({
    //   timeout: 10000,
    //   waitUntil: "networkidle2",
    // });

    const url = new URL(page.url());
    if (url.host != 'localhost') {
      await page.waitForTimeout(35000);
    }

    let authToken = await page.content();
    console.log(`page content authToken: ${authToken}`);
    resolve(authToken);
    console.log(`Done getting the token!`);

    await browser.close();
  });
};

/*
 * function that changes authorization token into access token
 *
 * @param {string} authToken
 * @returns promise with resolve access token / reject undefined
 */
const getSpotifyAccessToken = (authToken) => {
  let code = authToken.replace(/<([^>]+)>/gi, ""); // strip tags
  const encodedAuthClient = Buffer.from(
    `${CLIENT_ID}:${SECRET_CLIENT_ID}`,
    "utf-8"
  ).toString("base64");

  // TODO: this url should've been taken from the env
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

      console.log("Done getting spotify access token!");
      console.log(`Spotify access token : ${token}`);
      resolve(token);
    } catch (err) {
      console.error(`Error in getSpotifyAccessToken : ${err}`);
      reject();
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

    let songURIs = fs.readFileSync(process.cwd() + "/src/temp/uris.json", "utf8");
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
    console.log(spotifySearch);
    return;
  }

  const spotifySearchResult = await spotifySearch.json();

  try {
    if (!spotifySearchResult.tracks.items[0].uri) throw new Error("no uri");
    console.log(`name : ${JSON.stringify(spotifySearchResult.tracks.items[0].name, null, 3)}`);
    console.log(`external_urls : ${JSON.stringify(spotifySearchResult.tracks.items[0].external_urls, null, 3)}`);
    console.log(`uri : ${JSON.stringify(spotifySearchResult.tracks.items[0].uri, null, 3)}\n`);
    // console.log(spotifySearchResult.tracks.items[0]);
    return spotifySearchResult.tracks.items[0].uri;
  } catch (err) {
    console.error(`No uri while searching : ${searchQuery} : ${err}`);
    // if program unable to search, it defaults to put Mr. Brightside song
    return "spotify:track:003vvx7Niy0yvhvHt4a68B";
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

    try {
      let songURIs = [];

      for (let song of songs) {
        const artist = "artist:" + song.artists;
        const title = "track:" + song.title;
        // const title = song.title.replace(/'/gi, "").replace(/"/gi, "");

        // why not chaining replace before encodingURI?
        // the stupid function unable to encode parentheses "()"
        // because of that, if i chain replace before the function (e.g. ".replace(/\(/, '%28')")),
        // it will encode the %
        const searchQuery = encodeURI(title + " " + artist)
          .replace(/\(/, "")
          .replace(/\)/, "");

        console.log(`searchQuery: ${searchQuery}`);

        const searchSongResult = await searchSpotifySongURI(token, searchQuery);
        songURIs.push(searchSongResult);
      }

      fs.writeFileSync(
        process.cwd() + "/src/temp/uris.json",
        JSON.stringify(songURIs),
        "utf8"
      );
      console.log(`All of songURIs : ${songURIs}`);
      console.log(`Done searching every songs URIs!`);
      resolve(songURIs);
    } catch (err) {
      console.error(`Error inside searchSpotifySongURIs : ${err}`);
      reject();
    }
  });
};

/**
 * function that add all songs to the playlist
 */
const addSpotifyPlaylistSongs = async (token, songURIs) => {
  return new Promise(async (resolve, reject) => {
    console.log("Adding searched songs to spotify playlist ...");

    // const filteredURIs = songURIs.filter(uri => uri !== null && uri !== "null");
    const filteredURIs = songURIs.filter(uri => uri);

    const dataURIs = {
      uris: filteredURIs,
    };

    console.log(`filtered dataURIs: ${JSON.stringify(dataURIs, "", "\t")}`);

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
      if (!response.ok) throw new Error(`not fetching addSpotifyPlaylistSongs correctly ${response.status}`);

      console.log(`Done adding searched songs into spotify!`);
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
    const month = monthToHuman(dateNow.getMonth());
    const year = dateNow.getFullYear();
    const titleDate = `${date} ${month} ${year}`;
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

      console.log(`Done changing playlist title`);
      resolve();
    } catch (err) {
      console.error(`Error inside updateSpotifyPlaylistTitle : ${err}`);
      reject();
    }
  });
};

export {
  getAP40csv,
  parseAP40csv,
  startServer,
  automateSpotifyToken,
  getSpotifyAccessToken,
  removeSpotifyPlaylistSongs,
  searchSpotifySongURIs,
  addSpotifyPlaylistSongs,
  updateSpotifyPlaylistTitle,
};
