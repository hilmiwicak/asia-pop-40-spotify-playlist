import {
  getAP40csv,
  parseAP40csv,
  automateSpotifyToken,
  getSpotifyAccessToken,
  removeSpotifyPlaylistSongs,
  searchSpotifySongURIs,
  addSpotifyPlaylistSongs,
  updateSpotifyPlaylistTitle,
} from "./ap40.js";
import { startServer } from "./server.js";
// import fs from "fs";

(async () => {
  let chartList, authToken, accessToken, songsURI;

  await getAP40csv();
  chartList = parseAP40csv();

  startServer();
  authToken = await automateSpotifyToken();
  accessToken = await getSpotifyAccessToken(authToken);

  removeSpotifyPlaylistSongs(accessToken);

  songsURI = await searchSpotifySongURIs(accessToken, chartList);

  // songsURI = fs.readFileSync(process.cwd() + "/src/temp/uris.json", "utf8");
  // const songsURIs = JSON.parse(songsURI);
  // addSpotifyPlaylistSongs(accessToken, songsURIs);

  addSpotifyPlaylistSongs(accessToken, songsURI);

  updateSpotifyPlaylistTitle(accessToken);

})();
