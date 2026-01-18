import "dotenv/config.js";
import * as cheerio from "cheerio";
import fetch from "node-fetch";
import fs from "fs";
import puppeteer from "puppeteer";
import { URL } from "url";
import { monthToHuman } from "./util/dateHelper.js";
import { Buffer } from "buffer";

const SPOTIFY_PASSWORD = process.env.SPOTIFY_PASSWORD;
const SPOTIFY_EMAIL = process.env.SPOTIFY_EMAIL;
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SECRET_CLIENT_ID = process.env.SPOTIFY_CLIENT_SECRET;
const PLAYLIST_ID = process.env.SPOTIFY_PLAYLIST_ID;
const redirectURL = new URL("http://127.0.0.1:3000/get-token-hash");
const URIPath = process.cwd() + "/src/temp/uris.json";

/*
 * function that scrapes AP40 website to get Spotify URI
 *
 * @async
 * @param {void}
 * @returns {Promise<array>} returns spotify URIs
 */
const scrapeAP40 = async () => {
  return new Promise(async (resolve, reject) => {
    console.log("Running puppeteer to get Asia Pop 40's table ...");

    try {
      const browser = await puppeteer.launch({headless: false});

      const page = await browser.newPage();
      await page.setDefaultTimeout(0);

      await page.goto("https://asiapop40.com");
      await page.waitForTimeout(5000);

      const html = await page.content();
      await browser.close();

      const $ = cheerio.load(html);

      let spotifyURIs = [];

      $("tbody tr").each((_, el) => {
        // the first td could be the actual number of the chart, BuzzzTrack, Hit Prediction, or Concert Track
        const curChar = $(el).children("td").first().text().trim();

        if (curChar == "BuzzzTrack" || curChar == "Hit Prediction" || curChar == "Concert Track") {
          return;
        }

        // console.log(`\n${$(el).find("a").first().prop("innerHTML")} = `)
        const spotifyTrackURL = $(el).find("a").first().prop("href");
        // console.log(spotifyTrackURL);

        let URI = spotifyTrackURL.slice(spotifyTrackURL.lastIndexOf("/") + 1, spotifyTrackURL.length);
        URI = "spotify:track:" + URI;
        // console.log(URI);
        spotifyURIs.push(URI);
      });

      resolve(spotifyURIs);

    } catch (err) {
      console.error(`Error in scrapeAP40 : ${err}`);
    }
  })
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
    await page.click("button#login-button", { "button": "left", delay: 300 });

    await page.waitForSelector("button[data-encore-id='buttonTertiary']");
    await page.click("button[data-encore-id='buttonTertiary']", { "button": "left", delay: 300 });

    await page.waitForSelector("input#login-password");
    await page.type("input#login-password", SPOTIFY_PASSWORD, { delay: 300 });
    await page.click("button#login-button", { "button": "left", delay: 300 });


    // await page.waitForNavigation({
    //   timeout: 10000,
    //   waitUntil: "networkidle2",
    // });

    const url = new URL(page.url());
    if (url.host != '127.0.0.1') await page.waitForTimeout(35000);

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

      fs.writeFileSync(
        URIPath,
        JSON.stringify(filteredURIs),
        "utf8"
      );

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
  scrapeAP40,
  automateSpotifyToken,
  getSpotifyAccessToken,
  removeSpotifyPlaylistSongs,
  addSpotifyPlaylistSongs,
  updateSpotifyPlaylistTitle,
};
