import "dotenv/config.js";
import { parseFile } from "fast-csv";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import { URL, fileURLToPath } from "url";
import { monthToHuman } from "./util/dateHelper.js";
import { Buffer } from "buffer";

const SPOTIFY_PASSWORD = process.env.SPOTIFY_PASSWORD;
const SPOTIFY_EMAIL = process.env.SPOTIFY_EMAIL;
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SECRET_CLIENT_ID = process.env.SPOTIFY_CLIENT_SECRET;
const PLAYLIST_ID = process.env.SPOTIFY_PLAYLIST_ID;
const redirectURL = new URL("http://localhost:3000/get-token-hash");
const downloadPath = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url))) , "/temp/");
const csvPath = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url))) , "/temp/ap40.csv");
const URIPath = process.cwd() + "/src/temp/uris.json";

/*
 * function that gets Asia Pop 40's csv from airtable
 *
 * @async
 * @param {void}
 * @returns {Promise<void>} method that returns nothing
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

    await page._client.send("Page.setDownloadBehavior", {
      behavior: "allow",
      downloadPath: downloadPath,
    });

    page.on('response', async (response) => {
      const contentType = response.headers()['content-type'];
      if (contentType !== 'text/csv') return;

      let fileName = path.basename(response.request().url());

      // removing all query parameter from the url
      fileName = fileName.replace(/\?.*$/g, '');

      // setTimeout is used because sometimes the download speed is slow
      setTimeout(() => {
        fs.rename(`${downloadPath}/${fileName}`, `${csvPath}`, (err) => {
          if (err) throw err;
          console.log(`Successfully renamed ${downloadPath}/${fileName} into ${csvPath}`);
        });
      }, 3000);
    });

    await page.waitForTimeout(7000);
    await browser.close();

    console.log("Successfully downloaded Asia Pop 40's table!");
  } catch (err) {
    console.error(`Error in getAP40 : ${err}`);
  }
}

/**
 * function that parses the csv file that returns an array of objects
 *
 * @async
 * @param {void}
 * @returns {Promise<array>} array of objects
 */
const parseAP40csv = async () => {
  return new Promise(async (resolve, reject) => {
    console.log("Parsing Asia Pop 40's csv ...");
    let chartList = [];
    let result = [];

    parseFile(csvPath, { headers: true })
      .on("data", (row) => {
        let chartData = {};
        chartData["This Week"] = row["This Week"];
        chartData["title"] = row["Song Title"];
        chartData["artists"] = row["Artists"];
        chartData["spotifyURI"] = "";

        chartList.push(chartData);
      })
      .on("end", () => {
        result = chartList
          .sort((a, b) => a["This Week"] - b["This Week"])
          .map(({ title, artists, spotifyURI }) => ({ title, artists, spotifyURI }));

        console.log("Successfully parsed Asia Pop 40's csv!");
        resolve(result);
      })
      .on("error", err => {
        console.error(`Error in parseAP40csv : ${err}`);
        reject();
        return;
      });
  });
}

/**
 * function to perform login and get authorization token from authorization code flow
 *
 * @async
 * @param {void}
 * @returns {Promise<string>} promise with resolve authorization token / reject undefined
 */
const automateSpotifyToken = () => {
  return new Promise(async (resolve, reject) => {
    console.log(`Running puppeteer to get the token ...`);

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
    if (url.host != 'localhost') await page.waitForTimeout(35000);

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
 * @async
 * @param {string} authToken
 * @returns {Promise<string>} promise with resolve access token / reject undefined
 */
const getSpotifyAccessToken = (authToken) => {
  let code = authToken.replace(/<([^>]+)>/gi, ""); // strip tags
  const encodedAuthClient = Buffer.from(
    `${CLIENT_ID}:${SECRET_CLIENT_ID}`,
    "utf-8"
  ).toString("base64");

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
 *
 * @async
 * @param {string} token
 * @returns {Promise<void>} method that returns nothing
 */
const removeSpotifyPlaylistSongs = async (token) => {
  return new Promise(async (resolve, reject) => {
    console.log(`Removing songs on spotify playlist...`);

    let songURIs = fs.readFileSync(URIPath, "utf8");
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
 *
 * @async
 * @param {string} token
 * @param {string} searchQuery
 * @returns {Promise<string>} promise with resolve uri / reject null
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

  try {
    const spotifySearchResult = await spotifySearch.json();

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
 *
 * @async
 * @param {string} token
 * @param {array} songs
 * @returns {Promise<array>} promise with resolve array of uri / reject undefined
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
        URIPath,
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
 *
 * @async
 * @param {string} token
 * @param {array} songURIs
 * @returns {Promise<void>} method that returns nothing
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
 * function that updates playlist description
 *
 * @async
 * @param {string} token
 * @returns {Promise<void>} method that returns nothing
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
  automateSpotifyToken,
  getSpotifyAccessToken,
  removeSpotifyPlaylistSongs,
  searchSpotifySongURIs,
  addSpotifyPlaylistSongs,
  updateSpotifyPlaylistTitle,
};
