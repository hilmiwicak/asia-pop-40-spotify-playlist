import {
  scrapeAP40,
  automateSpotifyToken,
  getSpotifyAccessToken,
  removeSpotifyPlaylistSongs,
  addSpotifyPlaylistSongs,
  updateSpotifyPlaylistTitle,
} from "./ap40.js";
import { startServer } from "./server.js";
// import fs from "fs";

(async () => {
  let songsURI, authToken, accessToken;

  songsURI = await scrapeAP40();

  startServer();
  authToken = await automateSpotifyToken();
  accessToken = await getSpotifyAccessToken(authToken);

  removeSpotifyPlaylistSongs(accessToken);

  // songsURI = fs.readFileSync(process.cwd() + "/src/temp/uris.json", "utf8");
  // const songsURIs = JSON.parse(songsURI);
  // addSpotifyPlaylistSongs(accessToken, songsURIs);

  addSpotifyPlaylistSongs(accessToken, songsURI);

  updateSpotifyPlaylistTitle(accessToken);

})();
